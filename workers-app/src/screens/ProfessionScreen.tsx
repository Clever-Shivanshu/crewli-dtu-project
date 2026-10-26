import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { SelectCard } from '../components/SelectCard';
import { api, Profession } from '../services/api';

type Props = {
  onPicked: (profession: Profession) => void;
};

export function ProfessionScreen({ onPicked }: Props) {
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [selected, setSelected] = useState<Profession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProfessions()
      .then((r) => setProfessions(r.professions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenShell
      step="STEP 4 OF 5"
      title="What do you do?"
      subtitle="We'll use this to match you with the right kind of jobs."
      onContinue={() => selected && onPicked(selected)}
      continueDisabled={!selected}
    >
      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color="#6D28D9" />
        </View>
      ) : (
        professions.map((p) => (
          <SelectCard
            key={p.key}
            label={p.label}
            subtitle={`${p.skills.length} skill${p.skills.length === 1 ? '' : 's'} available`}
            selected={selected?.key === p.key}
            onPress={() => setSelected(p)}
          />
        ))
      )}
    </ScreenShell>
  );
}
