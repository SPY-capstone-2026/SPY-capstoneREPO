import type { ImageSourcePropType } from 'react-native';

import type { ShopItem } from '@/types/api';

export type ShopCategory =
  | 'CHARACTER'
  | 'ACCESSORY'
  | 'WALLPAPER'
  | 'FLOORING'
  | 'FURNITURE'
  | 'DECOR'
  | 'THEME'
  | string;

export const SHOP_CATEGORY_ORDER = [
  'ALL',
  'CHARACTER',
  'ACCESSORY',
  'WALLPAPER',
  'FLOORING',
  'FURNITURE',
  'DECOR',
  'THEME',
] as const;

export const SHOP_CATEGORY_LABELS: Record<string, string> = {
  ALL: '전체',
  CHARACTER: '캐릭터',
  ACCESSORY: '액세서리',
  WALLPAPER: '벽지',
  FLOORING: '바닥',
  FURNITURE: '가구',
  DECOR: '소품',
  THEME: '테마',
};

export const RARITY_LABELS: Record<string, string> = {
  COMMON: 'COMMON',
  RARE: 'RARE',
  EPIC: 'EPIC',
};

export const RARITY_COLORS: Record<
  string,
  { text: string; background: string; border: string }
> = {
  COMMON: {
    text: '#487665',
    background: '#EEF8F3',
    border: '#CFE8DC',
  },
  RARE: {
    text: '#7A58A6',
    background: '#F5EFFB',
    border: '#E0D2F0',
  },
  EPIC: {
    text: '#B05B91',
    background: '#FFF0F8',
    border: '#F1CEE3',
  },
};

export const SHOP_ITEM_ASSETS: Record<string, ImageSourcePropType> = {

  리본: require('@/assets/shop/accessory_ribbon.png'),
  머리핀: require('@/assets/shop/accessory_hairpin.png'),
  '미니 모자': require('@/assets/shop/accessory_mini_hat.png'),
  왕관: require('@/assets/shop/accessory_crown.png'),

  '베이지 무지 벽지': require('@/assets/shop/wallpaper_beige.png'),
  '스트라이프 벽지': require('@/assets/shop/wallpaper_stripe.png'),
  '우드패널 벽지': require('@/assets/shop/wallpaper_woodpanel.png'),
  '플로럴 벽지': require('@/assets/shop/wallpaper_floral.png'),
  '갤럭시 벽지': require('@/assets/shop/wallpaper_galaxy.png'),

  '원목 바닥': require('@/assets/shop/flooring_wood.png'),
  '타일 바닥': require('@/assets/shop/flooring_tile.png'),
  '카펫 바닥': require('@/assets/shop/flooring_carpet.png'),
  '대리석 바닥': require('@/assets/shop/flooring_marble.png'),

  화분: require('@/assets/shop/furniture_plant.png'),
  '첫 화분': require('@/assets/shop/milestone_first_plant.png'),
  '스탠드 조명': require('@/assets/shop/furniture_lamp.png'),
  책장: require('@/assets/shop/furniture_bookshelf.png'),
  소파: require('@/assets/shop/furniture_sofa.png'),
  '프리미엄 소파': require('@/assets/shop/milestone_premium_sofa.png'),
  '책상 & 의자 세트': require('@/assets/shop/furniture_desk_chair.png'),
  침대: require('@/assets/shop/furniture_bed.png'),
  '골드 프레임 침대': require('@/assets/shop/furniture_gold_bed.png'),

  액자: require('@/assets/shop/decor_frame.png'),
  캔들: require('@/assets/shop/decor_candle.png'),
  '쿠션 세트': require('@/assets/shop/decor_cushion.png'),
  벽시계: require('@/assets/shop/decor_clock.png'),
  '미니 어항': require('@/assets/shop/decor_aquarium.png'),

  '카페 감성 풀세트': require('@/assets/shop/theme_cafe.png'),
  '우주 테마 풀세트': require('@/assets/shop/theme_space.png'),

  '스페셜 벽지 조각': require('@/assets/shop/milestone_special_wallpaper.png'),
  '스페셜 바닥재 조각': require('@/assets/shop/milestone_special_flooring.png'),
};

export const THEME_ROOM_ASSETS: Record<string, ImageSourcePropType> = {
  '카페 감성 풀세트': require('@/assets/shop/theme_cafe_room.png'),
  '우주 테마 풀세트': require('@/assets/shop/theme_space_room.png'),
};

export const ITEM_EFFECTS: Record<string, string> = {
  '민트 컬러': 'Moni의 몸 색상을 산뜻한 민트로 바꿔요.',
  '코랄 컬러': 'Moni의 몸 색상을 부드러운 코랄로 바꿔요.',
  '딥블루 컬러': 'Moni의 몸 색상을 차분한 딥블루로 바꿔요.',
  '골드 컬러': 'Moni를 반짝이는 골드 컬러로 바꿔요.',

  리본: 'Moni에게 작은 리본을 달아줘요.',
  머리핀: '귀 옆에 작은 머리핀을 달아줘요.',
  '미니 모자': 'Moni 머리 위에 작은 모자를 씌워요.',
  왕관: 'Moni 머리 위에 작은 왕관을 올려요.',

  '베이지 무지 벽지': '방을 밝고 편안한 베이지 톤으로 바꿔요.',
  '스트라이프 벽지': '방에 부드러운 세로 스트라이프 패턴을 적용해요.',
  '우드패널 벽지': '따뜻한 우드 패널 분위기를 만들어요.',
  '플로럴 벽지': '작은 플라워 패턴으로 방을 꾸며요.',
  '갤럭시 벽지': '방의 벽을 깊은 우주 느낌으로 바꿔요.',

  '원목 바닥': '밝고 따뜻한 원목 바닥을 적용해요.',
  '타일 바닥': '깔끔한 밝은 타일 바닥을 적용해요.',
  '카펫 바닥': '폭신한 카펫 바닥을 적용해요.',
  '대리석 바닥': '밝은 대리석 바닥을 적용해요.',

  화분: '방 한쪽에 작은 화분을 놓아요.',
  '첫 화분': 'Lv.5 성장 보상으로 받은 첫 화분이에요.',
  '스탠드 조명': '방에 따뜻한 스탠드 조명을 놓아요.',
  책장: '작은 책장을 방에 배치해요.',
  소파: '편안한 소파를 방에 놓아요.',
  '프리미엄 소파': 'Lv.20 성장 보상으로 받는 프리미엄 소파예요.',
  '책상 & 의자 세트': '작업용 책상과 의자를 방에 놓아요.',
  침대: 'Moni 방에 편안한 침대를 놓아요.',
  '골드 프레임 침대': '골드 프레임의 특별한 침대를 놓아요.',

  액자: '벽에 작은 액자를 걸어요.',
  캔들: '방에 작은 캔들 소품을 놓아요.',
  '쿠션 세트': '소파 근처에 포근한 쿠션을 배치해요.',
  벽시계: '벽에 작은 시계를 걸어요.',
  '미니 어항': '작은 어항을 방 한쪽에 놓아요.',

  '카페 감성 풀세트': '벽·바닥·가구를 카페 감성 방으로 한 번에 바꿔요.',
  '우주 테마 풀세트': '방 전체를 환상적인 우주 테마로 한 번에 바꿔요.',

  '스페셜 벽지 조각': 'Lv.10 성장 보상으로 지급되는 스페셜 벽지예요.',
  '스페셜 바닥재 조각': 'Lv.15 성장 보상으로 지급되는 스페셜 바닥재예요.',
};

export const CHARACTER_COLOR_BY_ITEM: Record<string, string> = {
  '민트 컬러': '#A8DDC0',
  '코랄 컬러': '#F39A8D',
  '딥블루 컬러': '#4D6FA8',
  '골드 컬러': '#D9AE45',
};

export const SINGLE_SLOT_CATEGORIES = new Set([
  'CHARACTER',
  'ACCESSORY',
  'WALLPAPER',
  'FLOORING',
  'THEME',
]);

export function getShopCategoryLabel(category: string) {
  return SHOP_CATEGORY_LABELS[category] ?? category;
}

export function getShopItemSource(
  item: Pick<ShopItem, 'name' | 'image_url'>
): ImageSourcePropType | null {
  if (item.image_url) {
    return { uri: item.image_url };
  }

  return SHOP_ITEM_ASSETS[item.name] ?? null;
}

export function getShopItemSourceByName(name: string | null | undefined) {
  if (!name) return null;
  return SHOP_ITEM_ASSETS[name] ?? null;
}

export function getThemeRoomSource(name: string | null | undefined) {
  if (!name) return null;
  return THEME_ROOM_ASSETS[name] ?? null;
}

export function getShopItemEffect(
  item: Pick<ShopItem, 'name' | 'description' | 'category'>
) {
  if (item.description?.trim()) return item.description.trim();
  return (
    ITEM_EFFECTS[item.name] ??
    `${getShopCategoryLabel(item.category)} 아이템을 Moni 방에 적용해요.`
  );
}

export function getCharacterColor(name: string | null | undefined) {
  if (!name) return null;
  return CHARACTER_COLOR_BY_ITEM[name] ?? null;
}

export function getEquipConflictCategories(category: string) {
  if (category === 'THEME') {
    return new Set(['THEME', 'WALLPAPER', 'FLOORING']);
  }

  if (category === 'WALLPAPER' || category === 'FLOORING') {
    return new Set([category, 'THEME']);
  }

  if (category === 'CHARACTER' || category === 'ACCESSORY') {
    return new Set([category]);
  }

  return new Set<string>();
}

export const MILESTONE_PREVIEWS = [
  {
    name: '첫 화분',
    category: 'FURNITURE',
    unlock_level: 5,
  },
  {
    name: '스페셜 벽지 조각',
    category: 'WALLPAPER',
    unlock_level: 10,
  },
  {
    name: '스페셜 바닥재 조각',
    category: 'FLOORING',
    unlock_level: 15,
  },
  {
    name: '프리미엄 소파',
    category: 'FURNITURE',
    unlock_level: 20,
  },
] as const;
