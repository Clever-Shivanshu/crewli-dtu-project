import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import { useAlert } from '../store/alert';
import { useTheme } from '../theme/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export function CustomAlert() {
  const { visible, title, message, buttons, hide } = useAlert();
  const { colors, isDark } = useTheme();

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  // Handle pointer events so we don't block interactions when hidden
  if (!visible && (translateY as any)._value === SCREEN_HEIGHT) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.backdrop,
        { pointerEvents: visible ? 'auto' : 'none' },
      ]}
    >
      {/* Dark overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.55)', opacity },
        ]}
      />
      <TouchableWithoutFeedback onPress={hide}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.container,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {!!message && (
            <Text style={[styles.message, { color: colors.textMuted }]}>
              {message}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.buttonRow,
            buttons.length > 2 && { flexDirection: 'column' },
          ]}
        >
          {buttons.map((btn, i) => {
            const isDestructive = btn.style === 'destructive';
            const isCancel = btn.style === 'cancel';
            const isPrimary = !isCancel && !isDestructive;

            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                style={[
                  styles.button,
                  buttons.length > 2 && { width: '100%', borderTopWidth: 1, borderColor: colors.cardBorder },
                  buttons.length <= 2 && i > 0 && { borderLeftWidth: 1, borderColor: colors.cardBorder },
                  isPrimary && { backgroundColor: isDark ? 'rgba(49, 16, 144, 0.1)' : 'rgba(49, 16, 144, 0.05)' }
                ]}
                onPress={() => {
                  hide();
                  setTimeout(() => {
                    btn.onPress?.();
                  }, 100);
                }}
              >
                <Text
                  style={[
                    styles.buttonText,
                    isDestructive && { color: colors.danger },
                    isCancel && { color: colors.textMuted, fontWeight: '500' },
                    isPrimary && { color: colors.accent, fontWeight: '700' },
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    ...Platform.select({
      android: {
        elevation: 100,
      },
    }),
  },
  container: {
    width: SCREEN_WIDTH * 0.85,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.2)',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
