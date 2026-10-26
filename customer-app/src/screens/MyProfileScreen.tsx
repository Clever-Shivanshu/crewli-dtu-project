import { SafeScreen } from '../components/SafeScreen';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  User,
  MapPin,
  Phone,
  LogOut,
  ChevronRight,
  Clock,
  Star,
  RefreshCw,
  Info,
  Shield,
  Bell,
  HelpCircle,
  ChevronLeft,
  X,
} from 'lucide-react-native';
import { useApp } from '../store/app';
import { useTheme } from '../theme/ThemeContext';
import { api, Job } from '../services/api';
import { API_BASE_URL } from '../config';

type Props = {
  onClose: () => void;
  onLogout?: () => void;
  onRebook?: (job: Job) => void;
};

// Reusable floating confirm panel
function FloatPanel({
  visible,
  title,
  message,
  icon: Icon,
  iconColor,
  onConfirm,
  onCancel,
  confirmText,
  confirmColor,
}: {
  visible: boolean;
  title: string;
  message: string;
  icon: any;
  iconColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText: string;
  confirmColor: string;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={panel.backdrop} />
      </TouchableWithoutFeedback>
      <View style={panel.container}>
        <View style={[panel.sheet, { backgroundColor: colors.bg }]}>
          <View style={[panel.iconBox, { backgroundColor: iconColor + '18' }]}>
            <Icon size={28} color={iconColor} />
          </View>
          <Text style={[panel.title, { color: colors.text }]}>{title}</Text>
          <Text style={[panel.message, { color: colors.textMuted }]}>{message}</Text>
          <View style={panel.btnRow}>
            <TouchableOpacity
              style={[panel.btn, panel.cancelBtn, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}
              onPress={onCancel}
            >
              <Text style={[panel.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[panel.btn, panel.confirmBtn, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
            >
              <Text style={panel.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function MyProfileScreen({ onClose, onRebook, onLogout }: Props) {
  const { colors, isDark } = useTheme();
  const customerId = useApp((s) => s.customerId);
  const phone = useApp((s) => s.phone);
  const name = useApp((s) => s.name);
  const address = useApp((s) => s.address);
  const imageUrl = useApp((s) => s.imageUrl);

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (customerId) {
      api.getCustomerJobs(customerId).then(res => setJobs(res.jobs)).catch(() => { });
    }
  }, [customerId]);

  function doLogout() {
    setLogoutVisible(false);
    useApp.getState().clearAuth();
    if (onLogout) onLogout();
    else onClose();
  }

  function SettingRow({
    icon: Icon,
    iconColor,
    label,
    onPress,
    sublabel,
    danger,
  }: {
    icon: any;
    iconColor: string;
    label: string;
    sublabel?: string;
    onPress?: () => void;
    danger?: boolean;
  }) {
    return (
      <TouchableOpacity
        style={[styles.settingRow, { borderBottomColor: colors.cardBorder }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.settingIcon, { backgroundColor: iconColor + '18' }]}>
          <Icon size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: danger ? colors.danger : colors.text }]}>
            {label}
          </Text>
          {sublabel && (
            <Text style={[styles.settingSubLabel, { color: colors.textFaint }]}>{sublabel}</Text>
          )}
        </View>
        <ChevronRight size={16} color={colors.textFaint} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.profileTop}>
            {imageUrl && !imgError ? (
              <Image
                source={{ uri: imageUrl.startsWith('http') || imageUrl.startsWith('file') || imageUrl.startsWith('content') ? imageUrl : `${API_BASE_URL}${imageUrl}` }}
                style={styles.avatarImage}
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#311090' }]}>
                <Text style={styles.avatarText}>{(name || 'U')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.text }]}>{name || 'User'}</Text>
              <View style={styles.infoRow}>
                <Phone size={13} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.textMuted }]}>+91 {phone}</Text>
              </View>
              {address ? (
                <View style={styles.infoRow}>
                  <MapPin size={13} color={colors.textMuted} />
                  <Text style={[styles.infoText, { color: colors.textMuted }]} numberOfLines={1}>{address}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Stats Row */}
          {/* <View style={[styles.statsRow, { borderTopColor: colors.cardBorder }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.text }]}>{jobs.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Bookings</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                ₹{jobs.reduce((sum, j) => sum + (j.finalPrice || j.basePrice || 0), 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Spent</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.text }]}>4.9</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rating</Text>
            </View>
          </View> */}
        </View>

          {/* Recent Bookings */}
          <View style={styles.sectionHeader}>
            <Clock size={18} color={colors.text} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Bookings</Text>
          </View>

          {jobs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No bookings yet.</Text>
          ) : (
            jobs.slice(0, 5).map((job) => (
              <View key={job.id} style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.bookingTop}>
                  <View>
                    <Text style={[styles.bookingCategory, { color: colors.text }]}>{job.category || job.jobType}</Text>
                    <Text style={[styles.bookingIssue, { color: colors.textMuted }]}>{job.subProblemTitle || job.jobType}</Text>
                  </View>
                  <View style={[styles.statusBadge, job.status === 'completed' || job.status === 'paid' ? { backgroundColor: '#10b98120' } : { backgroundColor: '#f59e0b20' }]}>
                    <Text style={[styles.statusText, job.status === 'completed' || job.status === 'paid' ? { color: '#10b981' } : { color: '#f59e0b' }]}>
                      {job.status === 'paid' ? 'Completed' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.bookingBottom, { borderTopColor: colors.cardBorder }]}>
                  <Text style={[styles.bookingDate, { color: colors.textMuted }]}>
                    {new Date(job.createdAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.bookingActions}>
                    <Text style={[styles.bookingPrice, { color: colors.text }]}>₹{job.finalPrice || job.basePrice}</Text>
                    <TouchableOpacity
                      style={styles.rebookBtn}
                      onPress={() => onRebook?.(job)}
                    >
                      <RefreshCw size={12} color="#311090" style={{ marginRight: 4 }} />
                      <Text style={styles.rebookText}>Rebook</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Settings */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings & Support</Text>
          </View>

          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <SettingRow
              icon={Bell}
              iconColor="#f59e0b"
              label="Notifications"
              sublabel="Manage push & SMS alerts"
              onPress={() => setActivePanel('notifications')}
            />
            <SettingRow
              icon={Shield}
              iconColor="#10b981"
              label="Privacy & Security"
              sublabel="Data, account & permissions"
              onPress={() => setActivePanel('privacy')}
            />
            <SettingRow
              icon={HelpCircle}
              iconColor="#6366f1"
              label="Help & Support"
              sublabel="FAQs, chat support"
              onPress={() => setActivePanel('help')}
            />
            <SettingRow
              icon={Info}
              iconColor="#3b82f6"
              label="About Crewli"
              sublabel="Version 1.0.0 · Terms & Privacy"
              onPress={() => setActivePanel('about')}
            />
            <SettingRow
              icon={LogOut}
              iconColor="#ef4444"
              label="Logout"
              danger
              onPress={() => setLogoutVisible(true)}
            />
          </View>

          <Text style={[styles.versionText, { color: colors.textFaint }]}>
            Crewli · Made with ❤️ for India · v1.0.0
          </Text>
      </ScrollView>

      {/* Logout Floating Panel */}
      <FloatPanel
        visible={logoutVisible}
        title="Log out?"
        message="You'll need to sign in again the next time you use Crewli."
        icon={LogOut}
        iconColor="#ef4444"
        onConfirm={doLogout}
        onCancel={() => setLogoutVisible(false)}
        confirmText="Yes, Logout"
        confirmColor="#ef4444"
      />

      {/* Settings Floating Panels */}
      <FloatPanel
        visible={activePanel === 'notifications'}
        title="Notifications"
        message="All your push and SMS notifications are currently enabled."
        icon={Bell}
        iconColor="#f59e0b"
        onConfirm={() => setActivePanel(null)}
        onCancel={() => setActivePanel(null)}
        confirmText="Done"
        confirmColor="#311090"
      />
      <FloatPanel
        visible={activePanel === 'privacy'}
        title="Privacy & Security"
        message="Your data is safe with us. We use industry-standard encryption to protect your account."
        icon={Shield}
        iconColor="#10b981"
        onConfirm={() => setActivePanel(null)}
        onCancel={() => setActivePanel(null)}
        confirmText="Done"
        confirmColor="#311090"
      />
      <FloatPanel
        visible={activePanel === 'help'}
        title="Help & Support"
        message="Need help? Contact our support team at +91 7011920806."
        icon={HelpCircle}
        iconColor="#6366f1"
        onConfirm={() => setActivePanel(null)}
        onCancel={() => setActivePanel(null)}
        confirmText="Contact Support"
        confirmColor="#311090"
      />
      <FloatPanel
        visible={activePanel === 'about'}
        title="About Crewli"
        message={'Version 1.0.0\n\nMade by Shivanshu.\nUI/UX by Shourya.'}
        icon={Info}
        iconColor="#3b82f6"
        onConfirm={() => setActivePanel(null)}
        onCancel={() => setActivePanel(null)}
        confirmText="Close"
        confirmColor="#311090"
      />
    </SafeScreen>
  );
}

const panel = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sheet: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { borderWidth: 1 },
  confirmBtn: {},
  cancelText: { fontSize: 15, fontWeight: '600' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 48 },

  profileCard: {
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#311090',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  profileName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  infoText: { fontSize: 13, flex: 1 },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statDivider: { width: 1, marginVertical: 4 },

  sectionHeader: { marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 14, textAlign: 'center', marginVertical: 20 },

  bookingCard: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  bookingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  bookingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryDotText: { fontSize: 16, fontWeight: '800' },
  bookingCategory: { fontSize: 15, fontWeight: '700' },
  bookingIssue: { fontSize: 12, marginTop: 2 },
  bookingRight: { alignItems: 'flex-end', gap: 4 },
  bookingPrice: { fontSize: 17, fontWeight: '900' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  bookingBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  bookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookingDate: { fontSize: 12 },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rebookText: { color: '#311090', fontSize: 12, fontWeight: '700' },

  settingsCard: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingSubLabel: { fontSize: 12, marginTop: 1 },

  versionText: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});