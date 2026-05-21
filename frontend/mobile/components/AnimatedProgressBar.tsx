import { useCallback, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { colors } from '@/constants/colors';

type AnimatedProgressBarProps = {
  progress: number;
  tone?: 'success' | 'warning' | 'danger';
};

export function AnimatedProgressBar({
  progress,
  tone = 'success',
}: AnimatedProgressBarProps) {
  const width = useRef(new Animated.Value(0)).current;
  const safeProgress = Math.max(0, Math.min(progress, 1));

  useFocusEffect(
    useCallback(() => {
      width.setValue(0);

      Animated.timing(width, {
        toValue: safeProgress,
        duration: 760,
        delay: 120,
        useNativeDriver: false,
      }).start();
    }, [safeProgress, width])
  );

  const barColor =
    tone === 'danger'
      ? colors.dangerText
      : tone === 'warning'
        ? colors.butterStrong
        : colors.successText;

  const animatedWidth = width.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: animatedWidth,
            backgroundColor: barColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 226, 208, 0.72)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});