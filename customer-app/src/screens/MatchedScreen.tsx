import { showAlert } from '../store/alert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Phone,
  Star,
  X,
  ShieldCheck,
  Clock,
  Route,
  Wallet,
  Layers,
  Crosshair,
  HelpCircle,
  MapPin,
} from 'lucide-react-native';
import { api, Job } from '../services/api';
import { useApp } from '../store/app';
import { connectCustomerSocket } from '../services/socket';
import { callPhoneDirect } from '../services/callDirect';
import { LeafletMap } from '../components/LeafletMap';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ProgressNotification = NativeModules.ProgressNotification;

type LatLng = { lat: number; lng: number };

type Props = {
  jobId: string;
  onArrived: () => void;
  onTerminal: () => void;
};

export function MatchedScreen({ jobId, onArrived, onTerminal }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const customerLoc = useApp((s) => s.location);
  const customerAddress = useApp((s) => s.address);
  const [job, setJob] = useState<Job | null>(null);
  const [workerLoc, setWorkerLoc] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const arrivedFired = useRef(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    api.getJob(jobId)
      .then((j) => {
        if (!alive) return;
        setJob(j);
        if (j.worker?.location) setWorkerLoc(j.worker.location);
      })
      .catch(() => { });

    const sock = connectCustomerSocket(jobId);
    const onUpdate = (j: Job) => {
      if (!alive) return;
      setJob(j);
      if (j.worker?.location) setWorkerLoc(j.worker.location);
    };
    const onWorkerLoc = (p: { lat: number; lng: number }) => {
      if (!alive) return;
      setWorkerLoc({ lat: p.lat, lng: p.lng });
    };

    sock.on('job:update', onUpdate);
    sock.on('worker_location', onWorkerLoc);
    return () => {
      alive = false;
      sock.off('job:update', onUpdate);
      sock.off('worker_location', onWorkerLoc);
    };
  }, [jobId]);

  const initialDistRef = useRef<number | null>(null);

  // Update progress notification when worker location changes
  useEffect(() => {
    if (!workerLoc || !customerLoc || !job?.worker) return;
    const km = haversineKm(workerLoc.lat, workerLoc.lng, customerLoc.lat, customerLoc.lng);
    
    if (initialDistRef.current === null) {
      initialDistRef.current = km;
    }
    
    let progress = 0;
    if (initialDistRef.current > 0) {
      progress = Math.max(0, Math.min(100, Math.round(100 - (km / initialDistRef.current) * 100)));
    } else {
      progress = 100;
    }

    let title = 'Crewli: Worker is on the way';
    let body = `${job.worker.name || 'Your worker'} is ${km.toFixed(1)} km away`;
    if (km < 0.5) {
      title = 'Crewli: Almost there!';
      body = 'Your worker is very close';
    } else if (km < 2) {
      title = 'Crewli: Arriving soon';
      body = `${job.worker.name || 'Your worker'} is nearby`;
    }

    try {
      ProgressNotification?.showProgress(title, body, progress);
    } catch { }

    return () => {
      try { ProgressNotification?.dismiss(); } catch { }
    };
  }, [workerLoc?.lat, workerLoc?.lng, customerLoc?.lat, customerLoc?.lng, job?.worker?.name]);

  useEffect(() => {
    if (!job) return;
    if ((job.status === 'arrived' || job.status === 'completed' || job.status === 'paid') && !arrivedFired.current) {
      arrivedFired.current = true;
      try { ProgressNotification?.dismiss(); } catch { }
      onArrived();
    }
    if (job.status === 'cancelled' || job.status === 'expired') {
      try { ProgressNotification?.dismiss(); } catch { }
      onTerminal();
    }
  }, [job?.status, onArrived, onTerminal]);

  // Dismiss notification on unmount
  useEffect(() => {
    return () => {
      try { ProgressNotification?.dismiss(); } catch { }
    };
  }, []);

  const etaMin = useMemo(() => {
    if (!workerLoc || !customerLoc) return null;
    const km = haversineKm(workerLoc.lat, workerLoc.lng, customerLoc.lat, customerLoc.lng);
    return Math.max(1, Math.round((km / 25) * 60));
  }, [workerLoc?.lat, workerLoc?.lng, customerLoc?.lat, customerLoc?.lng]);

  const distKm = useMemo(() => {
    if (!workerLoc || !customerLoc) return null;
    return haversineKm(workerLoc.lat, workerLoc.lng, customerLoc.lat, customerLoc.lng);
  }, [workerLoc?.lat, workerLoc?.lng, customerLoc?.lat, customerLoc?.lng]);

  if (!job || !job.worker) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
        <View style={styles.center}>
          <ActivityIndicator color="#4f46e5" size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Locating your worker…
          </Text>
        </View>
      </View>
    );
  }

  const w = job.worker;

  const call = () => {
    const p = job?.worker?.phone;
    if (!p) return showAlert('Phone unavailable');
    callPhoneDirect(p);
  };

  const cancel = () => {
    if (!job || busy) return;
    showAlert(
      'Cancel booking?',
      'The worker will be notified.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel now',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api.cancelJob(job.id);
              try { ProgressNotification?.dismiss(); } catch { }
              onTerminal();
            } catch (e: any) {
              showAlert('Could not cancel', e?.message || 'error');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const focusMap = () => {
    if (mapRef.current?.focusCurrentLocation) {
      mapRef.current.focusCurrentLocation();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* Purple Header */}
      <View style={[styles.purpleHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <Text style={styles.headerSub}>Worker is on the way</Text>
        <Text style={styles.headerEta}>
          Arriving in {etaMin != null ? `${etaMin} minutes` : '...'}
        </Text>
      </View>

      {/* Map Section */}
      <View style={styles.mapSection}>
        <LeafletMap
          ref={mapRef}
          worker={workerLoc}
          customer={customerLoc}
          style={styles.map}
        />

        {/* Map overlay buttons */}
        <TouchableOpacity
          onPress={focusMap}
          style={[styles.mapOverlayBtn, styles.focusBtn, { backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)' }]}
          activeOpacity={0.8}
        >
          <Crosshair size={20} color="#4f46e5" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Panel - just a View now */}
        <View style={[styles.infoPanel, { padding: 20 }]}>
        {/* Worker intro */}
        <View style={styles.workerRow}>
          <View style={[styles.avatar, { backgroundColor: '#4f46e5' }]}>
            <Text style={styles.avatarLetter}>{(w.name || 'W').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.workerInfo}>
            <Text style={[styles.workerIntro, { color: colors.text }]}>
              {w.name || 'Your worker'}
            </Text>
            <View style={styles.ratingRow}>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text style={[styles.ratingText, { color: colors.text }]}>{w.rating.toFixed(1)}</Text>
              <Text style={[styles.dotSep, { color: colors.textMuted }]}>·</Text>
              <Text style={[styles.profession, { color: colors.textMuted }]}>
                {w.profession ? cap(w.profession) : 'Worker'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={call} style={styles.callBtn} activeOpacity={0.8}>
            <Phone size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Booking Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Booking Summary</Text>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#1a0a3e' : '#f3e8ff' }]}>
              <Text style={[styles.statusBadgeText, { color: '#4f46e5' }]}>On the way</Text>
            </View>
          </View>

          {/* Service */}
          <View style={[styles.summaryRow, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <View style={styles.summaryIconBox}>
              <Layers size={18} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Service Requested</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {job.subProblemTitle || 'General Service'}
              </Text>
            </View>
          </View>

          {/* Price */}
          <View style={[styles.summaryRow, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <View style={styles.summaryIconBox}>
              <Wallet size={18} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Estimated Price</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                ₹{job.basePrice}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.summaryIconBox}>
              <MapPin size={18} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Your Location</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={2}>
                {customerAddress || 'Location set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Need help */}
        <TouchableOpacity
          style={[styles.helpBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
          onPress={() => showAlert('Need Help?', 'Call us at 112 for emergencies or contact support through the app.')}
          activeOpacity={0.8}
        >
          <HelpCircle size={18} color="#4f46e5" />
          <Text style={[styles.helpBtnText, { color: colors.text }]}>Need help?</Text>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity onPress={cancel} disabled={busy} style={styles.cancelBtn} activeOpacity={0.7}>
          <X size={14} color={isDark ? '#f87171' : '#dc2626'} />
          <Text style={[styles.cancelText, { color: isDark ? '#f87171' : '#dc2626' }]}>Cancel Booking</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const { height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 16, fontWeight: '500' },

  // Purple header
  purpleHeader: {
    backgroundColor: '#4f46e5',
    paddingBottom: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  headerEta: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },

  // Map section - inline, fixed height
  mapSection: {
    height: SCREEN_H * 0.35,
    position: 'relative',
  },
  map: { flex: 1 },

  // Map overlay buttons
  mapOverlayBtn: {
    position: 'absolute',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  focusBtn: {
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info panel below the map
  infoPanel: {
    flex: 1,
  },

  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  workerInfo: { flex: 1 },
  workerIntro: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600' },
  dotSep: { fontSize: 13 },
  profession: { fontSize: 13, fontWeight: '500' },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryLabel: { fontSize: 12, marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: '600' },

  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  helpBtnText: { fontSize: 15, fontWeight: '700' },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
