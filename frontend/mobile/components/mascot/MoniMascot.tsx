import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

export type MascotState = 'idle' | 'walking' | 'celebrate' | 'sleep';

export type MascotMotionController = {
  leftEarRotate: SharedValue<number>;
  leftEarLift: SharedValue<number>;
  rightEarRotate: SharedValue<number>;
  rightEarLift: SharedValue<number>;

  leftPawLift: SharedValue<number>;
  rightPawLift: SharedValue<number>;

  tailRotate: SharedValue<number>;
  tailShiftX: SharedValue<number>;
  tailShiftY: SharedValue<number>;

  eyeScaleY: SharedValue<number>;
  reactionEyeScaleY: SharedValue<number>;
};

export type MoniMascotProps = {
  size?: number;
  color?: string;
  faceColor?: string;
  state?: MascotState;

  /**
   * 실제 애니메이션 타임라인은 WanderingMascot이 소유합니다.
   * MoniMascot은 전달받은 SharedValue를 한 SVG 안의 각 파트에만 적용합니다.
   */
  motion?: MascotMotionController;

  /**
   * 이전 호출부 호환용. 이 파일 자체에서 루프를 만들지는 않습니다.
   */
  motionEnabled?: boolean;

  accessorySource?: ImageSourcePropType | null;
  accessoryName?: string | null;

  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_COLOR = '#F6C95E';
const DEFAULT_FACE = '#74492C';

const VIEW_W = 1005;
const VIEW_H = 609;

/**
 * 아래 파트는 사용자가 제공한 최종 기준 이미지의 노란 실루엣을
 * 오프라인에서 영역별로 분리해 만든 독립 SVG path입니다.
 *
 * 런타임에서는:
 * - Mask 없음
 * - ClipPath 없음
 * - 전체 캐릭터 복제 없음
 * - requestAnimationFrame + React setState 없음
 *
 * 몸 / 왼귀 / 오른귀 / 왼발 / 오른발 / ni 꼬리가
 * 처음부터 각각 독립 path이므로 파트 자체를 자연스럽게 움직일 수 있습니다.
 */
const BODY_PATH =
  'M 58 165 L 51 203 L 29 242 L 17 271 L 10 294 L 4 323 L 0 357 L 1 406 L 6 437 L 11 454 L 19 474 L 30 494 L 53 524 L 71 541 L 92 557 L 118 571 L 120 559 L 270 559 L 271 599 L 324 599 L 325 559 L 485 559 L 486 563 L 500 554 L 528 559 L 543 559 L 563 556 L 575 552 L 587 546 L 599 536 L 599 391 L 582 424 L 581 421 L 584 408 L 586 367 L 585 342 L 580 306 L 574 282 L 562 248 L 537 203 L 530 165 L 309 165 L 308 103 L 301 103 L 300 107 L 293 112 L 288 110 L 282 103 L 281 165 Z';

const LEFT_EAR_PATH =
  'M 116 25 L 95 55 L 78 93 L 65 134 L 50 204 L 302 204 L 302 101 L 300 107 L 296 111 L 290 111 L 285 107 L 262 65 L 252 50 L 232 27 L 208 9 L 194 3 L 180 0 L 162 0 L 149 3 L 134 10 Z';

const RIGHT_EAR_PATH =
  'M 288 110 L 288 204 L 538 204 L 520 124 L 500 69 L 491 51 L 477 30 L 458 12 L 440 3 L 427 0 L 406 0 L 385 6 L 366 17 L 340 41 L 326 59 L 313 80 L 300 107 L 293 112 Z';

const TAIL_PATH =
  'M 535 528 ' +
  'C 558 539 576 526 590 500 ' +
  'L 685 326 ' +
  'C 693 311 706 309 718 322 ' +
  'L 812 423 ' +
  'C 824 436 838 430 840 413 ' +
  'L 849 289';

const LEFT_PAW_PATH =
  'M 120 525 L 120 572 L 144 581 L 147 594 L 151 599 L 159 604 L 175 608 L 201 608 L 218 604 L 223 601 L 226 596 L 270 598 L 270 525 Z';

const RIGHT_PAW_PATH =
  'M 325 525 L 325 599 L 361 597 L 367 604 L 376 607 L 420 607 L 429 604 L 439 595 L 441 591 L 441 584 L 443 582 L 468 573 L 485 564 L 485 525 Z';

const I_DOT_PATH =
  'M 873 154 L 858 157 L 847 163 L 840 170 L 833 182 L 830 200 L 832 211 L 837 222 L 847 233 L 860 240 L 877 242 L 895 236 L 909 223 L 915 210 L 916 192 L 910 175 L 898 162 L 886 156 Z';

const AnimatedG = Animated.createAnimatedComponent(G);

export function MoniMascot({
  size = 148,
  color = DEFAULT_COLOR,
  faceColor = DEFAULT_FACE,
  state = 'idle',
  motion,
  accessorySource,
  accessoryName,
  onPress,
  style,
  testID = 'moni-cat-mascot',
}: MoniMascotProps) {
  const stageHeight = size;
  const stageWidth = size * (VIEW_W / VIEW_H);

  // Static fallback values. They never animate by themselves.
  const fallbackLeftEarRotate = useSharedValue(0);
  const fallbackLeftEarLift = useSharedValue(0);
  const fallbackRightEarRotate = useSharedValue(0);
  const fallbackRightEarLift = useSharedValue(0);

  const fallbackLeftPawLift = useSharedValue(0);
  const fallbackRightPawLift = useSharedValue(0);

  const fallbackTailRotate = useSharedValue(0);
  const fallbackTailShiftX = useSharedValue(0);
  const fallbackTailShiftY = useSharedValue(0);

  const fallbackEyeScaleY = useSharedValue(state === 'sleep' ? 0.12 : 1);
  const fallbackReactionEyeScaleY = useSharedValue(1);

  const leftEarRotate = motion?.leftEarRotate ?? fallbackLeftEarRotate;
  const leftEarLift = motion?.leftEarLift ?? fallbackLeftEarLift;
  const rightEarRotate = motion?.rightEarRotate ?? fallbackRightEarRotate;
  const rightEarLift = motion?.rightEarLift ?? fallbackRightEarLift;

  const leftPawLift = motion?.leftPawLift ?? fallbackLeftPawLift;
  const rightPawLift = motion?.rightPawLift ?? fallbackRightPawLift;

  const tailRotate = motion?.tailRotate ?? fallbackTailRotate;
  const tailShiftX = motion?.tailShiftX ?? fallbackTailShiftX;
  const tailShiftY = motion?.tailShiftY ?? fallbackTailShiftY;

  const eyeScaleY = motion?.eyeScaleY ?? fallbackEyeScaleY;
  const reactionEyeScaleY = motion?.reactionEyeScaleY ?? fallbackReactionEyeScaleY;

  const leftEarProps = useAnimatedProps(
    () =>
      ({
        transform:
          `translate(0 ${leftEarLift.value}) rotate(${leftEarRotate.value} 265 198)`,
      }),
  );

  const rightEarProps = useAnimatedProps(
    () =>
      ({
        transform:
          `translate(0 ${rightEarLift.value}) rotate(${rightEarRotate.value} 330 198)`,
      }),
  );

  const leftPawProps = useAnimatedProps(
    () =>
      ({
        transform: `translate(0 ${leftPawLift.value})`,
      }),
  );

  const rightPawProps = useAnimatedProps(
    () =>
      ({
        transform: `translate(0 ${rightPawLift.value})`,
      }),
  );

  const tailProps = useAnimatedProps(
    () =>
      ({
        transform:
          `translate(${tailShiftX.value} ${tailShiftY.value}) rotate(${tailRotate.value} 535 528)`,
      }),
  );

  const eyeProps = useAnimatedProps(
    () =>
      ({
        transform:
          `translate(0 376) scale(1 ${eyeScaleY.value * reactionEyeScaleY.value}) translate(0 -376)`,
      }),
  );

  const accessoryLayout = (() => {
    switch (accessoryName) {
      case '리본':
        return {
          left: size * 0.36,
          top: size * 0.52,
          width: size * 0.30,
          height: size * 0.23,
        };
      case '머리핀':
        return {
          left: size * 0.12,
          top: size * 0.07,
          width: size * 0.22,
          height: size * 0.18,
        };
      case '미니 모자':
        return {
          left: size * 0.23,
          top: -size * 0.04,
          width: size * 0.32,
          height: size * 0.26,
        };
      case '왕관':
        return {
          left: size * 0.24,
          top: -size * 0.07,
          width: size * 0.31,
          height: size * 0.27,
        };
      default:
        return {
          left: size * 0.24,
          top: size * 0.02,
          width: size * 0.28,
          height: size * 0.24,
        };
    }
  })();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel="모니 고양이 캐릭터"
      disabled={!onPress}
      onPress={onPress}
      style={style}
      testID={testID}
    >
      <View
        style={[
          styles.stage,
          {
            width: stageWidth,
            height: stageHeight,
          },
        ]}
      >
        <Svg
          width={stageWidth}
          height={stageHeight}
          viewBox="0 0 1005 609"
          preserveAspectRatio="xMidYMid meet"
        >
          <Ellipse
            cx={315}
            cy={596}
            rx={220}
            ry={11}
            fill="rgba(235,224,205,0.20)"
          />

          {/*
            꼬리를 몸 뒤에 먼저 그립니다.
            TAIL_PATH 자체가 몸 안쪽까지 깊게 들어오기 때문에 회전해도
            접합부에 빈틈이 생기지 않습니다.
          */}
          <AnimatedG animatedProps={tailProps}>
            <Path
              d={TAIL_PATH}
              fill="none"
              stroke={color}
              strokeWidth={52}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d={I_DOT_PATH} fill={color} />
          </AnimatedG>

          {/*
            귀 역시 몸 안쪽까지 겹치는 별도 path입니다.
            작은 각도로 회전해도 몸이 접합부를 덮어 줍니다.
          */}
          <AnimatedG animatedProps={leftEarProps}>
            <Path d={LEFT_EAR_PATH} fill={color} />
          </AnimatedG>

          <AnimatedG animatedProps={rightEarProps}>
            <Path d={RIGHT_EAR_PATH} fill={color} />
          </AnimatedG>

          {/* 몸통은 안정적인 기준 레이어 */}
          <Path d={BODY_PATH} fill={color} />

          {/*
            발 path 위쪽이 몸 안에 충분히 들어갑니다.
            아래의 작은 connector는 subpixel 경계가 비치는 것을 막습니다.
          */}
          <AnimatedG animatedProps={leftPawProps}>
            <Ellipse cx={195} cy={548} rx={48} ry={25} fill={color} />
            <Path d={LEFT_PAW_PATH} fill={color} />
          </AnimatedG>

          <AnimatedG animatedProps={rightPawProps}>
            <Ellipse cx={405} cy={548} rx={48} ry={25} fill={color} />
            <Path d={RIGHT_PAW_PATH} fill={color} />
          </AnimatedG>

          {/* 얼굴도 같은 SVG 안에서 렌더링 */}
          <AnimatedG animatedProps={eyeProps}>
            <Ellipse cx={172} cy={376} rx={20.5} ry={20.5} fill={faceColor} />
            <Ellipse cx={417} cy={376} rx={20.5} ry={20.5} fill={faceColor} />
          </AnimatedG>

          <Path
            d="M 259 403
               C 270 417 282 417 294 403
               C 306 417 318 417 329 403"
            fill="none"
            stroke={faceColor}
            strokeWidth={8}
            strokeLinecap="round"
          />
        </Svg>

        {accessorySource ? (
          <Image
            source={accessorySource}
            resizeMode="contain"
            style={[styles.accessory, accessoryLayout]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    overflow: 'visible',
  },
  accessory: {
    position: 'absolute',
    zIndex: 10,
  },
});
