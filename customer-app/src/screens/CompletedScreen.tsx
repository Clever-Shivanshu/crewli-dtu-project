import { SafeScreen } from '../components/SafeScreen';
import React, { useEffect } from 'react';
import {
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PartyPopper } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  finalPrice: number;
  onDone: () => void;
};

export function CompletedScreen({ finalPrice, onDone }: Props) {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    const t = setTimeout(onDone, 3500);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [onDone]);

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: colors.success + '22' }]}>
          <PartyPopper size={64} color={colors.success} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Thank you for using Crewli!</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          ₹{finalPrice} paid · Job completed
        </Text>
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          We'll take you back to the home screen shortly.
        </Text>

        <TouchableOpacity
          onPress={onDone}
          style={[styles.btn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 16, marginTop: 10, textAlign: 'center' },
  hint: { fontSize: 13, marginTop: 16, textAlign: 'center' },
  btn: {
    marginTop: 36,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
