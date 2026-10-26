import { showAlert } from '../store/alert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Navigation,
  Phone,
  X,
  CheckCircle2,
  Wallet,
  MapPin,
  FileText,
  Clock,
  Route,
  Layers,
  KeyRound,
} from 'lucide-react-native';
import { api, Job } from '../services/api';
import { useActiveJob } from '../store/activeJob';
import { useNavigation } from '@react-navigation/native';
import { getSocket, joinJob, leaveJob } from '../services/socket';
import {
  startLocationTracking,
  stopLocationTracking,
} from '../services/locationTracker';
import { ensureAndGetLocation } from '../services/location';
import { callPhoneDirect } from '../services/callDirect';
import { LeafletMap } from '../components/LeafletMap';
import { SwipeConfirm } from '../components/SwipeConfirm';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggablePanel } from '../components/DraggablePanel';

type LatLng = { lat: number; lng: number };

type Props = {
  job: Job;
  onComplete: (finalPrice: number, workerName?: string) => void;
  onCancel?: () => void;
};

export function JobActiveScreen({ job: initialJob, onComplete, onCancel }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const setStoreJob = useActiveJob((s) => s.setJob);
  const clear = useActiveJob((s) => s.clear);
  const navigation = useNavigation();

  const [job, setJob] = useState<Job | null>(initialJob);
  const [workerLoc, setWorkerLoc] = useState<LatLng | null>(
    initialJob?.worker?.location || null
  );
  const [busy, setBusy] = useState(false);

  // OTP state
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const jobId = job?.id || initialJob?.id || null;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;

    (async () => {
      try {
        const fresh = await api.getJob(jobId);
        if (!alive) return;
        setJob(fresh);
        setStoreJob(fresh);
        if (fresh.worker?.location) setWorkerLoc(fresh.worker.location);
      } catch { }
    })();

    const sock = getSocket();
    joinJob(jobId);
    const onUpdate = (j: Job) => {
      if (!alive || j.id !== jobId) return;
      setJob(j);
      setStoreJob(j);
    };
    sock.on('job:update', onUpdate);

    (async () => {
      const me = await ensureAndGetLocation();
      if (me) setWorkerLoc(me);
      startLocationTracking(jobId);
    })();

    return () => {
      alive = false;
      sock.off('job:update', onUpdate);
      leaveJob(jobId);
      stopLocationTracking();
    };
  }, [jobId, setStoreJob]);

  useEffect(() => {
    if (job?.status === 'paid') {
      const price = job.finalPrice ?? Math.round(job.basePrice + (job.addOnsTotal || 0));
      onComplete(price, job.worker?.name);
    }
  }, [job?.status]);

  if (!job) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 12 }]}>
            Loading job details…
          </Text>
        </View>
      </View>
    );
  }

  const status = job.status;
  const customerLoc = job.customerLocation;
  const finalPriceGuess =
    job.finalPrice ?? Math.round(job.basePrice + (job.addOnsTotal || 0));

  async function doStartNavigation() {
    if (!customerLoc) return;
    const { lat, lng } = customerLoc;
    const geo = `google.navigation:q=${lat},${lng}&mode=d`;
    const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const ok = await Linking.canOpenURL(geo).catch(() => false);
    Linking.openURL(ok ? geo : web).catch(() => { });
  }

  async function doArrived() {
    if (!jobId || busy) return;
    setBusy(true);
    try {
      const j = await api.jobArrived(jobId);
      setJob(j);
      setStoreJob(j);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not mark arrived');
    } finally {
      setBusy(false);
    }
  }

  async function doVerifyOtp() {
    if (!jobId || verifying) return;
    if (otpInput.length !== 4) { setOtpError('Enter 4-digit OTP'); return; }
    setVerifying(true);
    setOtpError('');
    try {
      const j = await api.verifyOtp(jobId, otpInput);
      setJob(j);
      setStoreJob(j);
    } catch (e: any) {
      setOtpError(e?.message === 'invalid_otp' ? 'Wrong OTP. Check with customer.' : (e?.message || 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  }

  async function doComplete() {
    if (!jobId || busy) return;
    setBusy(true);
    try {
      const j = await api.jobComplete(jobId);
      setJob(j);
      setStoreJob(j);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not complete');
    } finally {
      setBusy(false);
    }
  }



  async function doPaymentReceived() {
    if (!jobId || busy) return;
    setBusy(true);
    try {
      const j = await api.jobPaymentReceived(jobId);
      setJob(j);
      setStoreJob(j);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not confirm payment');
    } finally {
      setBusy(false);
    }
  }

  function doCancel() {
    if (!jobId) return;
    showAlert(
      'Cancel this job?',
      'The customer will be notified.',
      [
        { text: 'Keep working', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const j = await api.jobCancel(jobId);
              setJob(j);
              setStoreJob(j);
            } catch (e: any) {
              showAlert('Error', e?.message || 'Could not cancel');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function doCall() {
    if (!job?.customerPhone) {
      showAlert('No phone number', "The customer's phone number isn't available yet.");
      return;
    }
    callPhoneDirect(job.customerPhone);
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    accepted: { label: 'On The Way', color: isDark ? '#818cf8' : '#4f46e5', bg: isDark ? '#1e1b4b' : '#eef2ff' },
    arrived: { label: 'On Site', color: isDark ? '#34d399' : '#059669', bg: isDark ? '#052e1a' : '#ecfdf5' },
    completed: { label: 'Completed', color: isDark ? '#fbbf24' : '#d97706', bg: isDark ? '#422006' : '#fffbeb' },
  };
  const sc = statusConfig[status] || statusConfig.accepted;

  const snapPoints = useMemo(() => ['35%', '55%', '80%'], []);
  const [tileMode, setTileMode] = useState<'default' | 'satellite'>('default');
  const [currentSnapIndex, setCurrentSnapIndex] = useState(1); // initial is 1 (55%)

  const prevStatus = useRef(initialJob?.status);

  useEffect(() => {
    if (prevStatus.current !== 'arrived' && job?.status === 'arrived' && !job?.otpVerified) {
      (navigation as any).navigate('WorkerOtp', { jobId: job.id, customerName: job.customerName });
    }
    prevStatus.current = job?.status;
  }, [job?.status, job?.otpVerified, job?.id, job?.customerName, navigation]);

  const handleSnapIndexChange = useCallback((index: number) => {
    setCurrentSnapIndex(index);
  }, []);

  const handleToggleTile = useCallback(() => {
    setTileMode(prev => prev === 'default' ? 'satellite' : 'default');
  }, []);

  // Calculate button bottom position based on snap point
  const buttonBottom = useMemo(() => {
    const snapValue = snapPoints[currentSnapIndex] as string;
    const snapPercent = parseFloat(snapValue) / 100;
    const { height } = Dimensions.get('window');
    return height * snapPercent + 16; // Add margin above the panel
  }, [currentSnapIndex, snapPoints]);

  const handleSheetBackground = useCallback(({ style }: any) => (
    <View style={[style, { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }]} />
  ), [colors.bg]);

  const handleIndicator = useCallback(() => (
    <View style={styles.handleBar}>
      <View style={[styles.handle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
    </View>
  ), [isDark]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Map */}
      <View style={styles.mapWrap}>
        <LeafletMap
          worker={workerLoc}
          customer={customerLoc}
          tileMode={tileMode}
          onToggleTile={handleToggleTile}
        />
      </View>

      {/* Satellite toggle button - positioned above the panel 
      <View style={[styles.tileBtnContainer, { bottom: buttonBottom }]}>
        <TouchableOpacity
          onPress={handleToggleTile}
          style={[styles.tileBtn, { backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)' }]}
          activeOpacity={0.8}
        >
          <Layers size={18} color={isDark ? '#818cf8' : '#4f46e5'} strokeWidth={2.5} />
          <Text style={[styles.tileBtnText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
            {tileMode === 'default' ? 'Satellite' : 'Map'}
          </Text>
        </TouchableOpacity>
      </View>*/}

      {/* Bottom Sheet */}
      <DraggablePanel
        snapPoints={snapPoints}
        initialSnapIndex={1}
        style={styles.sheetShadow}
        onSnapIndexChange={handleSnapIndexChange}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) }}
          showsVerticalScrollIndicator={false}
        >
          {/* Customer Row + Status */}
          <View style={styles.topRow}>
            <View style={[styles.avatar, { backgroundColor: isDark ? '#4f46e5' : '#4f46e5' }]}>
              <Text style={styles.avatarLetter}>
                {(job.customerName || 'C').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.custInfo}>
              <Text style={[styles.custName, { color: colors.text }]} numberOfLines={1}>
                {job.customerName || 'Customer'}
              </Text>
              <Text style={[styles.custSub, { color: colors.textMuted }]} numberOfLines={1}>
                {job.jobType}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
              <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>

          {/* Stats Strip */}
          <View style={styles.statsRow}>
            {job.address ? (
              <View style={[styles.infoRow, { borderColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                <MapPin size={14} color={isDark ? '#818cf8' : '#4f46e5'} />
                <Text style={[styles.infoText, { color: colors.textMuted }]} numberOfLines={1}>{job.address}</Text>
              </View>
            ) : null}
            <View style={styles.statCards}>
              <View style={[styles.statCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Wallet size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
                <Text style={[styles.statVal, { color: colors.text }]}>₹{job.basePrice}</Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>Base</Text>
              </View>
              {job.addOnsTotal ? (
                <View style={[styles.statCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <Wallet size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
                  <Text style={[styles.statVal, { color: colors.text }]}>₹{job.addOnsTotal}</Text>
                  <Text style={[styles.statLbl, { color: colors.textMuted }]}>Add-ons</Text>
                </View>
              ) : null}
              <View style={[styles.statCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Route size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
                <Text style={[styles.statVal, { color: colors.text }]}>₹{job.perKmRate}</Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>Per km</Text>
              </View>
            </View>
          </View>

          {/* Actions by status */}
          {status === 'accepted' ? (
            <View style={styles.actions}>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                  onPress={doStartNavigation}
                  disabled={!customerLoc}
                  activeOpacity={0.8}
                >
                  <Navigation size={20} color={isDark ? '#818cf8' : '#4f46e5'} strokeWidth={2.5} />
                  <Text style={[styles.navBtnText, { color: isDark ? '#818cf8' : '#4f46e5' }]}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doCall} style={styles.phoneBtn} activeOpacity={0.8}>
                  <Phone size={20} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
              <View style={{ height: 14 }} />
              <SwipeConfirm label="Swipe → I have reached" onConfirm={doArrived} disabled={busy} />
            </View>
          ) : null}

          {status === 'arrived' && !job.otpVerified ? (
            <View style={styles.actions}>
              <View style={[styles.otpCard, { backgroundColor: isDark ? '#1e1b4b' : '#eef2ff', borderColor: isDark ? '#312e81' : '#c7d2fe' }]}>
                <KeyRound size={24} color={isDark ? '#818cf8' : '#4f46e5'} />
                <Text style={[styles.otpTitle, { color: colors.text }]}>Enter OTP from Customer</Text>
                <Text style={[styles.otpHint, { color: colors.textMuted }]}>Ask the customer for the 4-digit code shown on their phone</Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#4f46e5', marginTop: 12 }]}
                  onPress={() => (navigation as any).navigate('WorkerOtp', { jobId: job.id, customerName: job.customerName })}
                  activeOpacity={0.85}
                >
                  <KeyRound size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Enter OTP</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {status === 'arrived' && job.otpVerified ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.successBtn}
                onPress={doComplete}
                disabled={busy}
                activeOpacity={0.8}
              >
                <CheckCircle2 size={22} color="#fff" strokeWidth={2.5} />
                <Text style={styles.actionBtnText}>Work Completed</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {status === 'completed' ? (
            <View style={styles.actions}>
              <View style={[styles.collectCard, { backgroundColor: isDark ? '#052e1a' : '#dcfce7', borderColor: isDark ? '#166534' : '#bbf7d0' }]}>
                <Text style={[styles.collectLabel, { color: isDark ? '#4ade80' : '#16a34a' }]}>
                  Collect from customer
                </Text>
                <Text style={[styles.collectPrice, { color: isDark ? '#fff' : '#14532d' }]}>
                  ₹{finalPriceGuess}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: isDark ? '#4f46e5' : '#4f46e5' }]}
                onPress={doPaymentReceived}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Wallet size={20} color="#fff" strokeWidth={2.5} />
                <Text style={styles.actionBtnText}>Payment Received</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {status === 'cancelled' || status === 'expired' ? (
            <View style={[styles.terminalCard, { backgroundColor: isDark ? '#1c1917' : '#fef2f2', borderColor: isDark ? '#450a0a' : '#fecaca' }]}>
              <View style={[styles.terminalIcon, { backgroundColor: isDark ? '#450a0a' : '#fee2e2' }]}>
                <X size={40} color="#ef4444" />
              </View>
              <Text style={[styles.terminalTitle, { color: colors.text }]}>
                {status === 'expired' ? 'Job expired' : 'Job cancelled'}
              </Text>
              <Text style={[styles.terminalSub, { color: colors.textMuted }]}>
                {job.cancelledBy === 'customer' ? 'The customer cancelled.' : 'This job is no longer active.'}
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: isDark ? '#4f46e5' : '#4f46e5', marginTop: 20, width: '100%' }]}
                onPress={() => { clear(); onCancel?.(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Back to dashboard</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Cancel link */}
          {status === 'accepted' || status === 'arrived' ? (
            <TouchableOpacity onPress={doCancel} disabled={busy} style={styles.cancelBtn} activeOpacity={0.7}>
              <X size={14} color={isDark ? '#f87171' : '#dc2626'} />
              <Text style={[styles.cancelText, { color: isDark ? '#f87171' : '#dc2626' }]}>Cancel Job</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </DraggablePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, fontWeight: '500' },
  mapWrap: { flex: 1 },

  sheetShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 24,
  },
  handleBar: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetter: { color: '#fff', fontSize: 20, fontWeight: '800' },
  custInfo: { flex: 1 },
  custName: { fontSize: 17, fontWeight: '800' },
  custSub: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  statsRow: { marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  infoText: { fontSize: 13, fontWeight: '500', flex: 1 },
  statCards: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statVal: { fontSize: 17, fontWeight: '800' },
  statLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  actions: { marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 12 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  navBtnText: { fontSize: 16, fontWeight: '800' },
  phoneBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  collectCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
  },
  collectLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  collectPrice: { fontSize: 44, fontWeight: '900', marginTop: 6 },

  terminalCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  terminalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  terminalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 6 },
  terminalSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
  tileBtnContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
  },
  tileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  tileBtnText: { fontSize: 13, fontWeight: '700' },

  // OTP styles
  otpCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  otpTitle: { fontSize: 18, fontWeight: '800' },
  otpHint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  otpInputRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  otpBox: {
    width: 52,
    height: 58,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: { fontSize: 28, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  otpErrorText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },


});
