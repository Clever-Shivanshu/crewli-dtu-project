import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { api, Language } from '../services/api';

type Props = {
  onPicked: (langCode: string) => void;
};

export function LanguageScreen({ onPicked }: Props) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLanguages()
      .then((r) => setLanguages(r.languages))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  // LOCK: no back navigation allowed on this screen (hardware back is neutered).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <ScreenShell title="Choose your language">
        <View style={styles.loading}>
          <ActivityIndicator color="#6D28D9" />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      step="STEP 3 OF 5"
      title="Choose your language"
      subtitle="This can be changed later too. Pick what you're most comfortable reading."
      onContinue={() => selected && onPicked(selected)}
      continueDisabled={!selected}
    >
      <View style={styles.grid}>
        {languages.map((l) => {
          const isSel = selected === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              onPress={() => setSelected(l.code)}
              activeOpacity={0.85}
              style={[styles.tile, isSel && styles.tileSelected]}
            >
              <Text style={[styles.native, isSel && styles.nativeSelected]}>
                {l.native}
              </Text>
              <Text style={[styles.label, isSel && styles.labelSelected]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  tile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tileSelected: {
    borderColor: '#6D28D9',
    backgroundColor: '#F5F3FF',
  },
  native: {
    color: '#1F1245',
    fontSize: 22,
    fontWeight: '700',
  },
  nativeSelected: { color: '#4C1D95' },
  label: { color: '#6B7280', marginTop: 6, fontSize: 13 },
  labelSelected: { color: '#7C3AED' },
});
