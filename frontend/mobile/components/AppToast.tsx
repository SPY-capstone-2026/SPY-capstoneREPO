import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type AppToastProps = {
  visible: boolean;
  message: string;
};

export function AppToast({ visible, message }: AppToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 16,
          stiffness: 200,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 18,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [opacity, translateY, visible]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <CheckCircle2 size={18} color={colors.butterBrown} strokeWidth={2.8} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 108,
    minHeight: 54,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 248, 216, 0.96)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 999,
  },
  message: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.text,
  },
});