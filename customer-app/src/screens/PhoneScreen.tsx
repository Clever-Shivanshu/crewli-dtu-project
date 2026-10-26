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
  Dimensions,
} from 'react-native';
import { ArrowRight, ChevronDown } from 'lucide-react-native';
import { api } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

type Props = {
  onSent: (phone: string, devOtp?: string) => void;
};

export function PhoneScreen({ onSent }: Props) {
  const { colors, isDark } = useTheme();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 10) {
      showAlert('Enter a valid 10-digit phone number');
      return;
    }
    setBusy(true);
    try {
      const res = await api.requestOtp(digits);
      onSent(digits, res.devOtp);
    } catch (e: any) {
      showAlert('Could not send OTP', e?.message || 'Please try again');
    } finally {
      setBusy(false);
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
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image source={require('../images/main.png')} style={styles.logo} resizeMode="contain" />
            </View>

            <Text style={styles.title}>
              Any Problems?{'\n'}We'll fix it.
            </Text>
            <Text style={styles.subtitle}>
              Trusted help. Fast response.{'\n'}Affordable prices.
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.prefixWrap}>
                <Text style={styles.prefix}>+91</Text>
              </View>
              <View style={styles.inputDivider} />
              <TextInput
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder="Enter your mobile number"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={send}
              disabled={busy}
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
          </View>
        </SafeScreen>
      </KeyboardAvoidingView>

      {/* <Image
        source={require('../images/footeroflogin.png')}
        style={styles.footerImage}
        resizeMode="cover"
      /> */}
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
    marginTop: -80,
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 70,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8D4E5',
    backgroundColor: '#FAFAFA',
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
    color: '#111827'
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
    color: '#111827',
  },
  btn: {
    marginTop: 24,
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
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  footerImage: {
    position: 'absolute',
    bottom: 0,
    width: width,
    height: width * 0.8,
    zIndex: 1,
    pointerEvents: 'none',
  },
});
