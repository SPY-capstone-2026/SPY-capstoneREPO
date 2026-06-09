import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';

type ProgressTone =
  | 'success'
  | 'safe'
  | 'warning'
  | 'danger'
  | 'neutral';

type AnimatedProgressBarProps = {
  progress: number;
  tone?: ProgressTone;
};

function getFillColor(tone?: ProgressTone) {
  if (tone === 'danger') {
    return colors.dangerText;
  }

  if (tone === 'warning') {
    return colors.warningText;
  }

  if (tone === 'success' || tone === 'safe') {
    return colors.successText;
  }

  return colors.butterBrown;
}

export function AnimatedProgressBar({
  progress,
  tone = 'neutral',
}: AnimatedProgressBarProps) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const safeProgress = Math.min(Math.max(progress, 0), 1.6);

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: safeProgress,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, safeProgress]);

  const width = animatedProgress.interpolate({
    inputRange: [0, 1.6],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            width,
            backgroundColor: getFillColor(tone),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});