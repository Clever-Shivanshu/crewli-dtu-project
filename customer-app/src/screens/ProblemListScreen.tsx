import { SafeScreen } from '../components/SafeScreen';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Problem, Skill } from '../services/api';

type Props = {
  problem: Problem;
  skills: Record<string, Skill>;
  onBack: () => void;
  onSelect: (subProblemId: string) => void;
};

export function ProblemListScreen({ problem, skills, onBack, onSelect }: Props) {
  const { colors, isDark } = useTheme();
  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{problem.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Pick the problem that matches best
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {problem.subProblems.map((sp) => {
          const skill = skills[sp.skillKey];
          return (
            <TouchableOpacity
              key={sp.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => onSelect(sp.id)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{sp.title}</Text>
                <Text style={[styles.rowPrice, { color: colors.textMuted }]}>
                  Starts at ₹{skill?.basePrice ?? '—'}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textFaint} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  back: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowPrice: { fontSize: 13, marginTop: 4 },
});
