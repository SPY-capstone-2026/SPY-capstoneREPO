import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MoniMascot } from '@/components/mascot/MoniMascot';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type AppLoadingStateProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

export function AppLoadingState({
  title = 'Moni가 정리하고 있어요',
  description,
  compact = false,
}: AppLoadingStateProps) {
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 520,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    bobLoop.start();
    pulseLoop.start();

    return () => {
      bobLoop.stop();
      pulseLoop.stop();
    };
  }, [bob, pulse]);

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -6],
  });

  const scale = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
      ]}
    >
      <View
        style={[
          styles.mascotStage,
          compact && styles.mascotStageCompact,
        ]}
      >
        <Animated.View
          style={{
            transform: [{ translateY }, { scale }],
          }}
        >
          <MoniMascot
            size={compact ? 54 : 68}
            motionEnabled={false}
          />
        </Animated.View>
      </View>

      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
        ]}
      >
        {title}
      </Text>

      {description ? (
        <Text style={styles.description}>
          {description}
        </Text>
      ) : null}

      <View style={styles.dots}>
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: dotOpacity,
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange:
                        index === 1
                          ? [0.85, 1.15]
                          : [0.75, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 0,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  cardCompact: {
    minHeight: 150,
    borderRadius: 22,
    paddingVertical: 18,
  },
  mascotStage: {
    width: 94,
    height: 78,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  mascotStageCompact: {
    width: 78,
    height: 64,
    borderRadius: 20,
    marginBottom: 10,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 13,
  },
  description: {
    maxWidth: 320,
    marginTop: 5,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.subText,
    textAlign: 'center',
  },
  dots: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.butterDeep,
  },
});
