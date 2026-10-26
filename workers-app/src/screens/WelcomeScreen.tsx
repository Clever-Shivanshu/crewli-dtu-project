import { SafeScreen } from '../components/SafeScreen';
import { showAlert } from '../store/alert';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  StatusBar,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { api } from '../services/api';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
  onContinue: (v: { phone: string; exists: boolean; onboarded: boolean }) => void;
};

export function WelcomeScreen({ onContinue }: Props) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[0-9]{10}$/.test(phone);

  async function next() {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await api.checkPhone(phone);
      onContinue({ phone, exists: r.exists, onboarded: r.onboarded });
    } catch (e: any) {
      showAlert('Connection error', e?.message || 'Please check your internet and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#FDFBFF', '#F4F0FF', '#EBE4FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 10 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeScreen style={{ flex: 1, backgroundColor: 'transparent' }}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image source={require('../../trans-light-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>

            <Text style={styles.title}>
              {'Work when you want.\nEarn daily.'}
            </Text>
            <Text style={styles.subtitle}>
              {'Instant job alerts.\nNo chasing, no waiting.'}
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.prefixWrap}>
                <Text style={styles.prefix}>+91</Text>
              </View>
              <View style={styles.inputDivider} />
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="Enter your mobile number"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={next}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, (!valid || busy) && { opacity: 0.6 }]}
              onPress={next}
              disabled={!valid || busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnText}>Get Started</Text>
                  <ArrowRight size={20} color="#fff" style={{ position: 'absolute', right: 24 }} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.legal}>
              By continuing you agree to Crewli's Terms of Service and Privacy Policy.
            </Text>
          </View>
        </SafeScreen>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -60,
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 100,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1F1245',
    textAlign: 'center',
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 40,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D8D4E5',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 56,
  },
  prefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1245',
  },
  inputDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#D8D4E5',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    color: '#1F1245',
  },
  btn: {
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: '#311090',
    width: '100%',
    height: 56,
    justifyContent: 'center',
    shadowColor: '#311090',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  legal: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
});
