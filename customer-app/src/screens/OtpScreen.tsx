import { SafeScreen } from '../components/SafeScreen';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { api } from '../services/api';
import { useApp } from '../store/app';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
  phone: string;
  devOtp?: string;
  onVerified: () => void;
  onBack: () => void;
};

export function OtpScreen({ phone, devOtp, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState(devOtp || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = useRef<(TextInput | null)[]>([null, null, null, null]);
  const digits = otp.split('').concat(['', '', '', '']).slice(0, 4);

  useEffect(() => { if (devOtp) setOtp(devOtp); }, []);

  async function verify() {
    if (otp.length < 4) { setError('Enter the full 4-digit OTP'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyOtp(phone, otp);
      useApp.getState().setPhone(phone);
      useApp.getState().setCustomerId(res.customerId);
      if (res.profile) {
        if (res.profile.name) useApp.getState().setName(res.profile.name);
        if (res.profile.address) useApp.getState().setAddress(res.profile.address);
        if (res.profile.location) useApp.getState().setLocation(res.profile.location);
        if (res.profile.imageUrl) useApp.getState().setImageUrl(res.profile.imageUrl);
        
        // Load saved addresses if any, otherwise clear them
        const currentAddresses = useApp.getState().savedAddresses;
        if (res.profile.savedAddresses?.length) {
          // Add them, avoiding duplicates by ID
          res.profile.savedAddresses.forEach((a: any) => {
            if (!currentAddresses.find(ca => ca.id === a.id)) {
              useApp.getState().addSavedAddress(a);
            }
          });
        }
      }
      onVerified();
    } catch (e: any) {
      setError(e?.message || 'Incorrect OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleDigit(val: string, idx: number) {
    const d = val.replace(/[^0-9]/g, '').slice(-1);
    const arr = otp.split('').concat(['', '', '', '']).slice(0, 4);
    arr[idx] = d;
    const next = arr.join('');
    setOtp(next);
    setError(null);
    if (d && idx < 3) inputs.current[idx + 1]?.focus();
  }

  function handleKeyPress(e: any, idx: number) {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FDFBFF', '#F4F0FF', '#EBE4FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, zIndex: 10 }}
      >
        <SafeScreen style={{ flex: 1 }}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft size={24} color="#311090" />
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image source={require('../images/main.png')} style={styles.logo} resizeMode="contain" />
            </View>

            <Text style={styles.title}>Verify your{'\n'}number</Text>
            <Text style={styles.subtitle}>
              We sent a 4-digit code to{'\n'}
              <Text style={styles.phoneHighlight}>+91 {phone}</Text>
            </Text>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
              {[0, 1, 2, 3].map((i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  value={digits[i]}
                  onChangeText={(v) => handleDigit(v, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={i === 0}
                  style={[
                    styles.otpBox,
                    digits[i] ? styles.otpBoxFilled : {},
                    error ? styles.otpBoxError : {},
                  ]}
                  selectionColor="#311090"
                />
              ))}
            </View>

            {error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {devOtp ? (
              <Text style={styles.devHint}>Dev OTP: {devOtp}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={verify}
              disabled={busy || otp.length < 4}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnText}>Verify & Continue</Text>
                  <ArrowRight size={20} color="#fff" style={{ position: 'absolute', right: 24 }} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendWrap} onPress={onBack}>
              <Text style={styles.resendText}>Didn't receive the code?{' '}</Text>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          </View>
        </SafeScreen>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: {
    margin: 16,
    marginTop: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(49,16,144,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -80,
  },
  logoContainer: { marginBottom: 32, alignItems: 'center' },
  logo: { width: 180, height: 60 },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1F1245',
    textAlign: 'center',
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 36,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
  },
  phoneHighlight: { color: '#311090', fontWeight: '700' },
  otpRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  otpBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D8D4E5',
    backgroundColor: '#FAFAFA',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1F1245',
  },
  otpBoxFilled: {
    borderColor: '#311090',
    backgroundColor: '#F4F0FF',
  },
  otpBoxError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff1f1',
  },
  errorWrap: {
    marginTop: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  devHint: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
  btn: {
    marginTop: 28,
    borderRadius: 12,
    backgroundColor: '#311090',
    width: '100%',
    height: 56,
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendWrap: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: { color: '#6B7280', fontSize: 14 },
  resendLink: { color: '#311090', fontWeight: '700', fontSize: 14 },
});
