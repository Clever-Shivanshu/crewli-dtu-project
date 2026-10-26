import { SafeScreen } from '../components/SafeScreen';
import React, { useState, useRef } from 'react';
import {
  Animated,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PartyPopper, Star, ArrowRight, CheckCircle } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../services/api';
import { useEffect } from 'react';

type Props = {
  jobId: string;
  finalPrice: number;
  workerName?: string;
  onDone: () => void;
};

export function RatingScreen({ jobId, finalPrice, workerName, onDone }: Props) {
  const { colors, isDark } = useTheme();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const scaleAnims = [1, 2, 3, 4, 5].map(() => useRef(new Animated.Value(1)).current);
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  function animateStar(i: number) {
    Animated.sequence([
      Animated.timing(scaleAnims[i], { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnims[i], { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }

  async function submitRating() {
    if (rating === 0) return;
    setBusy(true);
    try {
      await api.rateWorker(jobId, rating);
    } catch { }
    finally {
      setBusy(false);
      setSubmitted(true);
      Animated.spring(checkAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }).start();
      setTimeout(onDone, 2500);
    }
  }

  async function skipRating() {
    setBusy(true);
    try {
      await api.skipRating(jobId);
    } catch {}
    finally {
      setBusy(false);
      onDone();
    }
  }

  const activeStar = hoveredStar || rating;
  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  if (submitted) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark ? ['#1e1b4b', '#000000'] : ['#ede9fe', '#f8fafc']}
          style={styles.root}
        >
          <View style={styles.center}>
            <Animated.View style={{ transform: [{ scale: checkAnim }], alignItems: 'center' }}>
              <View style={[styles.successIconWrap, { backgroundColor: isDark ? 'rgba(49, 16, 144, 0.3)' : 'rgba(49, 16, 144, 0.1)' }]}>
                <CheckCircle size={72} color="#311090" strokeWidth={2} />
              </View>
              <Text style={[styles.thankTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Thank you!</Text>
              <Text style={[styles.thankSub, { color: isDark ? '#9ca3af' : '#475569' }]}>
                Your feedback helps us deliver{'\n'}a premium experience.
              </Text>
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.center}>
        {/* Top success indicator */}
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
          <PartyPopper size={52} color={colors.success} />
        </View>

        <Text style={[styles.headerLabel, { color: colors.textMuted }]}>TRIP COMPLETED</Text>
        <Text style={[styles.mainTitle, { color: colors.text }]}>
          {workerName ? `How was ${workerName}?` : 'How was your experience?'}
        </Text>

        <Text style={[styles.priceLine, { color: colors.text }]}>
          ₹{finalPrice} paid · Job done
        </Text>

        {/* Star row */}
        <Text style={[styles.ratingPrompt, { color: colors.textMuted }]}>
          Give 1 to 5 stars about your experience
        </Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => {
            const filled = i <= activeStar;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => { setRating(i); animateStar(i - 1); }}
                activeOpacity={0.8}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnims[i - 1] }] }}>
                  <Star
                    size={48}
                    color={filled ? '#f59e0b' : (isDark ? '#374151' : '#D1D5DB')}
                    fill={filled ? '#f59e0b' : 'transparent'}
                    strokeWidth={1.5}
                  />
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeStar > 0 && (
          <Text style={[styles.ratingLabel, { color: '#f59e0b' }]}>
            {labels[activeStar]}
          </Text>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: rating > 0 ? '#311090' : (isDark ? '#374151' : '#E5E7EB') },
            busy && { opacity: 0.7 },
          ]}
          onPress={submitRating}
          disabled={busy || rating === 0}
        >
          <View style={styles.btnContent}>
            <Text style={[styles.submitText, { color: rating > 0 ? '#fff' : colors.textMuted }]}>
              Submit Review
            </Text>
            {rating > 0 && <ArrowRight size={20} color="#fff" style={{ position: 'absolute', right: 24 }} />}
          </View>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity onPress={skipRating} style={styles.skipBtn} disabled={busy}>
          <Text style={[styles.skipText, { color: colors.textFaint }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  mainTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 34, marginBottom: 8 },
  priceLine: { fontSize: 15, fontWeight: '600', marginBottom: 32, opacity: 0.7 },
  ratingPrompt: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  ratingLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  submitBtn: {
    borderRadius: 14,
    width: '100%',
    height: 56,
    justifyContent: 'center',
    marginBottom: 16,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitText: { fontSize: 16, fontWeight: '700' },
  skipBtn: { paddingVertical: 12 },
  skipText: { fontSize: 14 },
  thankTitle: { fontSize: 36, fontWeight: '900', marginBottom: 12, marginTop: 24 },
  thankSub: { fontSize: 18, textAlign: 'center', lineHeight: 28, fontWeight: '500' },
  successIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
