/**
 * CommissionPaymentScreen — Fake UPI payment UI.
 *
 * NOTE: This is an intentionally fake payment screen for demo/MVP purposes.
 * No real money is transferred. On "Pay" the app waits 2.5s (simulating
 * network auth) then calls api.payCommission(amount) to update the backend
 * balance and shows a success animation.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeScreen } from '../components/SafeScreen';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../services/api';
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react-native';

type Stage = 'input' | 'processing' | 'success';

type Props = {
  amount: number;
  isPremium: boolean;
  onBack: () => void;
  onSuccess: (result: { newBalance: number; prepaidCredit: number; bonusCreditAdded: number }) => void;
};

export function CommissionPaymentScreen({ amount, isPremium, onBack, onSuccess }: Props) {
  const { colors, isDark } = useTheme();
  const [upiId, setUpiId] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [error, setError] = useState<string | null>(null);

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;
  const spinRef   = useRef<Animated.CompositeAnimation | null>(null);

  function startSpin() {
    spinRef.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.linear })
    );
    spinRef.current.start();
  }
  function stopSpin() { spinRef.current?.stop(); spinAnim.setValue(0); }

  function popCheck() {
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }).start();
  }

  async function handlePay() {
    setError(null);
    setStage('processing');
    startSpin();

    // Simulate network delay (fake auth handshake)
    await new Promise<void>((res) => setTimeout(res, 2500));

    try {
      const result = await api.payCommission(amount);
      stopSpin();
      setStage('success');
      popCheck();
      // Let the checkmark animate for 1.4s then call onSuccess
      setTimeout(() => {
        onSuccess({
          newBalance: result.newBalance,
          prepaidCredit: result.prepaidCredit,
          bonusCreditAdded: result.bonusCreditAdded,
        });
      }, 1400);
    } catch (e: any) {
      stopSpin();
      setStage('input');
      setError(e?.message || 'Payment failed. Please try again.');
    }
  }

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={onBack} disabled={stage !== 'input'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={stage !== 'input' ? colors.textFaint : colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pay Commission</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ───── SUCCESS STATE ───── */}
          {stage === 'success' && (
            <View style={styles.successContainer}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <View style={styles.checkCircle}>
                  <CheckCircle2 size={72} color="#22C55E" />
                </View>
              </Animated.View>
              <Text style={[styles.successTitle, { color: colors.text }]}>Payment Successful!</Text>
              <Text style={[styles.successSub, { color: colors.textMuted }]}>
                {isPremium ? `₹${amount} paid — bonus credit applied` : `₹${amount} paid`}
              </Text>
              <Text style={[styles.successNote, { color: colors.textFaint }]}>
                Your commission balance has been updated. Job offers will resume shortly.
              </Text>
            </View>
          )}

          {/* ───── PROCESSING STATE ───── */}
          {stage === 'processing' && (
            <View style={styles.processingContainer}>
              <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                <View style={[styles.spinnerRing, { borderTopColor: colors.accent }]} />
              </Animated.View>
              <Text style={[styles.processingTitle, { color: colors.text }]}>Authenticating...</Text>
              <Text style={[styles.processingSub, { color: colors.textMuted }]}>
                Verifying payment with UPI gateway
              </Text>
              <View style={[styles.secureChip, { backgroundColor: isDark ? '#14532D' : '#F0FDF4' }]}>
                <ShieldCheck size={13} color="#22C55E" />
                <Text style={styles.secureText}>256-bit encrypted</Text>
              </View>
            </View>
          )}

          {/* ───── INPUT STATE ───── */}
          {stage === 'input' && (
            <>
              {/* Amount summary card */}
              <View style={[styles.amountCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.amountLabel, { color: colors.textMuted }]}>Amount to pay</Text>
                <Text style={[styles.amountValue, { color: colors.text }]}>₹{amount}</Text>
                {isPremium && (
                  <View style={[styles.boostChip, { backgroundColor: isDark ? '#2E1065' : '#F3E8FF' }]}>
                    <Zap size={12} color="#7C3AED" />
                    <Text style={styles.boostChipText}>Includes bonus credit</Text>
                  </View>
                )}
                <Text style={[styles.amountNote, { color: colors.textMuted }]}>
                  Crewli Commission Payment  ·  Secure & Encrypted
                </Text>
              </View>

              {/* UPI section header */}
              <View style={[styles.methodHeader, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                <Smartphone size={16} color={colors.accent} />
                <Text style={[styles.methodHeaderText, { color: colors.text }]}>Pay via UPI</Text>
              </View>

              {/* UPI content */}
              <View style={[styles.tabContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>UPI ID</Text>
                <TextInput
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="yourname@upi"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}
                />
                <View style={[styles.payingToRow, { backgroundColor: isDark ? '#111827' : '#F8FAFC', borderColor: colors.cardBorder }]}>
                  <Text style={[styles.payingToLabel, { color: colors.textMuted }]}>Paying to</Text>
                  <Text style={[styles.payingToValue, { color: colors.text }]}>crewli@ybl</Text>
                </View>
                <View style={[styles.payingToRow, { backgroundColor: isDark ? '#111827' : '#F8FAFC', borderColor: colors.cardBorder }]}>
                  <Text style={[styles.payingToLabel, { color: colors.textMuted }]}>Merchant</Text>
                  <Text style={[styles.payingToValue, { color: colors.text }]}>Crewli Technologies</Text>
                </View>
                <View style={[styles.payingToRow, { backgroundColor: isDark ? '#111827' : '#F8FAFC', borderColor: colors.cardBorder }]}>
                  <Text style={[styles.payingToLabel, { color: colors.textMuted }]}>Remarks</Text>
                  <Text style={[styles.payingToValue, { color: colors.text }]}>Commission Payment</Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Secure badge */}
              <View style={styles.secureRow}>
                <ShieldCheck size={13} color="#22C55E" />
                <Text style={[styles.secureRowText, { color: colors.textMuted }]}>
                  Secured by 256-bit SSL encryption
                </Text>
              </View>

              {/* Pay button */}
              <TouchableOpacity
                style={[styles.payNowBtn, { backgroundColor: colors.accent, opacity: stage !== 'input' ? 0.5 : 1 }]}
                onPress={handlePay}
                disabled={stage !== 'input'}
                activeOpacity={0.85}
              >
                <Text style={styles.payNowBtnText}>Pay ₹{amount}</Text>
              </TouchableOpacity>

              <Text style={[styles.disclaimer, { color: colors.textFaint }]}>
                By paying, you agree to Crewli's commission terms. This amount will be deducted from your commission balance.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 48 },

  // Amount card
  amountCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  amountValue: { fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  boostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  boostChipText: { color: '#7C3AED', fontSize: 12, fontWeight: '600' },
  amountNote: { fontSize: 12, marginTop: 10, textAlign: 'center' },

  // Method header (replaces tab bar)
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  methodHeaderText: { fontSize: 15, fontWeight: '700' },

  tabContent: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14, gap: 10 },
  inputLabel: { fontSize: 13, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  payingToRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payingToLabel: { fontSize: 13 },
  payingToValue: { fontSize: 13, fontWeight: '600' },

  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 10 },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  secureRowText: { fontSize: 12 },

  payNowBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  payNowBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },

  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16 },

  // Processing
  processingContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 40, gap: 16 },
  spinnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: 'transparent',
    borderTopColor: '#3B82F6',
  },
  processingTitle: { fontSize: 22, fontWeight: '700' },
  processingSub: { fontSize: 14, textAlign: 'center' },
  secureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  secureText: { color: '#22C55E', fontSize: 13, fontWeight: '600' },

  // Success
  successContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 40, gap: 14 },
  checkCircle: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 26, fontWeight: '800' },
  successSub: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  successNote: { fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 280 },
});
