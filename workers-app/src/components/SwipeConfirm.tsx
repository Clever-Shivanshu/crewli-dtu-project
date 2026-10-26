import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronsRight, Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  confirmColor?: string;
};

const THUMB_SIZE = 56;
const PADDING = 4;
const THRESHOLD_RATIO = 0.75;

export function SwipeConfirm({ label, onConfirm, disabled, confirmColor }: Props) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const maxX = Math.max(0, trackWidth - THUMB_SIZE - PADDING * 2);
  const x = useRef(new Animated.Value(0)).current;
  const firedRef = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderMove: (_, g) => {
          const next = Math.max(0, Math.min(g.dx, maxX));
          x.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          const dx = Math.max(0, Math.min(g.dx, maxX));
          if (dx >= maxX * THRESHOLD_RATIO && !firedRef.current) {
            firedRef.current = true;
            Animated.timing(x, {
              toValue: maxX,
              duration: 120,
              useNativeDriver: false,
            }).start(() => {
              onConfirm();
              setTimeout(() => {
                firedRef.current = false;
                Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
              }, 400);
            });
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
          }
        },
      }),
    [maxX, disabled, onConfirm]
  );

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);
  const bg = confirmColor || colors.accent;

  const labelOpacity = x.interpolate({
    inputRange: [0, maxX * 0.9],
    outputRange: [1, 0.1],
    extrapolate: 'clamp',
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: bg, width: Animated.add(x, new Animated.Value(THUMB_SIZE + PADDING)) }]} />
      <Animated.Text
        style={[styles.label, { color: colors.text, opacity: labelOpacity }]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
      <Animated.View
        {...responder.panHandlers}
        style={[styles.thumb, { backgroundColor: bg, transform: [{ translateX: x }] }]}
      >
        {firedRef.current ? (
          <Check size={26} color="#fff" strokeWidth={3} />
        ) : (
          <ChevronsRight size={26} color="#fff" strokeWidth={3} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB_SIZE + PADDING * 2,
    borderRadius: (THUMB_SIZE + PADDING * 2) / 2,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.25,
  },
  label: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
