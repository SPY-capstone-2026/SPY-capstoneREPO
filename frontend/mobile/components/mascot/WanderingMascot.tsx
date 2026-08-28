import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  MascotMotionController,
  MascotState,
  MoniMascot,
} from './MoniMascot';

export type WanderSpeed = 'slow' | 'normal' | 'fast';
export type WanderMovementMode = 'free' | 'ground';

export type WanderingMascotProps = {
  size?: number;
  color?: string;
  faceColor?: string;
  accessorySource?: ImageSourcePropType | null;
  accessoryName?: string | null;

  /**
   * true: 영역 안을 배회
   * false: 제자리에 있으면서 상태 모션만 실행
   */
  enabled?: boolean;

  motionEnabled?: boolean;

  /**
   * 지정하지 않으면 배회 중 walking / 정지 중 idle 자동 전환.
   * 홈·로그인처럼 고정 애니메이션이 필요하면 enabled=false + state="idle".
   */
  state?: MascotState;

  padding?: number;
  speed?: WanderSpeed;
  minPauseMs?: number;
  maxPauseMs?: number;
  /**
   * free: 컨테이너 안에서 자유롭게 이동
   * ground: 바닥 기준선 주변에서 좌우 위주로 이동
   */
  movementMode?: WanderMovementMode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

type Bounds = {
  width: number;
  height: number;
};

const SPEED_MS_PER_PIXEL: Record<WanderSpeed, number> = {
  slow: 8.5,
  normal: 6.1,
  fast: 4.4,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const randomBetween = (min: number, max: number) =>
  min + Math.random() * Math.max(0, max - min);

export function WanderingMascot({
  size = 148,
  color,
  faceColor,
  accessorySource,
  accessoryName,
  enabled = true,
  motionEnabled = true,
  state,
  padding = 12,
  speed = 'normal',
  minPauseMs = 700,
  maxPauseMs = 1600,
  movementMode = 'free',
  onPress,
  style,
}: WanderingMascotProps) {
  const [bounds, setBounds] = useState<Bounds>({
    width: 0,
    height: 0,
  });

  const [isMoving, setIsMoving] = useState(false);

  // 공간 이동
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  // 몸 전체 쫀득 모션
  const bodyBobY = useSharedValue(0);
  const bodyScaleX = useSharedValue(1);
  const bodyScaleY = useSharedValue(1);
  const bodyRotate = useSharedValue(0);

  // 왼/오른 귀
  const leftEarRotate = useSharedValue(0);
  const leftEarLift = useSharedValue(0);
  const rightEarRotate = useSharedValue(0);
  const rightEarLift = useSharedValue(0);

  // 왼/오른 발
  const leftPawLift = useSharedValue(0);
  const rightPawLift = useSharedValue(0);

  // 꼬리
  const tailRotate = useSharedValue(0);
  const tailShiftX = useSharedValue(0);
  const tailShiftY = useSharedValue(0);

  // 눈
  const eyeScaleY = useSharedValue(1);

  // 클릭 반응 전용 값.
  // 평소 idle/walking 루프를 끊지 않고 그 위에 짧게 합성됩니다.
  const reactionBobY = useSharedValue(0);
  const reactionScaleX = useSharedValue(1);
  const reactionScaleY = useSharedValue(1);
  const reactionRotate = useSharedValue(0);
  const reactionEyeScaleY = useSharedValue(1);
  const interactionCountRef = useRef(0);

  const motion = useMemo<MascotMotionController>(
    () => ({
      leftEarRotate,
      leftEarLift,
      rightEarRotate,
      rightEarLift,
      leftPawLift,
      rightPawLift,
      tailRotate,
      tailShiftX,
      tailShiftY,
      eyeScaleY,
      reactionEyeScaleY,
    }),
    [
      eyeScaleY,
      reactionEyeScaleY,
      leftEarLift,
      leftEarRotate,
      leftPawLift,
      rightEarLift,
      rightEarRotate,
      rightPawLift,
      tailRotate,
      tailShiftX,
      tailShiftY,
    ],
  );

  // Moni의 실제 비율 917 / 609.
  // 파트 회전에 필요한 소량의 안전 여백만 추가합니다.
  const visualWidth = size * (1005 / 609) + size * 0.04;
  const visualHeight = size * 1.08;

  const available = useMemo(
    () => ({
      maxX: Math.max(padding, bounds.width - visualWidth - padding),
      maxY: Math.max(padding, bounds.height - visualHeight - padding),
    }),
    [bounds.height, bounds.width, padding, visualHeight, visualWidth],
  );

  const resolvedState: MascotState =
    state ?? (isMoving ? 'walking' : 'idle');

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setBounds({
      width,
      height,
    });
  }, []);

  /**
   * 최초 위치는 컨테이너 중앙.
   */
  useEffect(() => {
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const centeredX = (bounds.width - visualWidth) / 2;
    const centeredY = (bounds.height - visualHeight) / 2;

    // Fixed mascots (home/login/challenge/character hero) should stay
    // geometrically centered even when their transparent tail safety area is
    // slightly wider than the wrapper. Wandering mascots still respect room
    // padding so they cannot walk out of bounds.
    const startX = enabled
      ? clamp(centeredX, padding, available.maxX)
      : centeredX;

    const startY = enabled
      ? movementMode === 'ground'
        ? Math.max(padding, available.maxY - Math.max(0, size * 0.025))
        : clamp(centeredY, padding, available.maxY)
      : centeredY;

    x.value = startX;
    y.value = startY;
  }, [
    available.maxX,
    available.maxY,
    bounds.height,
    bounds.width,
    enabled,
    movementMode,
    padding,
    visualHeight,
    visualWidth,
    x,
    y,
  ]);

  /**
   * 실제 방 안 배회.
   * 위치 이동만 담당하며 캐릭터 내부 부위 모션과는 분리되어 있습니다.
   */
  useEffect(() => {
    if (
      !enabled ||
      state === 'celebrate' ||
      state === 'sleep' ||
      bounds.width <= visualWidth + padding * 2 ||
      bounds.height <= visualHeight + padding * 2
    ) {
      setIsMoving(false);
      cancelAnimation(x);
      cancelAnimation(y);
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const move = () => {
      if (disposed) {
        return;
      }

      const targetX = randomBetween(padding, available.maxX);

      // ground mode는 바닥 기준선 근처의 아주 좁은 깊이만 사용합니다.
      // 따라서 캐릭터가 벽/가구 위로 올라가는 것처럼 보이지 않습니다.
      const groundDepth = Math.min(size * 0.055, 6);
      const targetY =
        movementMode === 'ground'
          ? randomBetween(
              Math.max(padding, available.maxY - groundDepth),
              available.maxY
            )
          : randomBetween(padding, available.maxY);

      const dx = targetX - x.value;
      const dy = targetY - y.value;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const duration = clamp(
        distance * SPEED_MS_PER_PIXEL[speed],
        speed === 'fast' ? 700 : 1200,
        speed === 'slow' ? 5600 : 4200,
      );

      setIsMoving(true);

      x.value = withTiming(targetX, {
        duration,
        easing: Easing.inOut(Easing.quad),
      });

      y.value = withTiming(targetY, {
        duration,
        easing: Easing.inOut(Easing.quad),
      });

      const pause = randomBetween(minPauseMs, maxPauseMs);

      timer = setTimeout(() => {
        if (disposed) {
          return;
        }

        setIsMoving(false);
        timer = setTimeout(move, pause);
      }, duration);
    };

    const firstDelay = setTimeout(move, 500);

    return () => {
      disposed = true;
      clearTimeout(firstDelay);

      if (timer) {
        clearTimeout(timer);
      }

      cancelAnimation(x);
      cancelAnimation(y);
    };
  }, [
    available.maxX,
    available.maxY,
    bounds.height,
    bounds.width,
    enabled,
    maxPauseMs,
    minPauseMs,
    movementMode,
    padding,
    speed,
    state,
    visualHeight,
    visualWidth,
    x,
    y,
  ]);

  /**
   * 모든 모션을 Reanimated 하나로 통일합니다.
   *
   * 이전 깨짐 원인이었던:
   * - SVG Mask/ClipPath
   * - 파트별 Animated.View
   * - requestAnimationFrame + React setState
   * 를 사용하지 않습니다.
   */
  useEffect(() => {
    const animatedValues = [
      bodyBobY,
      bodyScaleX,
      bodyScaleY,
      bodyRotate,
      leftEarRotate,
      leftEarLift,
      rightEarRotate,
      rightEarLift,
      leftPawLift,
      rightPawLift,
      tailRotate,
      tailShiftX,
      tailShiftY,
      eyeScaleY,
    ];

    animatedValues.forEach((value) => cancelAnimation(value));

    bodyBobY.value = 0;
    bodyScaleX.value = 1;
    bodyScaleY.value = 1;
    bodyRotate.value = 0;

    leftEarRotate.value = 0;
    leftEarLift.value = 0;
    rightEarRotate.value = 0;
    rightEarLift.value = 0;

    leftPawLift.value = 0;
    rightPawLift.value = 0;

    tailRotate.value = 0;
    tailShiftX.value = 0;
    tailShiftY.value = 0;

    eyeScaleY.value = resolvedState === 'sleep' ? 0.12 : 1;

    if (!motionEnabled) {
      return;
    }

    // 모든 상태에서 공통 눈 깜빡임.
    if (resolvedState !== 'sleep') {
      eyeScaleY.value = withRepeat(
        withSequence(
          withDelay(2600, withTiming(0.10, { duration: 75 })),
          withTiming(1, { duration: 110 }),
          withDelay(1800, withTiming(1, { duration: 1 })),
        ),
        -1,
        false,
      );
    }

    if (resolvedState === 'idle') {
      bodyBobY.value = withRepeat(
        withSequence(
          withTiming(-size * 0.006, {
            duration: 1450,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: 1450,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      );

      bodyScaleX.value = withRepeat(
        withSequence(
          withTiming(1.004, { duration: 1450 }),
          withTiming(1, { duration: 1450 }),
        ),
        -1,
        false,
      );

      bodyScaleY.value = withRepeat(
        withSequence(
          withTiming(0.997, { duration: 1450 }),
          withTiming(1, { duration: 1450 }),
        ),
        -1,
        false,
      );

      // 귀를 서로 다른 타이밍으로 쫑긋.
      leftEarRotate.value = withRepeat(
        withSequence(
          withDelay(350, withTiming(-4.2, { duration: 190 })),
          withTiming(0, { duration: 270 }),
          withDelay(1150, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      );

      leftEarLift.value = withRepeat(
        withSequence(
          withDelay(350, withTiming(-3.4, { duration: 190 })),
          withTiming(0, { duration: 270 }),
          withDelay(1150, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      );

      rightEarRotate.value = withRepeat(
        withSequence(
          withDelay(1050, withTiming(4.0, { duration: 190 })),
          withTiming(0, { duration: 260 }),
          withDelay(850, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      );

      rightEarLift.value = withRepeat(
        withSequence(
          withDelay(1050, withTiming(-3.2, { duration: 190 })),
          withTiming(0, { duration: 260 }),
          withDelay(850, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      );

      // 발은 숨 쉬듯 아주 작게 교차.
      leftPawLift.value = withRepeat(
        withSequence(
          withTiming(-1.6, { duration: 780 }),
          withTiming(0, { duration: 780 }),
        ),
        -1,
        true,
      );

      rightPawLift.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 780 }),
          withTiming(-1.6, { duration: 780 }),
        ),
        -1,
        true,
      );

      // ni 꼬리는 느리게 좌우.
      tailRotate.value = withRepeat(
        withSequence(
          withTiming(-2.8, {
            duration: 1050,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(2.8, {
            duration: 1050,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        true,
      );

      tailShiftY.value = withRepeat(
        withSequence(
          withTiming(-0.9, { duration: 1050 }),
          withTiming(0.7, { duration: 1050 }),
        ),
        -1,
        true,
      );
    }

    if (resolvedState === 'walking') {
      bodyBobY.value = withRepeat(
        withSequence(
          withTiming(-size * 0.020, {
            duration: 235,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: 235,
            easing: Easing.in(Easing.quad),
          }),
        ),
        -1,
        false,
      );

      bodyScaleX.value = withRepeat(
        withSequence(
          withTiming(1.012, { duration: 235 }),
          withTiming(0.996, { duration: 235 }),
        ),
        -1,
        true,
      );

      bodyScaleY.value = withRepeat(
        withSequence(
          withTiming(0.992, { duration: 235 }),
          withTiming(1.008, { duration: 235 }),
        ),
        -1,
        true,
      );

      bodyRotate.value = withRepeat(
        withSequence(
          withTiming(-0.45, { duration: 235 }),
          withTiming(0.45, { duration: 235 }),
        ),
        -1,
        true,
      );

      leftPawLift.value = withRepeat(
        withSequence(
          withTiming(-8.5, { duration: 235 }),
          withTiming(0, { duration: 235 }),
        ),
        -1,
        true,
      );

      rightPawLift.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 235 }),
          withTiming(-8.5, { duration: 235 }),
        ),
        -1,
        true,
      );

      leftEarRotate.value = withRepeat(
        withSequence(
          withTiming(-5.2, { duration: 235 }),
          withTiming(0.8, { duration: 235 }),
        ),
        -1,
        true,
      );

      leftEarLift.value = withRepeat(
        withSequence(
          withTiming(-4.5, { duration: 235 }),
          withTiming(0, { duration: 235 }),
        ),
        -1,
        true,
      );

      rightEarRotate.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 235 }),
          withTiming(5.2, { duration: 235 }),
        ),
        -1,
        true,
      );

      rightEarLift.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 235 }),
          withTiming(-4.5, { duration: 235 }),
        ),
        -1,
        true,
      );

      tailRotate.value = withRepeat(
        withSequence(
          withTiming(-5.2, { duration: 270 }),
          withTiming(5.2, { duration: 270 }),
        ),
        -1,
        true,
      );

      tailShiftX.value = withRepeat(
        withSequence(
          withTiming(-1.1, { duration: 270 }),
          withTiming(1.1, { duration: 270 }),
        ),
        -1,
        true,
      );
    }

    if (resolvedState === 'celebrate') {
      bodyBobY.value = withSequence(
        withTiming(size * 0.025, {
          duration: 90,
          easing: Easing.in(Easing.quad),
        }),
        withTiming(-size * 0.15, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: 380,
          easing: Easing.bounce,
        }),
      );

      bodyScaleX.value = withSequence(
        withTiming(1.05, { duration: 90 }),
        withTiming(0.975, { duration: 230 }),
        withTiming(1.035, { duration: 140 }),
        withTiming(1, { duration: 230 }),
      );

      bodyScaleY.value = withSequence(
        withTiming(0.935, { duration: 90 }),
        withTiming(1.06, { duration: 230 }),
        withTiming(0.965, { duration: 140 }),
        withTiming(1, { duration: 230 }),
      );

      leftEarRotate.value = withRepeat(
        withSequence(
          withTiming(-7, { duration: 120 }),
          withTiming(2, { duration: 120 }),
        ),
        4,
        true,
      );

      rightEarRotate.value = withRepeat(
        withSequence(
          withTiming(7, { duration: 120 }),
          withTiming(-2, { duration: 120 }),
        ),
        4,
        true,
      );

      leftEarLift.value = withRepeat(
        withSequence(
          withTiming(-5.5, { duration: 120 }),
          withTiming(0, { duration: 120 }),
        ),
        4,
        true,
      );

      rightEarLift.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 120 }),
          withTiming(-5.5, { duration: 120 }),
        ),
        4,
        true,
      );

      leftPawLift.value = withSequence(
        withTiming(-9, { duration: 150 }),
        withTiming(0, { duration: 180 }),
      );

      rightPawLift.value = withSequence(
        withTiming(-9, { duration: 150 }),
        withTiming(0, { duration: 180 }),
      );

      tailRotate.value = withRepeat(
        withSequence(
          withTiming(-7.0, { duration: 125 }),
          withTiming(7.0, { duration: 125 }),
        ),
        4,
        true,
      );
    }

    if (resolvedState === 'sleep') {
      eyeScaleY.value = withTiming(0.12, { duration: 170 });

      bodyBobY.value = withRepeat(
        withSequence(
          withTiming(-size * 0.004, {
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      );

      leftEarRotate.value = withTiming(-2.5, { duration: 280 });
      rightEarRotate.value = withTiming(2.5, { duration: 280 });
      leftEarLift.value = withTiming(1.8, { duration: 280 });
      rightEarLift.value = withTiming(1.8, { duration: 280 });

      tailRotate.value = withRepeat(
        withSequence(
          withTiming(-1.8, { duration: 1800 }),
          withTiming(1.0, { duration: 1800 }),
        ),
        -1,
        true,
      );

      tailShiftY.value = withTiming(2, { duration: 280 });
    }
  }, [
    bodyBobY,
    bodyRotate,
    bodyScaleX,
    bodyScaleY,
    eyeScaleY,
    leftEarLift,
    leftEarRotate,
    leftPawLift,
    motionEnabled,
    resolvedState,
    rightEarLift,
    rightEarRotate,
    rightPawLift,
    size,
    tailRotate,
    tailShiftX,
    tailShiftY,
  ]);

  const handleMascotPress = useCallback(() => {
    if (!motionEnabled) {
      onPress?.();
      return;
    }

    interactionCountRef.current += 1;
    const reactionType = interactionCountRef.current % 2;

    cancelAnimation(reactionBobY);
    cancelAnimation(reactionScaleX);
    cancelAnimation(reactionScaleY);
    cancelAnimation(reactionRotate);
    cancelAnimation(reactionEyeScaleY);

    reactionBobY.value = 0;
    reactionScaleX.value = 1;
    reactionScaleY.value = 1;
    reactionRotate.value = 0;
    reactionEyeScaleY.value = 1;

    if (reactionType === 0) {
      // 뽀용: 눌렸다가 위로 튀고, 착지하면서 한 번 더 눌린 뒤 복귀.
      reactionBobY.value = withSequence(
        withTiming(size * 0.018, {
          duration: 75,
          easing: Easing.in(Easing.quad),
        }),
        withTiming(-size * 0.085, {
          duration: 185,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: 260,
          easing: Easing.out(Easing.quad),
        }),
      );

      reactionScaleX.value = withSequence(
        withTiming(1.060, { duration: 75 }),
        withTiming(0.960, { duration: 185 }),
        withTiming(1.045, { duration: 90 }),
        withTiming(1, { duration: 170 }),
      );

      reactionScaleY.value = withSequence(
        withTiming(0.910, { duration: 75 }),
        withTiming(1.085, { duration: 185 }),
        withTiming(0.950, { duration: 90 }),
        withTiming(1, { duration: 170 }),
      );

      reactionRotate.value = withSequence(
        withTiming(-1.2, { duration: 95 }),
        withTiming(1.1, { duration: 120 }),
        withTiming(0, { duration: 180 }),
      );

      reactionEyeScaleY.value = withSequence(
        withTiming(0.10, { duration: 60 }),
        withDelay(80, withTiming(1, { duration: 105 })),
      );
    } else {
      // 쓰다듬은 듯 눈을 꼭 감고 폭신하게 눌렸다가 복귀.
      reactionEyeScaleY.value = withSequence(
        withTiming(0.08, { duration: 65 }),
        withDelay(150, withTiming(1, { duration: 120 })),
      );

      reactionScaleX.value = withSequence(
        withTiming(1.045, { duration: 95 }),
        withTiming(0.990, { duration: 115 }),
        withTiming(1, { duration: 150 }),
      );

      reactionScaleY.value = withSequence(
        withTiming(0.935, { duration: 95 }),
        withTiming(1.025, { duration: 115 }),
        withTiming(1, { duration: 150 }),
      );

      reactionBobY.value = withSequence(
        withTiming(size * 0.012, { duration: 95 }),
        withTiming(-size * 0.012, { duration: 115 }),
        withTiming(0, { duration: 150 }),
      );
    }

    onPress?.();
  }, [
    motionEnabled,
    onPress,
    reactionBobY,
    reactionEyeScaleY,
    reactionRotate,
    reactionScaleX,
    reactionScaleY,
    size,
  ]);

  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + bodyBobY.value + reactionBobY.value },
      { rotate: `${bodyRotate.value + reactionRotate.value}deg` },
      { scaleX: bodyScaleX.value * reactionScaleX.value },
      { scaleY: bodyScaleY.value * reactionScaleY.value },
    ],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { overflow: enabled ? 'hidden' : 'visible' },
        style,
      ]}
    >
      <Animated.View style={[styles.absolute, positionStyle]}>
        <MoniMascot
          color={color}
          faceColor={faceColor}
          accessorySource={accessorySource}
          accessoryName={accessoryName}
          motion={motion}
          motionEnabled={false}
          onPress={handleMascotPress}
          size={size}
          state={resolvedState}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  absolute: {
    position: 'absolute',
    left: 0,
    top: 0,
    backfaceVisibility: 'hidden',
  },
});
