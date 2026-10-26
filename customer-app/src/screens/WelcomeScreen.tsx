import { SafeScreen } from '../components/SafeScreen';
import { MapPicker } from '../components/MapPicker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { ArrowRight, MapPin } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ensureAndGetLocation } from '../services/location';
import { useApp } from '../store/app';
import LinearGradient from 'react-native-linear-gradient';

type Props = { onContinue: () => void };

export function WelcomeScreen({ onContinue }: Props) {
  const { colors, isDark } = useTheme();
  const [busy, setBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [detectedLoc, setDetectedLoc] = useState<{ lat: number; lng: number } | null>(null);

  async function start() {
    setBusy(true);
    const loc = await ensureAndGetLocation();
    setBusy(false);
    if (loc) {
      setDetectedLoc(loc);
      useApp.getState().setLocation(loc);
      // Show map so user can adjust pin
      setShowMap(true);
    } else {
      // If location fails, show map centered on India anyway
      setShowMap(true);
    }
  }

  function handleMapConfirm(loc: { lat: number; lng: number }) {
    useApp.getState().setLocation(loc);
    onContinue();
  }

  // ──── MAP PIN STEP ────
  if (showMap) {
    return (
      <View style={[styles.root, { backgroundColor: '#f8fafc' }]}>
        <SafeScreen style={{ flex: 1 }}>
          <View style={styles.mapHeader}>
            <MapPin size={22} color="#311090" />
            <Text style={styles.mapTitle}>Confirm your location</Text>
          </View>
          <Text style={styles.mapSub}>
            Move the map to adjust the pin to your exact location
          </Text>

          <View style={{ flex: 1, margin: 12 }}>
            <MapPicker
              initial={detectedLoc}
              onConfirm={handleMapConfirm}
              onCancel={() => setShowMap(false)}
            />
          </View>
        </SafeScreen>
      </View>
    );
  }

  // ──── WELCOME STEP ────
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FDFBFF', '#F4F0FF', '#EBE4FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeScreen style={{ flex: 1 }}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image source={require('../images/main.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.title}>
            Welcome to{'\n'}Crewli
          </Text>
          <Text style={styles.subtitle}>
            Fast, reliable local help.{'\n'}We'll match you with a nearby expert in minutes.
          </Text>

          <TouchableOpacity
            style={[styles.btn, busy && { opacity: 0.7 }]}
            onPress={start}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.btnText}>Allow location & continue</Text>
                <ArrowRight size={20} color="#fff" style={{ position: 'absolute', right: 24 }} />
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.legal, { color: '#6B7280' }]}>
            We'll ask for your location so workers know where to come.
          </Text>
        </View>
      </SafeScreen>
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
  legal: {
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Map step
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 16,
  },
  mapTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F1245',
  },
  mapSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
  },
});
