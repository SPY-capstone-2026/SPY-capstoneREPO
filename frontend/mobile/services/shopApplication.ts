export type ShopApplicationKind =
  | 'CHARACTER_COLOR'
  | 'CHARACTER_ACCESSORY'
  | 'WALLPAPER'
  | 'FLOORING'
  | 'FURNITURE'
  | 'DECOR'
  | 'THEME';

export const SHOP_APPLICATION_KIND_BY_NAME: Record<
  string,
  ShopApplicationKind
> = {
  '민트 컬러': 'CHARACTER_COLOR',
  '코랄 컬러': 'CHARACTER_COLOR',
  '딥블루 컬러': 'CHARACTER_COLOR',
  '골드 컬러': 'CHARACTER_COLOR',

  리본: 'CHARACTER_ACCESSORY',
  머리핀: 'CHARACTER_ACCESSORY',
  '미니 모자': 'CHARACTER_ACCESSORY',
  왕관: 'CHARACTER_ACCESSORY',

  '베이지 무지 벽지': 'WALLPAPER',
  '스트라이프 벽지': 'WALLPAPER',
  '우드패널 벽지': 'WALLPAPER',
  '플로럴 벽지': 'WALLPAPER',
  '갤럭시 벽지': 'WALLPAPER',
  '스페셜 벽지 조각': 'WALLPAPER',

  '원목 바닥': 'FLOORING',
  '타일 바닥': 'FLOORING',
  '카펫 바닥': 'FLOORING',
  '대리석 바닥': 'FLOORING',
  '스페셜 바닥재 조각': 'FLOORING',

  화분: 'FURNITURE',
  '첫 화분': 'FURNITURE',
  '스탠드 조명': 'FURNITURE',
  책장: 'FURNITURE',
  소파: 'FURNITURE',
  '프리미엄 소파': 'FURNITURE',
  '책상 & 의자 세트': 'FURNITURE',
  침대: 'FURNITURE',
  '골드 프레임 침대': 'FURNITURE',

  액자: 'DECOR',
  캔들: 'DECOR',
  '쿠션 세트': 'DECOR',
  벽시계: 'DECOR',
  '미니 어항': 'DECOR',

  '카페 감성 풀세트': 'THEME',
  '우주 테마 풀세트': 'THEME',
};

export function getShopApplicationKind(name: string) {
  return SHOP_APPLICATION_KIND_BY_NAME[name] ?? null;
}
