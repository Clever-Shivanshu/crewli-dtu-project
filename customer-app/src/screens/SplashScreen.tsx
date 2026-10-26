import { SafeScreen } from '../components/SafeScreen';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useApp } from '../store/app';
import { useThemePref } from '../theme/ThemeContext';
import { api, Job } from '../services/api';

type Props = {
  children: React.ReactNode;
};

export function SplashScreen({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const hydrated = useApp((s) => s.hydrated);
  const themeHydrated = useThemePref((s) => s.hydrated);
  const phone = useApp((s) => s.phone);
  const name = useApp((s) => s.name);
  const address = useApp((s) => s.address);
  const location = useApp((s) => s.location);
  const activeJobId = useApp((s) => s.activeJobId);
  const setActiveJob = useApp((s) => s.setActiveJob);

  useEffect(() => {
    if (!hydrated || !themeHydrated) return;

    (async () => {
      if (!phone || !name || !address || !location) {
        setLoading(false);
        return;
      }

      if (activeJobId) {
        try {
          const j = await api.getJob(activeJobId);
          if (j.status === 'pending' || j.status === 'accepted' || j.status === 'arrived' || j.status === 'completed') {
            setLoading(false);
            return;
          } else {
            setActiveJob(null);
          }
        } catch {
          setActiveJob(null);
        }
      }

      setLoading(false);
    })();
  }, [hydrated, themeHydrated, phone, name, address, location, activeJobId, setActiveJob]);

  if (loading || !hydrated || !themeHydrated) {
    return (
      <SafeScreen style={styles.splash}>
        <View style={styles.logoContainer}>
          <Image source={require('./images/main.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </SafeScreen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 240,
    height: 240,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  loader: {
    marginTop: 24,
  },
});