import React, { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';

type Props = {
  initial?: string;
  onNext: (name: string) => void;
};

export function NameScreen({ initial = '', onNext }: Props) {
  const [name, setName] = useState(initial);
  const valid = name.trim().length >= 2;

  return (
    <ScreenShell
      step="STEP 1 OF 5"
      title="What's your name?"
      subtitle="We'll show this to customers when they request your service."
      onContinue={() => onNext(name.trim())}
      continueDisabled={!valid}
    >
      <Text style={styles.label}>Full name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ramesh Kumar"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        autoFocus
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => valid && onNext(name.trim())}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { color: '#475569', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#1F1245',
    fontSize: 18,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#D8D4E5',
  },
});
