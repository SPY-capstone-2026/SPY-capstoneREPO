/**
 * 화면에 포커스될 때마다(다시 보일 때마다) fade-in + slide-up + scale-up
 * 모션이 재생되는 카드. useFocusEffect로 탭 전환마다 애니메이션을 재시작한다.
 */

import { PropsWithChildren, useCallback, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { colors } from '@/constants/colors';

type MotionCardProps = PropsWithChildren<{
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function MotionCard({ children, delay = 0, style }: MotionCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  const playEnterMotion = useCallback(() => {
    opacity.setValue(0);
    translateY.setValue(18);
    scale.setValue(0.985);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        damping: 18,
        stiffness: 150,
        mass: 0.62,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        damping: 17,
        stiffness: 150,
        mass: 0.58,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  useFocusEffect(
    useCallback(() => {
      playEnterMotion();
    }, [playEnterMotion])
  );

  return (
    <Animated.View
      style={[
        styles.outer,
        style,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <BlurView intensity={72} tint="light" style={styles.blur}>
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.84)',
            'rgba(255,255,255,0.58)',
            'rgba(255,248,216,0.40)',
          ]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.softReflectionLarge} />
          <View style={styles.softReflectionSmall} />
          <View style={styles.innerGlow} />
          <View style={styles.innerStroke} />
          {children}
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 34,
    overflow: 'hidden',
    marginBottom: 16,

    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassWhite,

    shadowColor: '#B88B00',
    shadowOpacity: 0.13,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 7,
  },
  blur: {
    overflow: 'hidden',
  },
  gradient: {
    padding: 20,
    minHeight: 48,
  },
  softReflectionLarge: {
    position: 'absolute',
    top: -24,
    left: 18,
    width: 150,
    height: 58,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  softReflectionSmall: {
    position: 'absolute',
    top: 16,
    left: 28,
    width: 76,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  innerGlow: {
    position: 'absolute',
    top: -48,
    right: -34,
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  innerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});