import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound, CheckCircle2, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../services/api';

export function WorkerOtpScreen({ jobId, customerName, onBack, onVerified }: { jobId: string, customerName?: string, onBack: () => void, onVerified: () => void }) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const doVerifyOtp = async () => {
    if (otpInput.length < 4) return;
    setVerifying(true);
    setOtpError('');
    try {
      await api.verifyOtp(jobId, otpInput);
      onVerified();
    } catch (e: any) {
      const msg = e?.message === 'invalid_otp' ? 'Incorrect OTP. Please try again.' : (e?.message || 'Verification failed');
      setOtpError(msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Enter OTP</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' }]}>
          <KeyRound size={48} color={isDark ? '#818cf8' : '#4f46e5'} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Customer OTP</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Ask {customerName || 'the customer'} for the 4-digit code shown on their app to start the work.
        </Text>

        <View style={styles.inputContainer}>
          <View style={styles.otpRow}>
            {[0,1,2,3].map(i => (
              <View 
                key={i} 
                style={[
                  styles.otpBox, 
                  { 
                    borderColor: otpError ? '#EF4444' : (otpInput[i] ? '#4f46e5' : (isDark ? '#334155' : '#cbd5e1')), 
                    backgroundColor: isDark ? '#0f172a' : '#fff' 
                  }
                ]}
              >
                <Text style={[styles.otpDigit, { color: colors.text }]}>{otpInput[i] || ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            value={otpInput}
            onChangeText={t => { setOtpInput(t.replace(/[^0-9]/g, '').slice(0, 4)); setOtpError(''); }}
            keyboardType="number-pad"
            maxLength={4}
            style={styles.hiddenInput}
            autoFocus
          />
          {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: '#4f46e5', opacity: otpInput.length < 4 || verifying ? 0.5 : 1 }]}
          onPress={doVerifyOtp}
          disabled={verifying || otpInput.length < 4}
          activeOpacity={0.85}
        >
          {verifying ? <ActivityIndicator color="#fff" /> : <CheckCircle2 size={24} color="#fff" />}
          <Text style={styles.btnText}>{verifying ? 'Verifying...' : 'Verify & Start Work'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 56,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 16,
  },
  otpBox: {
    width: 60,
    height: 72,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    fontSize: 32,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
