import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeScreen } from './SafeScreen';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
  title: string;
  subtitle?: string;
  step?: string;
  children: ReactNode;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  footer?: ReactNode;
};

export function ScreenShell({
  title,
  subtitle,
  step,
  children,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  continueLoading,
  footer,
}: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FDFBFF', '#F4F0FF', '#EBE4FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeScreen style={{ flex: 1, backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step ? <Text style={styles.step}>{step}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View style={styles.body}>{children}</View>
          </ScrollView>

          <View style={styles.footer}>
            {footer}
            {onContinue ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  (continueDisabled || continueLoading) && styles.buttonDisabled,
                ]}
                onPress={onContinue}
                disabled={continueDisabled || continueLoading}
                activeOpacity={0.85}
              >
                {continueLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{continueLabel}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 28, paddingBottom: 32 },
  step: {
    color: '#6D28D9',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1F1245',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
  },
  body: { marginTop: 28 },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  button: {
    backgroundColor: '#311090',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#311090',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { backgroundColor: '#C4B5D8', opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
