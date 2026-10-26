import React, { useRef, useState, ReactNode } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DraggablePanelProps {
  children: ReactNode;
  snapPoints: (number | string)[]; // e.g. ['25%', '50%', '90%'] but converted to absolute pixels from bottom or heights. Let's use percentages or pixel values.
  initialSnapIndex?: number;
  style?: StyleProp<ViewStyle>;
  onSnapIndexChange?: (index: number) => void;
}

// Convert string percentages to pixel heights based on screen height
const parseSnapPoints = (points: (number | string)[]): number[] => {
  return points.map(pt => {
    if (typeof pt === 'string' && pt.endsWith('%')) {
      return (parseFloat(pt) / 100) * SCREEN_HEIGHT;
    }
    return typeof pt === 'number' ? pt : 200;
  });
};

export const DraggablePanel = ({ children, snapPoints: rawSnapPoints, initialSnapIndex = 0, style, onSnapIndexChange }: DraggablePanelProps) => {
  const snapPoints = parseSnapPoints(rawSnapPoints);
  const sortedSnapPoints = [...snapPoints].sort((a, b) => a - b);
  const minHeight = sortedSnapPoints[0];
  const maxHeight = sortedSnapPoints[sortedSnapPoints.length - 1];
  
  const initialHeight = snapPoints[initialSnapIndex] || minHeight;

  // We animate the "height" of the panel or the "translateY". 
  // Animating translateY is more performant.
  // Let's position the panel at the bottom, and translateY will push it down.
  // translateY = 0 means fully expanded (height = maxHeight)
  // translateY = maxHeight - minHeight means fully collapsed (height = minHeight)
  
  const initialTranslateY = maxHeight - initialHeight;
  const translateY = useRef(new Animated.Value(initialTranslateY)).current;
  const [currentTranslateY, setCurrentTranslateY] = useState(initialTranslateY);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(currentTranslateY);
        translateY.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dy: translateY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        const newTranslateY = currentTranslateY + gestureState.dy;
        
        // Find closest snap point (in terms of translateY)
        const snapTranslateYs = sortedSnapPoints.map(h => maxHeight - h);
        const closestTranslateY = snapTranslateYs.reduce((prev, curr) => 
          Math.abs(curr - newTranslateY) < Math.abs(prev - newTranslateY) ? curr : prev
        );

        setCurrentTranslateY(closestTranslateY);
        
        // Find the snap index and notify parent
        const newHeight = maxHeight - closestTranslateY;
        const newIndex = snapPoints.findIndex(sp => Math.abs(sp - newHeight) < 1);
        if (newIndex >= 0 && onSnapIndexChange) {
          onSnapIndexChange(newIndex);
        }
        
        Animated.spring(translateY, {
          toValue: closestTranslateY,
          useNativeDriver: false,
          friction: 8,
          tension: 40,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.panel,
        { height: maxHeight, transform: [{ translateY }] },
        style
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
        <View style={styles.dragHandle} />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  dragHandleArea: {
    height: 30,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
  },
  content: {
    flex: 1,
  }
});
