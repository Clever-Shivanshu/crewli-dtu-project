import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  title: string;
  count: number;
  icon: LucideIcon;
  color: string;
  onPress: () => void;
};

export function CategoryCard({ title, count, icon: Icon, color, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Icon size={26} color={color} strokeWidth={2.2} />
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
      <Text style={[styles.count, { color: colors.textFaint }]}>{count} problems</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 128,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  count: {
    fontSize: 12,
    marginTop: 4,
  },
});
