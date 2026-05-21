import { PropsWithChildren, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type AnimatedButtonProps = PropsWithChildren<{
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost';
  style?: StyleProp<ViewStyle>;
}>;

export function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  style,
}: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.975,
        damping: 16,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 1,
        damping: 16,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 16,
        stiffness: 230,
        mass: 0.5,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 16,
        stiffness: 230,
        mass: 0.5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = async () => {
    await Haptics.selectionAsync();
    onPress?.();
  };

  const buttonStyle =
    variant === 'primary'
      ? styles.primaryButton
      : variant === 'soft'
        ? styles.softButton
        : variant === 'ghost'
          ? styles.ghostButton
          : styles.secondaryButton;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.button, buttonStyle]}
      >
        <Text style={styles.buttonText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.butterStrong,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: colors.butterPale,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.36)',
  },
  softButton: {
    backgroundColor: colors.butterSoft,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.30)',
  },
  ghostButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  buttonText: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    color: colors.text,
  },
});