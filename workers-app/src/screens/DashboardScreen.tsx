import { SafeScreen } from '../components/SafeScreen';
import { showAlert, showLoading, useAlert } from '../store/alert';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  Image,
  NativeModules,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  LogOut,
  ChevronRight,
  Power,
  Star,
  Wallet,
  CheckCircle2,
  TrendingUp,
  Calendar,
} from 'lucide-react-native';
import {
  api,
  ApiError,
  CachedWorker,
  cacheWorker,
  clearToken,
  CommissionStatus,
  WorkerStats,
} from '../services/api';
import { fbGetToken, fbOnMessage, fbOnTokenRefresh } from '../services/firebase';
import { handleBackgroundJobMessage } from '../services/fcmHandler';
import { SystemStatusCard } from '../components/SystemStatusCard';
import { AcceptedJobsList } from '../components/AcceptedJobsList';
import { ThemeToggle } from '../components/ThemeToggle';
import { ensureAndGetLocation, getCurrentLocation, hasLocationPermission } from '../services/location';
import { API_BASE_URL } from '../config';
import { useAuth } from '../store/auth';
import { useActiveJob } from '../store/activeJob';
import { useTheme } from '../theme/ThemeContext';

const IncomingJob = NativeModules.IncomingJob as {
  setAvailable?: (v: boolean) => void;
  setAuthContext?: (token: string, baseUrl: string) => void;
  canDrawOverlays?: () => Promise<boolean>;
  requestOverlayPermission?: () => void;
  isIgnoringBatteryOptimizations?: () => Promise<boolean>;
  canUseFullScreenIntent?: () => Promise<boolean>;
  hasNotificationsEnabled?: () => Promise<boolean>;
};

const HEARTBEAT_MS = 60_000;
const KEEPALIVE_MS = 10 * 60 * 1000; // 10 minutes

type Props = {
  worker: CachedWorker;
  setWorker: (w: CachedWorker | null) => void;
  onOpenProfile: () => void;
  onViewAllJobs?: () => void;
  onOpenCommission?: () => void;
};

export function DashboardScreen({ worker, setWorker, onOpenProfile, onViewAllJobs, onOpenCommission }: Props) {
  const { colors, isDark } = useTheme();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const accessToken = useAuth((s) => s.accessToken);

  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [commission, setCommission] = useState<CommissionStatus | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.workerStats();
      setStats(s);
      setStatsErr(null);
    } catch (e: any) {
      setStatsErr(e?.message || 'error');
    }
  }, []);

  const loadCommission = useCallback(async () => {
    try {
      const c = await api.getCommission();
      setCommission(c);
    } catch { /* non-critical */ }
  }, []);

  // Keep native layer in sync with the current auth so KeepAliveService can POST
  // heartbeats even while the app is closed.
  useEffect(() => {
    try {
      if (accessToken) IncomingJob.setAuthContext?.(accessToken, API_BASE_URL);
    } catch { }
  }, [accessToken]);

  // Sync on focus / app resume.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      if (st !== 'active') return;
      if (!useAuth.getState().accessToken) return;
      try {
        const me = await api.me();
        setWorker(me);
        await cacheWorker(me);
        loadStats();
        loadCommission();

        const res = await api.myJobs();
        const active = res.jobs.find(j => ['accepted', 'arrived', 'completed'].includes(j.status));
        if (active) {
          useActiveJob.getState().setJob(active);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await clearToken();
          setWorker(null);
        }
      }
    });
    return () => sub.remove();
  }, [setWorker, loadStats, loadCommission]);

  useEffect(() => {
    loadStats();
    loadCommission();
  }, [loadStats, loadCommission]);

  useEffect(() => {
    if (!worker) {
      stopHeartbeat();
      stopKeepAlive();
      return () => { stopHeartbeat(); stopKeepAlive(); };
    }
    try {
      IncomingJob.setAvailable?.(worker.isAvailable);
    } catch { }
    if (worker.isAvailable) {
      startHeartbeat();
      startKeepAlive();
    } else {
      stopHeartbeat();
      stopKeepAlive();
    }
    return () => { stopHeartbeat(); stopKeepAlive(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker]);

  useEffect(() => {
    const unsub = fbOnMessage(async (msg) => {
      await handleBackgroundJobMessage(msg);
      // Refresh commission status when a commission FCM arrives.
      const type = msg?.data?.type;
      if (type === 'COMMISSION_BLOCKED') {
        loadCommission();
      }
    });
    const sub = DeviceEventEmitter.addListener(
      'JobAction',
      async (ev: { action: string; jobId: string }) => {
        try {
          if (ev.action === 'accept') {
            const result = await api.accept(ev.jobId).catch(() => null);
            if (!result) {
              // 409 — job already taken by another worker
              showAlert('Job Unavailable', 'This job was already accepted by another worker.');
              return;
            }
            try {
              const job = await api.getJob(ev.jobId);
              useActiveJob.getState().setJob(job);
            } catch { }
          } else if (ev.action === 'reject') {
            await api.reject(ev.jobId).catch(() => { });
          }
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed');
        }
      }
    );
    const tokenSub = fbOnTokenRefresh(async (t) => {
      try {
        await api.sendFcmToken(t);
      } catch { }
    });
    return () => {
      unsub();
      sub.remove();
      tokenSub();
    };
  }, [loadCommission]);

  function startHeartbeat() {
    stopHeartbeat();
    sendHeartbeat();
    heartbeatTimer.current = setInterval(sendHeartbeat, HEARTBEAT_MS);
  }
  async function sendHeartbeat() {
    let loc = await getCurrentLocation();
    // Fallback to worker's saved default location if GPS unavailable
    if (!loc && worker?.location) {
      loc = worker.location;
    }
    api.heartbeat(loc || undefined).catch(() => { });
  }
  function stopHeartbeat() {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }

  // Keep-alive ping to prevent Render server cold starts
  function startKeepAlive() {
    stopKeepAlive();
    keepAliveTimer.current = setInterval(() => {
      fetch(`${API_BASE_URL}/`, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      }).catch(() => { });
    }, KEEPALIVE_MS);
  }
  function stopKeepAlive() {
    if (keepAliveTimer.current) {
      clearInterval(keepAliveTimer.current);
      keepAliveTimer.current = null;
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      const me = await api.me().catch(() => null);
      if (me) {
        setWorker(me);
        await cacheWorker(me);
      }
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  }

  async function toggle(val: boolean) {
    if (busyRef.current) return;
    // Prevent turning ON if commission is blocked.
    if (val && commission?.isBlocked) {
      showAlert(
        'Commission Payment Required',
        `Your commission balance (₹${commission.balance.toFixed(0)}) has reached the ₹${commission.limit} limit. Please pay your commission to resume accepting jobs.`,
        [{ text: 'OK' }]
      );
      return;
    }
    busyRef.current = true;
    setToggling(true);

    // Show loading alert when turning ON
    if (val) {
      try {
        const [battery, fsi, notif, locationPerm, overlay] = await Promise.all([
          IncomingJob.isIgnoringBatteryOptimizations?.() ?? Promise.resolve(true),
          IncomingJob.canUseFullScreenIntent?.() ?? Promise.resolve(true),
          IncomingJob.hasNotificationsEnabled?.() ?? Promise.resolve(true),
          hasLocationPermission(),
          IncomingJob.canDrawOverlays?.() ?? Promise.resolve(true),
        ]);

        const hasValidLocation = locationPerm || !!worker?.location;

        if (!battery || !fsi || !notif || !hasValidLocation || !overlay) {
          showAlert(
            'Permissions Required',
            'Please check the System Status card and grant all required permissions (Notifications, Battery Optimization, Full-Screen Intent, and Display Over Other Apps) before going online. You must also have GPS Location enabled or a default Location set in your profile.',
            [{ text: 'OK' }]
          );
          setToggling(false);
          busyRef.current = false;
          return;
        }
      } catch (e) {
        // Ignore error and proceed
      }
      showLoading('Turning on service...', 'Please wait while we set up job offers...');
    }

    try {
      let location: { lat: number; lng: number } | undefined;
      if (val) {
        const loc = await ensureAndGetLocation();
        if (loc) {
          location = loc;
          useAlert.getState().hide();
        } else if (worker?.location) {
          location = worker.location;
          useAlert.getState().hide();

        } else {
          useAlert.getState().hide();
          showAlert(
            'Location required',
            'Turn on GPS or set a default location in Profile so we can send you nearby jobs.'
          );
          return;
        }
      } else {
        useAlert.getState().hide();
      }

      const next = { ...worker, isAvailable: val };
      setWorker(next);
      await cacheWorker(next);
      try {
        IncomingJob.setAvailable?.(val);
      } catch { }

      try {
        // Parallelize: toggle API and FCM token fetch
        const promises: Promise<any>[] = [api.toggle(val, location)];
        if (val) {
          promises.push(
            fbGetToken().then(token => {
              if (token) return api.sendFcmToken(token);
            }).catch(() => { })
          );
        }
        await Promise.all(promises);
      } catch (e: any) {
        const rollback = { ...worker, isAvailable: !val };
        setWorker(rollback);
        await cacheWorker(rollback);
        try {
          IncomingJob.setAvailable?.(!val);
        } catch { }
        useAlert.getState().hide();
        showAlert('Toggle failed', e?.message || 'error');
      }
    } finally {
      busyRef.current = false;
      setToggling(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch { }
    try {
      IncomingJob.setAvailable?.(false);
    } catch { }
    await clearToken();
    setWorker(null);
  }

  const accentSoftBg = isDark ? '#0f1c3d' : '#eff6ff';

  if (!worker) {
    return (
      <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../trans-light-logo.png')}
            style={{ width: 70, height: 45 }}
            resizeMode="contain"
          />
          <View style={styles.headerRight}>
            <ThemeToggle />
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <LogOut size={16} color={colors.link} />
              <Text style={[styles.link, { color: colors.link }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile card */}
        <TouchableOpacity
          style={[
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={onOpenProfile}
          activeOpacity={0.85}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>
              {(worker.name || worker.phone || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>
              {worker.name || 'Set your name'}
            </Text>
            <View style={styles.subRow}>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                {worker.profession ? cap(worker.profession) : '—'}
              </Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}> · </Text>
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={[styles.sub, { color: colors.textMuted }]}> {worker.rating.toFixed(1)}</Text>
            </View>
          </View>
          <ChevronRight size={22} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Commission balance card */}
        {commission && (
          <TouchableOpacity
            onPress={onOpenCommission}
            activeOpacity={0.85}
            style={[
              styles.commissionBanner,
              commission.isBlocked
                ? styles.commissionBannerBlocked
                : [styles.commissionBannerNormal, { backgroundColor: colors.card, borderColor: colors.cardBorder }],
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.commissionBannerTitle, !commission.isBlocked && { color: colors.text }]}>
                {commission.isBlocked
                  ? 'Job offers paused — fees due'
                  : 'Fees to Pay'}
              </Text>
              <Text style={[styles.commissionBannerSub, !commission.isBlocked && { color: colors.textMuted }]}>
                {commission.isBlocked
                  ? `₹${commission.balance.toFixed(0)} due (limit ₹${commission.limit}). Tap to Pay and Resume Jobs.`
                  : `₹${commission.balance.toFixed(0)} due / ₹${commission.limit} limit. Tap to View More Details.`}
              </Text>
            </View>
            <ChevronRight
              size={18}
              color={commission.isBlocked ? '#FEE2E2' : colors.textMuted}
            />
          </TouchableOpacity>
        )}

        {/* Earnings headline */}
        <View
          style={[
            styles.earnHero,
            { backgroundColor: accentSoftBg, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.earnHeroRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.earnLabelRow}>
                <Wallet size={14} color={colors.accent} />
                <Text style={[styles.earnLabel, { color: colors.textMuted }]}>Today's earnings</Text>
              </View>
              <Text style={[styles.earnAmount, { color: colors.text }]}>
                {stats ? `₹${formatMoney(stats.earningsToday)}` : '—'}
              </Text>
              <Text style={[styles.earnSub, { color: colors.textMuted }]}>
                {stats
                  ? `${stats.jobsToday} job${stats.jobsToday === 1 ? '' : 's'} today`
                  : stats === null && statsErr
                    ? statsErr
                    : 'Loading…'}
              </Text>
            </View>
            {stats === null && !statsErr ? (
              <ActivityIndicator color={colors.accent} />
            ) : null}
          </View>

          {/* Week + Month row */}
          <View style={styles.earnSplitRow}>
            <View
              style={[
                styles.earnSplitItem,
                { borderColor: colors.cardBorder, backgroundColor: colors.card },
              ]}
            >
              <View style={styles.earnLabelRow}>
                <TrendingUp size={12} color={colors.textMuted} />
                <Text style={[styles.earnSplitLabel, { color: colors.textMuted }]}>This week</Text>
              </View>
              <Text style={[styles.earnSplitValue, { color: colors.text }]}>
                {stats ? `₹${formatMoney(stats.earningsWeek)}` : '—'}
              </Text>
            </View>
            <View
              style={[
                styles.earnSplitItem,
                { borderColor: colors.cardBorder, backgroundColor: colors.card },
              ]}
            >
              <View style={styles.earnLabelRow}>
                <Calendar size={12} color={colors.textMuted} />
                <Text style={[styles.earnSplitLabel, { color: colors.textMuted }]}>This month</Text>
              </View>
              <Text style={[styles.earnSplitValue, { color: colors.text }]}>
                {stats ? `₹${formatMoney(stats.earningsMonth)}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <StatTile
            icon={<CheckCircle2 size={16} color={colors.success} />}
            label="Completed"
            value={stats ? String(stats.totalCompleted) : '—'}
            bg={colors.card}
            border={colors.cardBorder}
            textColor={colors.text}
            subColor={colors.textMuted}
          />
          <StatTile
            icon={<Star size={16} color="#f59e0b" fill="#f59e0b" />}
            label="Rating"
            value={worker.rating.toFixed(1)}
            bg={colors.card}
            border={colors.cardBorder}
            textColor={colors.text}
            subColor={colors.textMuted}
          />
          <StatTile
            icon={<Wallet size={16} color={colors.accent} />}
            label="Lifetime"
            value={stats ? `₹${formatCompact(stats.earningsAll)}` : '—'}
            bg={colors.card}
            border={colors.cardBorder}
            textColor={colors.text}
            subColor={colors.textMuted}
          />
        </View>

        {/* Availability toggle */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.statusRow}>
            <Power size={18} color={commission?.isBlocked ? '#EF4444' : worker.isAvailable ? colors.success : colors.textFaint} />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {commission?.isBlocked ? 'PAUSED' : worker.isAvailable ? 'ON WORK' : 'OFF WORK'}
            </Text>
            <Switch
              value={worker.isAvailable && !commission?.isBlocked}
              onValueChange={toggle}
              disabled={toggling || commission?.isBlocked}
              trackColor={{ true: colors.success, false: isDark ? '#374151' : '#cbd5e1' }}
              thumbColor="#fff"
            />
          </View>
          <Text style={[styles.hint, { color: colors.textFaint }]}>
            {commission?.isBlocked
              ? `Commission balance (₹${commission.balance.toFixed(0)}) reached the ₹${commission.limit} limit. Pay to resume jobs.`
              : worker.isAvailable
                ? 'You will receive incoming job offers — even if this app is closed. ' +
                (worker.location ? 'Location is set.' : 'Set a default location in Profile as backup.')
                : 'You will NOT receive any job offers.'}
          </Text>
        </View>

        {/* Skills */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Skills</Text>
          {worker.skills.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textFaint }]}>No skills set yet.</Text>
          ) : (
            <View style={styles.tags}>
              {worker.skills.map((s) => (
                <View
                  key={s}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isDark ? '#1e2a4a' : '#dbeafe',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: isDark ? '#93c5fd' : '#1d4ed8' },
                    ]}
                  >
                    {s.split('.').pop()?.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <AcceptedJobsList limit={2} onViewAll={onViewAllJobs} />

        <SystemStatusCard />
      </ScrollView>
    </SafeScreen>
  );
}

function StatTile(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
  border: string;
  textColor: string;
  subColor: string;
}) {
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: props.bg, borderColor: props.border },
      ]}
    >
      <View style={{ marginBottom: 6 }}>{props.icon}</View>
      <Text style={[styles.statValue, { color: props.textColor }]}>{props.value}</Text>
      <Text style={[styles.statLabel, { color: props.subColor }]}>{props.label}</Text>
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMoney(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatCompact(n: number) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontSize: 14 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600' },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  sub: { fontSize: 13 },
  earnHero: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  earnHeroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  earnLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  earnLabel: { fontSize: 13, fontWeight: '500' },
  earnAmount: { fontSize: 36, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  earnSub: { fontSize: 13, marginTop: 2 },
  earnSplitRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  earnSplitItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  earnSplitLabel: { fontSize: 12 },
  earnSplitValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  statsStrip: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 20, fontWeight: '700', flex: 1 },
  hint: { marginTop: 10, fontSize: 13 },
  sectionLabel: { fontSize: 13, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, textTransform: 'capitalize' },
  offersBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  offersBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  commissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 8,
  },
  commissionBannerBlocked: {
    backgroundColor: '#EF4444',
  },
  commissionBannerNormal: {
    borderWidth: 1,
  },
  commissionBannerWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  commissionBannerTitle: {
    color: '#1C1917',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  commissionBannerSub: {
    color: '#44403C',
    fontSize: 12,
    lineHeight: 16,
  },
});
