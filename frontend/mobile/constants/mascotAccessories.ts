import type { ImageStyle, ViewStyle } from 'react-native';

export type MascotAccessoryAnchor =
  | 'headTop'
  | 'leftEar'
  | 'neck'
  | 'chest';

type NormalizedPoint = {
  x: number;
  y: number;
};

type SourceCrop = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type MascotAccessoryPlacement = {
  anchor: MascotAccessoryAnchor;
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  rotate?: string;
  crop: SourceCrop;
};

export type MascotAccessoryRenderStyle = {
  frame: ViewStyle;
  image: ImageStyle;
};

/**
 * Moni SVG의 실제 몸통은 stageHeight(size)와 거의 같은 폭을 사용.
 * 아래 anchor는 stage 전체 폭이 아니라 mascot size 기준 좌표.
 *
 * 액세서리 PNG는 상점 썸네일용 여백/그림자를 포함하므로,
 * crop 영역을 지정해서 장착 시에는 실제 액세서리 부분만 보이게 함.
 */
const MASCOT_ANCHORS: Record<MascotAccessoryAnchor, NormalizedPoint> = {
  headTop: { x: 0.485, y: 0.06 },
  leftEar: { x: 0.25, y: 0.145 },
  neck: { x: 0.485, y: 0.745 },
  chest: { x: 0.485, y: 0.79 },
};

const SOURCE_SIZE = 512;

function sourceCrop(
  left: number,
  top: number,
  right: number,
  bottom: number
): SourceCrop {
  return {
    left: left / SOURCE_SIZE,
    top: top / SOURCE_SIZE,
    right: right / SOURCE_SIZE,
    bottom: bottom / SOURCE_SIZE,
  };
}

/**
 * width / height는 "실제로 보이는 액세서리 영역"의 크기.
 * PNG 전체 512x512를 그대로 배치하지 않고 crop 후 anchor에 맞춰 렌더링.
 *
 * 배치 기준:
 * - 리본: 입 아래 목/가슴 시작점
 * - 머리핀: 왼쪽 귀와 머리 경계
 * - 모자/왕관/머리띠: 머리 위
 * - 스카프: 입 아래 목 위치
 * - 목걸이: 가슴 중앙
 */
export const MASCOT_ACCESSORY_PLACEMENTS: Record<
  string,
  MascotAccessoryPlacement
> = {
  리본: {
    anchor: 'neck',
    width: 0.23,
    height: 0.085,
    offsetY: 0.035,
    crop: sourceCrop(68, 174, 445, 330),
  },
  머리핀: {
    anchor: 'leftEar',
    width: 0.19,
    height: 0.09,
    offsetX: -0.04,
    offsetY: 0.00,
    rotate: '-18deg',
    crop: sourceCrop(136, 170, 410, 327),
  },
  '미니 모자': {
    anchor: 'headTop',
    width: 0.24,
    height: 0.13,
    offsetY: 0.085,
    rotate: '-3deg',
    crop: sourceCrop(110, 158, 404, 346),
  },
  왕관: {
    anchor: 'headTop',
    width: 0.23,
    height: 0.15,
    offsetY: 0.082,
    crop: sourceCrop(115, 112, 399, 348),
  },

  '체크 스카프': {
    anchor: 'neck',
    width: 0.25,
    height: 0.14,
    offsetY: 0.045,
    crop: sourceCrop(100, 110, 425, 390),
  },
  '별 목걸이': {
    anchor: 'chest',
    width: 0.16,
    height: 0.08,
    offsetY: 0.025,
    crop: sourceCrop(110, 210, 405, 375),
  },
  '토끼 머리띠': {
    anchor: 'headTop',
    width: 0.26,
    height: 0.19,
    offsetY: 0.086,
    crop: sourceCrop(105, 35, 408, 270),
  },
};

const FALLBACK: MascotAccessoryPlacement = {
  anchor: 'headTop',
  width: 0.18,
  height: 0.12,
  crop: {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
  },
};

export function getMascotAccessoryRenderStyle(
  name: string | null | undefined,
  size: number
): MascotAccessoryRenderStyle {
  const placement = (name && MASCOT_ACCESSORY_PLACEMENTS[name]) || FALLBACK;
  const anchor = MASCOT_ANCHORS[placement.anchor];

  const frameWidth = size * placement.width;
  const frameHeight = size * placement.height;

  const centerX = size * (anchor.x + (placement.offsetX ?? 0));
  const centerY = size * (anchor.y + (placement.offsetY ?? 0));

  const cropWidth = placement.crop.right - placement.crop.left;
  const cropHeight = placement.crop.bottom - placement.crop.top;

  const uniformImageSize = Math.max(frameWidth / cropWidth, frameHeight / cropHeight);
  const renderedImageWidth = uniformImageSize;
  const renderedImageHeight = uniformImageSize;

  return {
    frame: {
      position: 'absolute',
      left: centerX - frameWidth / 2,
      top: centerY - frameHeight / 2,
      width: frameWidth,
      height: frameHeight,
      overflow: 'hidden',
      zIndex: 10,
      transform: placement.rotate ? [{ rotate: placement.rotate }] : undefined,
    },
    image: {
      position: 'absolute',
      left: -placement.crop.left * renderedImageWidth,
      top: -placement.crop.top * renderedImageHeight,
      width: renderedImageWidth,
      height: renderedImageHeight,
    },
  };
}
