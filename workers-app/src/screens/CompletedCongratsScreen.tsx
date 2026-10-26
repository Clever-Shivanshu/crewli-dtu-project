import { SafeScreen } from '../components/SafeScreen';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PartyPopper, Home, Star } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useActiveJob } from '../store/activeJob';

type Props = {
  finalPrice: number;
  workerName?: string;
  onGoHome: () => void;
};

export function CompletedCongratsScreen({ finalPrice, workerName, onGoHome }: Props) {
  const { colors, isDark } = useTheme();
  const clear = useActiveJob((s) => s.clear);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const starsAnim = [1, 2, 3, 4, 5].map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, damping: 14 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12 }),
    ]).start(() => {
      // Stagger stars
      starsAnim.forEach((a, i) => {
        setTimeout(() => {
          Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 10 }).start();
        }, i * 80);
      });
    });
  }, []);

  function handleGoHome() {
    clear();
    onGoHome();
  }

  return (
    <SafeScreen style={[styles.root, { backgroundColor: isDark ? '#0a0a0a' : '#fafffe' }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#052e1a' : '#dcfce7' }]}>
          <PartyPopper size={64} color="#16a34a" />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Congratulations! 🎉</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {workerName ? `Great work, ${workerName}!` : 'Job well done!'}
        </Text>

        {/* Amount Card */}
        <View style={[styles.amountCard, { backgroundColor: isDark ? '#052e1a' : '#dcfce7', borderColor: '#22c55e' }]}>
          <Text style={[styles.amountLabel, { color: isDark ? '#4ade80' : '#15803d' }]}>
            Amount Collected
          </Text>
          <Text style={[styles.amountValue, { color: isDark ? '#ffffff' : '#14532d' }]}>
            ₹{finalPrice}
          </Text>
          <Text style={[styles.amountSub, { color: isDark ? '#86efac' : '#16a34a' }]}>
            Payment received from customer
          </Text>
        </View>

        {/* Stars animation */}
        <View style={styles.starsRow}>
          {starsAnim.map((anim, i) => (
            <Animated.View
              key={i}
              style={{
                opacity: anim,
                transform: [{ scale: anim }],
              }}
            >
              <Star size={32} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />
            </Animated.View>
          ))}
        </View>

        <Text style={[styles.hint, { color: colors.textFaint }]}>
          Your earnings have been recorded. Keep up the great work!
        </Text>

        {/* Go Home Button */}
        <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
          <Home size={20} color="#fff" />
          <Text style={styles.homeBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 30, fontWeight: '900', textAlign: 'center' },
  sub: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  amountCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginVertical: 8,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  amountValue: { fontSize: 52, fontWeight: '900' },
  amountSub: { fontSize: 13, marginTop: 4 },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#311090',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#311090',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  homeBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
