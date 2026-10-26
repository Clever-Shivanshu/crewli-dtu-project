import { SafeScreen } from '../components/SafeScreen';
import { showAlert } from '../store/alert';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
    BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { XCircle, Search, RotateCcw } from 'lucide-react-native';
import { api, Job } from '../services/api';
import { connectCustomerSocket } from '../services/socket';
import { useApp } from '../store/app';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  jobId: string;
  onAccepted: () => void;
  onTerminal: () => void;
};

export function SearchingScreen({ jobId, onAccepted, onTerminal }: Props) {
  const { colors, isDark } = useTheme();
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    let alive = true;
    api.getJob(jobId).then((j) => alive && setJob(j)).catch((e: any) => alive && setError(e?.message));

    const sock = connectCustomerSocket(jobId);
    const onUpdate = (j: Job) => { if (alive) setJob(j); };
    const onAccept = () => { if (alive) onAccepted(); };
    sock.on('job:update', onUpdate);
    sock.on('job:accepted', onAccept);
    return () => {
      alive = false;
      sock.off('job:update', onUpdate);
      sock.off('job:accepted', onAccept);
    };
  }, [jobId, onAccepted]);

  useEffect(() => {
    if (!job) return;
    if (job.status === 'accepted' || job.status === 'arrived' || job.status === 'completed' || job.status === 'paid') {
      onAccepted();
    }
  }, [job?.status, onAccepted]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (job?.status === 'expired' || job?.status === 'cancelled') {
        onTerminal();
        return true;
      }
      if (job?.status === 'pending') {
        confirmCancel();
        return true;
      }
      return true;
    });
    return () => sub.remove();
  }, [job?.status, onTerminal]);

  function confirmCancel() {
    showAlert(
      'Cancel booking?',
      "We're still finding a worker. Cancel now?",
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: cancel },
      ]
    );
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.cancelJob(jobId);
    } catch { }
    useApp.getState().setActiveJob(null);
    setBusy(false);
    onTerminal();
  }

  const failed = job?.status === 'expired' || job?.status === 'cancelled';

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.radarContainer}>
        {!failed && (
          <>
            <Animated.View
              style={[
                styles.pulseCircle,
                { 
                  backgroundColor: '#9333EA', 
                  transform: [
                    { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) }
                  ], 
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }) 
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pulseCircle,
                { 
                  backgroundColor: '#9333EA', 
                  transform: [
                    { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.5] }) }
                  ], 
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }) 
                },
              ]}
            />
          </>
        )}
        <View style={[styles.centerDot, { backgroundColor: failed ? colors.danger : '#9333EA' }]}>
           {failed ? <XCircle size={32} color="#fff" /> : <Search size={32} color="#fff" />}
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {failed
            ? 'Sorry, no worker in your area'
            : 'Finding your expert...'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {failed
            ? (job?.status === 'expired' ? 'We could not find any available professionals nearby.' : 'Booking was cancelled.')
            : 'We are matching you with the nearest available professional. This usually takes under a minute.'}
        </Text>

        {error ? <Text style={[styles.err, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.actions}>
          {failed ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#9333EA' }]} onPress={onTerminal}>
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.btnText}>Try Again</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: colors.danger }]}
              onPress={confirmCancel}
              disabled={busy}
            >
              <XCircle size={18} color={colors.danger} />
              <Text style={[styles.btnText, { color: colors.danger }]}>Cancel Search</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  radarContainer: {
    height: 350,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  centerDot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  content: { flex: 1, padding: 32, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24 },
  err: { marginTop: 16, fontSize: 14, textAlign: 'center' },
  actions: {
    position: 'absolute',
    bottom: 50,
    left: 24,
    right: 24,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});