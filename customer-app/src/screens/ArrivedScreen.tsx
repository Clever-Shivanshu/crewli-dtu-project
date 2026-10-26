import { showAlert } from '../store/alert';
import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Linking,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ScrollView,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  MapPin,
  Phone,
  ShieldAlert,
  Star,
  Wallet,
  X,
  KeyRound,
  HelpCircle,
  Crosshair,
  Layers,
} from 'lucide-react-native';
import { api, Job } from '../services/api';
import { useApp } from '../store/app';
import { connectCustomerSocket } from '../services/socket';
import { callPhoneDirect } from '../services/callDirect';
import { LeafletMap, LeafletMapRef } from '../components/LeafletMap';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LatLng = { lat: number; lng: number };

type Props = {
  jobId: string;
  onPaid: () => void;
  onTerminal: () => void;
};

export function ArrivedScreen({ jobId, onPaid, onTerminal }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const customerLoc = useApp((s) => s.location);
  const customerAddress = useApp((s) => s.address);
  const [job, setJob] = useState<Job | null>(null);
  const [workerLoc, setWorkerLoc] = useState<LatLng | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const paidFired = useRef(false);
  const mapRef = useRef<LeafletMapRef>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    api.getJob(jobId).then((j) => {
      if (!alive) return;
      setJob(j);
      if (j.worker?.location) setWorkerLoc(j.worker.location);
    }).catch(() => { });

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

  useEffect(() => {
    if (!job) return;
    if (job.status === 'paid' && !paidFired.current) {
      paidFired.current = true;
      onPaid();
    }
    if (job.status === 'cancelled' || job.status === 'expired') onTerminal();
  }, [job?.status, onPaid, onTerminal]);

  function call() {
    const p = job?.worker?.phone;
    if (!p) return showAlert('Phone unavailable');
    callPhoneDirect(p);
  }

  function sosEmergency() {
    Linking.openURL('tel:112').catch(() => { });
    setSosOpen(false);
  }

  async function sosShareLocation() {
    const loc = customerLoc;
    const url = loc
      ? `https://maps.google.com/?q=${loc.lat},${loc.lng}`
      : 'location unknown';
    try {
      await Share.share({
        message: `SOS!! , I need help! I'm at: ${url}`,
      });
    } catch { }
    setSosOpen(false);
  }

  function sosReport() {
    showAlert(
      'Report safety issue',
      'Our safety team has been notified and will reach out within 2 minutes.',
      [{ text: 'OK' }]
    );
    setSosOpen(false);
  }

  const focusMap = () => {
    mapRef.current?.focusCurrentLocation();
  };

  if (!job) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
      </View>
    );
  }

  const finalPrice = job.finalPrice ?? Math.round(job.basePrice + (job.addOnsTotal || 0));
  const w = job.worker;

  // Determine header text based on status
  const getHeaderText = () => {
    if (job.otpVerified && job.status === 'arrived') return 'Work in progress';
    if (job.status === 'completed') return 'Work completed';
    return 'Worker has arrived';
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* Purple Header */}
      <View style={[styles.purpleHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <Text style={styles.headerSub}>{getHeaderText()}</Text>
        {w ? (
          <Text style={styles.headerWorkerName}>
            {w.name || 'Your worker'}
          </Text>
        ) : null}
      </View>

      {/* Map Section - Inline rounded card */}
      <View style={styles.mapSection}>
        <LeafletMap
          ref={mapRef}
          worker={workerLoc}
          customer={customerLoc}
          style={styles.map}
        />
        <TouchableOpacity
          onPress={focusMap}
          style={[styles.focusBtn, { backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)' }]}
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
        {/* Info Panel content */}
        <View style={[styles.infoPanel, { padding: 20 }]}>
          {/* Worker Row */}
          {w ? (
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
          ) : null}

          {/* OTP Display */}
          {job.otp && !job.otpVerified ? (
            <View style={[styles.otpCard, { backgroundColor: isDark ? '#1e1b4b' : '#eef2ff', borderColor: isDark ? '#312e81' : '#c7d2fe' }]}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                <View style={[styles.otpIconWrap, { backgroundColor: isDark ? '#312e81' : '#e0e7ff' }]}>
                  <KeyRound size={20} color="#4f46e5" strokeWidth={2.5} />
                </View>
                <Text style={[styles.otpTitle, { color: colors.text }]}>Share this OTP to start work</Text>
              </View>
              <View style={styles.otpDigitsRow}>
                {job.otp.split('').map((d: string, i: number) => (
                  <View key={i} style={[styles.otpDigitBox, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: '#4f46e5' }]}>
                    <Text style={[styles.otpDigitText, { color: '#4f46e5' }]}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Booking Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Booking Summary</Text>
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
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Amount to pay</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  ₹{finalPrice}
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

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Pay the worker directly once the work is done. They will confirm payment in the app.
          </Text>

          {/* Need Help */}
          <TouchableOpacity
            onPress={() => setSosOpen(true)}
            style={[styles.helpBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
            activeOpacity={0.8}
          >
            <HelpCircle size={18} color="#4f46e5" />
            <Text style={[styles.helpBtnText, { color: colors.text }]}>Need help?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* SOS Modal */}
      <Modal
        visible={sosOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSosOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSosOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.sosSheet, { backgroundColor: colors.bg, borderColor: colors.cardBorder }]}>
          <View style={styles.sosSheetHeader}>
            <Text style={[styles.sosSheetTitle, { color: colors.text }]}>Your safety comes first</Text>
            <TouchableOpacity onPress={() => setSosOpen(false)} hitSlop={12}>
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <SosRow
            Icon={AlertTriangle}
            color={colors.danger}
            title="Emergency call (112)"
            subtitle="Reach police / ambulance / fire immediately"
            onPress={sosEmergency}
          />
          <SosRow
            Icon={MapPin}
            color={colors.accent}
            title="Share my live location"
            subtitle="Send your map link to a trusted contact"
            onPress={sosShareLocation}
          />
          <SosRow
            Icon={Flag}
            color={colors.warn}
            title="Report safety issue"
            subtitle="Crewli safety team will reach out"
            onPress={sosReport}
          />
        </View>
      </Modal>
    </View>
  );
}

function SosRow({
  Icon,
  color,
  title,
  subtitle,
  onPress,
}: {
  Icon: any;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.sosRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
    >
      <View style={[styles.sosIcon, { backgroundColor: color + '22' }]}>
        <Icon size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sosRowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sosRowSub, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

const { height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Purple header
  purpleHeader: {
    backgroundColor: '#4f46e5',
    paddingBottom: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  headerWorkerName: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 },

  // Map section
  mapSection: {
    height: SCREEN_H * 0.30,
    position: 'relative',
  },
  map: { flex: 1 },
  focusBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },

  // Info panel
  infoPanel: { flex: 1 },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  statusBadgeText: { fontSize: 16, fontWeight: '800' },

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
  dot: { fontSize: 13 },
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

  hint: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 16, lineHeight: 18 },

  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  helpBtnText: { fontSize: 15, fontWeight: '700' },

  // OTP styles
  otpCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  otpIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  otpTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  otpDigitsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  otpDigitBox: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigitText: { fontSize: 24, fontWeight: '800' },

  // SOS Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sosSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 28,
  },
  sosSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sosSheetTitle: { fontSize: 18, fontWeight: '800' },
  sosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  sosIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosRowTitle: { fontSize: 15, fontWeight: '700' },
  sosRowSub: { fontSize: 12, marginTop: 2 },
});
