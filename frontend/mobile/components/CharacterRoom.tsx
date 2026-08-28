import { useMemo } from 'react';
import {
  Image,
  ImageBackground,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { WanderingMascot } from '@/components/mascot';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import {
  getCharacterColor,
  getShopItemSourceByName,
  getThemeRoomSource,
} from '@/services/shopCatalog';
import {
  MAX_VISIBLE_DECOR,
  MAX_VISIBLE_FURNITURE,
  ROOM_DECOR_LAYOUT,
  ROOM_FURNITURE_LAYOUT,
} from '@/services/roomLayout';
import type { InventoryItem } from '@/types/api';

type Props = {
  inventory: InventoryItem[];
  onMascotPress?: () => void;
};

type EquippedAsset = {
  id: string;
  name: string;
  source: ImageSourcePropType | null;
  acquiredAt: string | null;
};

function toAsset(entry: InventoryItem): EquippedAsset {
  return {
    id: entry.id,
    name: entry.item?.name ?? '',
    source: getShopItemSourceByName(entry.item?.name),
    acquiredAt: entry.acquired_at,
  };
}

function newestFirst(a: EquippedAsset, b: EquippedAsset) {
  return (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? '');
}

export function CharacterRoom({
  inventory,
  onMascotPress,
}: Props) {
  const equipped = useMemo(
    () =>
      inventory.filter(
        (entry) => entry.is_equipped && entry.item
      ),
    [inventory]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();

    equipped.forEach((entry) => {
      const category = entry.item?.category;
      if (!category) return;

      const current = map.get(category) ?? [];
      current.push(entry);
      map.set(category, current);
    });

    return map;
  }, [equipped]);

  const characterItem =
    byCategory.get('CHARACTER')?.at(-1)?.item ?? null;

  const accessoryItem =
    byCategory.get('ACCESSORY')?.at(-1)?.item ?? null;

  const themeItem =
    byCategory.get('THEME')?.at(-1)?.item ?? null;

  const wallpaperItem =
    byCategory.get('WALLPAPER')?.at(-1)?.item ?? null;

  const flooringItem =
    byCategory.get('FLOORING')?.at(-1)?.item ?? null;

  const furniture = useMemo(
    () =>
      (byCategory.get('FURNITURE') ?? [])
        .map(toAsset)
        .sort(newestFirst)
        .slice(0, MAX_VISIBLE_FURNITURE),
    [byCategory]
  );

  const decor = useMemo(
    () =>
      (byCategory.get('DECOR') ?? [])
        .map(toAsset)
        .sort(newestFirst)
        .slice(0, MAX_VISIBLE_DECOR),
    [byCategory]
  );

  const themeSource = getThemeRoomSource(themeItem?.name);
  const wallpaperSource =
    getShopItemSourceByName(wallpaperItem?.name);
  const flooringSource =
    getShopItemSourceByName(flooringItem?.name);

  // CHARACTER 아이템은 이미지가 아니라 실제 SVG 색상으로 적용합니다.
  const mascotColor =
    getCharacterColor(characterItem?.name) ?? '#F6C95E';

  // ACCESSORY 아이템은 움직이는 Moni 내부에 장착됩니다.
  const accessorySource =
    getShopItemSourceByName(accessoryItem?.name);

  const roomContent = (
    <>
      {!themeSource ? (
        <>
          <View style={styles.defaultWall} />

          {wallpaperSource ? (
            <Image
              source={wallpaperSource}
              resizeMode="cover"
              style={styles.wallpaper}
            />
          ) : null}

          <View style={styles.defaultFloor} />

          {flooringSource ? (
            <Image
              source={flooringSource}
              resizeMode="cover"
              style={styles.flooring}
            />
          ) : null}
        </>
      ) : null}

      <View pointerEvents="none" style={styles.roomLine} />

      {decor.map((asset) =>
        asset.source ? (
          <Image
            key={asset.id}
            source={asset.source}
            resizeMode="contain"
            style={[
              styles.roomAsset,
              ROOM_DECOR_LAYOUT[asset.name] ??
                styles.fallbackDecor,
            ]}
          />
        ) : null
      )}

      {furniture.map((asset) =>
        asset.source ? (
          <Image
            key={asset.id}
            source={asset.source}
            resizeMode="contain"
            style={[
              styles.roomAsset,
              ROOM_FURNITURE_LAYOUT[asset.name] ??
                styles.fallbackFurniture,
            ]}
          />
        ) : null
      )}

      {/*
        캐릭터는 바닥 영역에서만 움직입니다.
        movementMode="ground"가 targetY를 바닥 기준선 근처로 제한하므로
        이 영역 안에서도 사실상 좌우 위주로 움직입니다.
      */}
      <View style={styles.floorWalkZone}>
        <WanderingMascot
          enabled
          motionEnabled
          movementMode="ground"
          size={82}
          speed="slow"
          minPauseMs={650}
          maxPauseMs={1250}
          padding={6}
          color={mascotColor}
          accessorySource={accessorySource}
          accessoryName={accessoryItem?.name ?? null}
          onPress={onMascotPress}
          style={styles.wanderArea}
        />
      </View>

      <View pointerEvents="none" style={styles.tipPill}>
        <Text style={styles.tipText}>
          바닥을 돌아다니는 Moni를 눌러보세요
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.room}>
      {themeSource ? (
        <ImageBackground
          source={themeSource}
          resizeMode="cover"
          style={styles.themeBackground}
          imageStyle={styles.themeImage}
        >
          {roomContent}
        </ImageBackground>
      ) : (
        roomContent
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    height: 390,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F7F1E7',
    overflow: 'hidden',
    position: 'relative',
  },
  themeBackground: {
    flex: 1,
    position: 'relative',
  },
  themeImage: {
    opacity: 0.98,
  },
  defaultWall: {
    ...StyleSheet.absoluteFillObject,
    bottom: '30%',
    backgroundColor: '#F7F1E6',
  },
  wallpaper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '71%',
    opacity: 0.95,
  },
  defaultFloor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '31%',
    backgroundColor: '#E8D2AD',
  },
  flooring: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '32%',
  },
  roomLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '30%',
    height: 1,
    backgroundColor: 'rgba(86,70,49,0.09)',
  },
  roomAsset: {
    position: 'absolute',
    zIndex: 4,
  },
  fallbackFurniture: {
    right: 12,
    bottom: 18,
    width: 92,
    height: 92,
  },
  fallbackDecor: {
    left: 22,
    top: 48,
    width: 60,
    height: 60,
  },
  floorWalkZone: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    height: 126,
    zIndex: 12,
    overflow: 'hidden',
  },
  wanderArea: {
    width: '100%',
    height: '100%',
  },
  tipPill: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    zIndex: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(232,232,227,0.96)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tipText: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.subText,
  },
});
