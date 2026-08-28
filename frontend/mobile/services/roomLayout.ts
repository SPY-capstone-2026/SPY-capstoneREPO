import type { ImageStyle, StyleProp } from 'react-native';

export const ROOM_FURNITURE_LAYOUT: Record<
  string,
  StyleProp<ImageStyle>
> = {
  화분: {
    left: 12,
    bottom: 24,
    width: 78,
    height: 78,
  },
  '첫 화분': {
    left: 12,
    bottom: 24,
    width: 78,
    height: 78,
  },
  '스탠드 조명': {
    right: 10,
    bottom: 22,
    width: 74,
    height: 108,
  },
  책장: {
    right: 8,
    bottom: 70,
    width: 100,
    height: 136,
  },
  소파: {
    right: 72,
    bottom: 16,
    width: 142,
    height: 94,
  },
  '프리미엄 소파': {
    right: 72,
    bottom: 16,
    width: 142,
    height: 94,
  },
  '책상 & 의자 세트': {
    left: 94,
    bottom: 16,
    width: 132,
    height: 100,
  },
  침대: {
    right: 18,
    bottom: 14,
    width: 154,
    height: 104,
  },
  '골드 프레임 침대': {
    right: 18,
    bottom: 14,
    width: 154,
    height: 104,
  },
};

export const ROOM_DECOR_LAYOUT: Record<
  string,
  StyleProp<ImageStyle>
> = {
  액자: {
    left: 42,
    top: 44,
    width: 58,
    height: 58,
  },
  캔들: {
    left: 116,
    bottom: 73,
    width: 46,
    height: 46,
  },
  '쿠션 세트': {
    right: 100,
    bottom: 20,
    width: 68,
    height: 56,
  },
  벽시계: {
    right: 42,
    top: 44,
    width: 54,
    height: 54,
  },
  '미니 어항': {
    left: 30,
    bottom: 17,
    width: 74,
    height: 62,
  },
};

/**
 * 가구가 너무 많이 적용되면 방이 완전히 가려지는 것을 막기 위한
 * 시각적 표시 상한입니다. 인벤토리의 장착 상태 자체는 그대로 유지됩니다.
 */
export const MAX_VISIBLE_FURNITURE = 4;
export const MAX_VISIBLE_DECOR = 5;
