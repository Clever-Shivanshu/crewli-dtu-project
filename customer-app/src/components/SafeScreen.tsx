import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  /** Skip bottom safe-area padding */
  noBottom?: boolean;
  /** Skip top safe-area padding */
  noTop?: boolean;
  style?: any;
};

/**
 * Universal screen wrapper — ensures content never goes behind
 * the status bar (top) or system navigation buttons (bottom).
 */
export function SafeScreen({ children, noBottom, noTop, style }: Props) {
  const insets = useSafeAreaInsets();

  // Android: StatusBar.currentHeight is the status bar height.
  // On some devices / emulators useSafeAreaInsets().top returns 0
  // even with translucent, so we always fall back to StatusBar.currentHeight.
  const statusBarH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
  const topPad = noTop ? 0 : Math.max(insets.top, statusBarH);
  // Android 3-button / gesture nav bar
  const bottomPad = noBottom ? 0 : Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
    >
      <StatusBar translucent backgroundColor="transparent" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
