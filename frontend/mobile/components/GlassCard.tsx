import { PropsWithChildren, useCallback, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { colors } from '@/constants/colors';

type GlassCardProps = PropsWithChildren<{
  delay?: number;
  tone?: 'butter' | 'soft' | 'white';
  style?: StyleProp<ViewStyle>;
}>;

export function GlassCard({
  children,
  delay = 0,
  tone = 'white',
  style,
}: GlassCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(12);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 360,
          delay,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 19,
          stiffness: 210,
          mass: 0.55,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }, [delay, opacity, translateY])
  );

  const toneStyle =
    tone === 'butter'
      ? styles.butter
      : tone === 'soft'
        ? styles.soft
        : styles.white;

  return (
    <Animated.View
      style={[
        styles.shadowWrap,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.card, toneStyle, style]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  card: {
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
  },
  white: {
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  butter: {
    backgroundColor: 'rgba(255,248,216,0.46)',
  },
  soft: {
    backgroundColor: 'rgba(255,251,240,0.42)',
  },
});