import { showAlert } from '../store/alert';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { api, ApiError, CachedWorker } from '../services/api';
import { fbGetToken } from '../services/firebase';
import { useAuth } from '../store/auth';

type Props = {
  name: string;
  initialPhone?: string;
  onVerified: (worker: CachedWorker) => void;
};

export function PhoneOtpScreen({ name, initialPhone = '', onVerified }: Props) {
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneValid = /^[0-9]{10}$/.test(phone);
  const otpValid = /^[0-9]{4,6}$/.test(otp);

  // If we arrived with a pre-filled phone (from Welcome), send OTP right away.
  useEffect(() => {
    if (initialPhone && /^[0-9]{10}$/.test(initialPhone)) {
      sendOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendOtp() {
    setBusy(true);
    try {
      const r = await api.requestOtp(phone);
      setOtpSent(true);
      if (r.devOtp) {
        setDevOtp(r.devOtp);
        setOtp(r.devOtp);
      }
    } catch (e: any) {
      showAlert('Could not send OTP', e?.message || 'error');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const fcmToken = await fbGetToken().catch(() => undefined);
      const res = await api.login({ phone, otp, name, fcmToken });
      useAuth.getState().setAuth({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        worker: res.worker,
      });
      onVerified(res.worker);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        showAlert('Wrong OTP', 'Please re-check the code.');
      } else {
        showAlert('Verification failed', e?.message || 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenShell
      step="VERIFY PHONE"
      title="Verify your phone"
      subtitle="We'll send a one-time code to confirm you own this number."
      onContinue={otpSent ? verify : sendOtp}
      continueLabel={otpSent ? 'Verify & continue' : 'Send OTP'}
      continueDisabled={otpSent ? !otpValid : !phoneValid}
      continueLoading={busy}
      footer={
        otpSent ? (
          <TouchableOpacity onPress={() => { setOtpSent(false); setOtp(''); }}>
            <Text style={styles.link}>Change phone number</Text>
          </TouchableOpacity>
        ) : null
      }
    >
      <Text style={styles.label}>Phone number</Text>
      <View style={styles.inputRow}>
        <View style={styles.prefixBox}>
          <Text style={styles.prefix}>+91</Text>
        </View>
        <TextInput
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          placeholderTextColor="#9CA3AF"
          style={[styles.input, { flex: 1 }]}
          keyboardType="number-pad"
          editable={!otpSent}
          autoFocus={!initialPhone}
        />
      </View>

      {otpSent ? (
        <>
          <Text style={[styles.label, { marginTop: 24 }]}>OTP</Text>
          <TextInput
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="Enter OTP"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            keyboardType="number-pad"
            autoFocus
          />
          {devOtp ? (
            <Text style={styles.devHint}>Dev OTP: {devOtp}</Text>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { color: '#475569', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefixBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D8D4E5',
  },
  prefix: {
    color: '#1F1245',
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#1F1245',
    fontSize: 18,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#D8D4E5',
  },
  devHint: { color: '#D97706', marginTop: 8, fontSize: 13, fontWeight: '600' },
  link: { color: '#6D28D9', textAlign: 'center', fontSize: 15, fontWeight: '600', paddingBottom: 12 },
});
