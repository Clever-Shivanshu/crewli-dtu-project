import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';

type Props = {
  label: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  style?: any;
};

export function SelectCard({ label, subtitle, selected, onPress, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, selected && styles.cardSelected, style]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {subtitle ? <Text style={[styles.subtitle, selected && styles.subtitleSelected]}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSelected: {
    borderColor: '#6D28D9',
    backgroundColor: '#F5F3FF',
  },
  label: { color: '#1F1245', fontSize: 17, fontWeight: '600' },
  labelSelected: { color: '#4C1D95' },
  subtitle: { color: '#6B7280', fontSize: 13, marginTop: 3 },
  subtitleSelected: { color: '#7C3AED' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
});
