import { showAlert } from '../store/alert';
import React, { useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { SelectCard } from '../components/SelectCard';
import { api, CachedWorker, Profession, cacheWorker } from '../services/api';
import { ensureAndGetLocation } from '../services/location';

type Props = {
  name: string;
  language: string;
  profession: Profession;
  onDone: (worker: CachedWorker) => void;
};

export function SkillsScreen({ name, language, profession, onDone }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(k: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    try {
      // Grab location now so matching works from the very first moment the
      // worker goes online. Null is fine — backend still accepts onboarding.
      const location = (await ensureAndGetLocation()) || undefined;
      const worker = await api.onboard({
        language,
        profession: profession.key,
        skills: [...picked],
        name,
        location,
      });
      await cacheWorker(worker);
      if (!location) {
        showAlert(
          'Location off',
          'We could not read your location. Please enable GPS — you will only receive jobs when we know where you are.'
        );
      }
      onDone(worker);
    } catch (e: any) {
      showAlert('Could not save', e?.message || 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenShell
      step="STEP 5 OF 5"
      title="Pick your skills"
      subtitle={`Select everything you can handle as a ${profession.label.toLowerCase()}. Customers will only see jobs matching your skills.`}
      onContinue={submit}
      continueLabel={`Finish setup${picked.size > 0 ? ` (${picked.size})` : ''}`}
      continueDisabled={picked.size === 0}
      continueLoading={busy}
    >
      {profession.skills.map((s) => (
        <SelectCard
          key={s.key}
          label={s.label}
          subtitle={`₹${s.basePrice} base + ₹${s.perKmRate}/km`}
          selected={picked.has(s.key)}
          onPress={() => toggle(s.key)}
        />
      ))}
    </ScreenShell>
  );
}
