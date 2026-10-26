import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { SafeScreen } from '../components/SafeScreen';
import { api, CommissionStatus } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Info,
  Lock,
  TrendingUp,
  ShieldCheck,
  Plus,
  Star,
  Zap,
} from 'lucide-react-native';

type Props = {
  onBack: () => void;
  onPayNow: (amount: number, isPremium: boolean) => void;
};

export function CommissionScreen({ onBack, onPayNow }: Props) {
  const { colors, isDark } = useTheme();
  const [status, setStatus] = useState<CommissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barAnim = React.useRef(new Animated.Value(0)).current;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const s = await api.getCommission();
      setStatus(s);
      setError(null);
      // Animate the progress bar fill
      const pct = Math.min(s.balance / s.limit, 1);
      Animated.spring(barAnim, {
        toValue: pct,
        useNativeDriver: false,
        tension: 40,
        friction: 8,
      }).start();
    } catch (e: any) {
      setError(e?.message || 'Failed to load commission data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [barAnim]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading) {
    return (
      <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeScreen>
    );
  }

  if (error || !status) {
    return (
      <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={[styles.header]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error || 'No data'}</Text>
          <TouchableOpacity onPress={() => load()} style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  const { balance, limit, prepaidCredit, isBlocked, completedJobs, currentRate } = status;
  const pct = Math.min(balance / limit, 1);
  const remaining = Math.max(limit - balance, 0);
  const standardPayAmount = Math.ceil(balance);
  const extraPayAmount = Math.ceil(balance) + 500;

  const barColor = pct >= 1 ? '#EF4444' : pct >= 0.8 ? '#F97316' : pct >= 0.6 ? '#EAB308' : '#22C55E';

  const rateLabel = `${currentRate}%`;
  const nextMilestone = completedJobs < 10 ? `${10 - completedJobs} jobs to reach tier 2` : null;

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={[styles.pageTitle, { color: colors.text }]}>Fees to Pay</Text>
        <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
          Fees are added automatically after every completed job.
        </Text>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: isDark ? '#1e1b4b' : '#f5f3ff', borderColor: isDark ? '#312e81' : '#ede9fe' }]}>
          <View style={styles.totalDueRow}>
            <Text style={[styles.totalDueText, { color: colors.text }]}>Total Due</Text>
            <Info size={14} color={colors.textMuted} />
          </View>
          
          <View style={styles.amountRow}>
            <Text style={[styles.hugeAmount, { color: '#6d28d9' }]}>₹{balance.toFixed(0)}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.limitText, { color: colors.text }]}>of ₹{limit} limit</Text>
              <Text style={styles.viewDetailsText}>View details &gt;</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={[styles.barTrack, { backgroundColor: isDark ? '#312e81' : '#e5e7eb' }]}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: '#6d28d9',
                  width: barAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.barLabelsRow}>
            <Text style={[styles.barLabelText, { color: colors.textMuted }]}>₹{balance.toFixed(0)} used</Text>
            <Text style={[styles.barLabelText, { color: colors.textMuted }]}>₹{remaining.toFixed(0)} remaining</Text>
          </View>

          {/* Shield Row */}
          <View style={styles.shieldRow}>
            <ShieldCheck size={16} color="#6d28d9" />
            <Text style={[styles.shieldText, { color: colors.text }]}>
              You can keep accepting jobs until you reach ₹{limit}.
            </Text>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.payNowBtn}
          onPress={() => onPayNow(standardPayAmount, false)}
          activeOpacity={0.85}
        >
          <CreditCard size={18} color="#fff" />
          <Text style={styles.payNowText}>Pay Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addMoneyBtn, { borderColor: isDark ? '#334155' : '#e5e7eb' }]}
          onPress={() => onPayNow(extraPayAmount, true)}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#6d28d9" />
          <Text style={styles.addMoneyText}>Add Money</Text>
        </TouchableOpacity>

        {/* Commission section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Commission</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.commTopRow}>
            <View style={[styles.rateBadgeBox, { backgroundColor: isDark ? '#14532D' : '#dcfce7' }]}>
              <Text style={[styles.rateBadgeVal, { color: '#16a34a' }]}>{rateLabel}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.rateInfoTitle, { color: colors.text }]}>Current rate</Text>
              <Text style={[styles.rateInfoSub, { color: colors.textMuted }]}>per job</Text>
            </View>
            <View style={[styles.goodStartBadge, { backgroundColor: isDark ? '#14532D' : '#dcfce7' }]}>
              <TrendingUp size={14} color="#16a34a" />
              <Text style={[styles.goodStartText, { color: '#16a34a' }]}>Good start!</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          <View style={styles.commProgressRow}>
            <Lock size={14} color={colors.textMuted} />
            <Text style={[styles.commProgressText, { color: colors.textMuted }]}>
              {completedJobs < 4 ? `Complete ${4 - completedJobs} more jobs to unlock 8% rate` : 
               completedJobs < 10 ? `Complete ${10 - completedJobs} more jobs to unlock 5% rate` : 
               `You've unlocked the best rates!`}
            </Text>
            <Text style={[styles.commProgressRatio, { color: '#6d28d9' }]}>
              {completedJobs < 4 ? `${completedJobs} / 4 done` : 
               completedJobs < 10 ? `${completedJobs} / 10 done` : ''}
            </Text>
          </View>
          <View style={[styles.barTrackSmall, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
            <View
              style={[
                styles.barFillSmall,
                {
                  backgroundColor: '#16a34a',
                  width: completedJobs < 4 ? `${(completedJobs / 4) * 100}%` : 
                         completedJobs < 10 ? `${(completedJobs / 10) * 100}%` : '100%',
                },
              ]}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent fee additions</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity style={styles.viewAllRow}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoBoxCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
          <Info size={16} color="#d97706" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.infoBoxTitle, { color: '#92400e' }]}>Why do I have to pay fees?</Text>
            <Text style={[styles.infoBoxSub, { color: '#92400e' }]}>
              This helps us provide you with jobs and support.
            </Text>
          </View>
          <ChevronRight size={16} color="#d97706" />
        </View>

      </ScrollView>
    </SafeScreen>
  );
}



const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 20, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  
  pageTitle: { fontSize: 28, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },

  balanceCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  totalDueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  totalDueText: { fontSize: 14, fontWeight: '500' },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  hugeAmount: { fontSize: 44, fontWeight: '800', lineHeight: 48, letterSpacing: -1 },
  limitText: { fontSize: 13, fontWeight: '600' },
  viewDetailsText: { fontSize: 12, color: '#6d28d9', marginTop: 4, fontWeight: '500' },

  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 4 },
  barLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  barLabelText: { fontSize: 12 },

  shieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shieldText: { fontSize: 13, fontWeight: '500' },

  payNowBtn: {
    backgroundColor: '#6d28d9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  payNowText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 32,
  },
  addMoneyText: { color: '#6d28d9', fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },

  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  commTopRow: { flexDirection: 'row', alignItems: 'center' },
  rateBadgeBox: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  rateBadgeVal: { fontSize: 18, fontWeight: '700' },
  rateInfoTitle: { fontSize: 15, fontWeight: '600' },
  rateInfoSub: { fontSize: 13 },
  goodStartBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  goodStartText: { fontSize: 12, fontWeight: '600' },

  divider: { height: 1, marginVertical: 16 },
  
  commProgressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  commProgressText: { fontSize: 13, flex: 1, marginLeft: 8 },
  commProgressRatio: { fontSize: 13, fontWeight: '600' },
  barTrackSmall: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFillSmall: { height: '100%', borderRadius: 3 },

  viewAllRow: { alignItems: 'center', paddingVertical: 4 },
  viewAllText: { color: '#6d28d9', fontSize: 14, fontWeight: '600' },

  infoBoxCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoBoxTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  infoBoxSub: { fontSize: 13, lineHeight: 18 },
  
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  howStep: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  howStepText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  howText: { flex: 1, fontSize: 13, lineHeight: 19 },

  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
