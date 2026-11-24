import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  ImageSourcePropType,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ImageStyle } from 'react-native';

import { WanderingMascot } from '@/components/mascot';
import { colors } from '@/constants/colors';
import { getCurrentUser } from '@/services/authService';
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
import {
  clampRoomValue,
  MAX_ROOM_ASSET_SCALE,
  MIN_ROOM_ASSET_SCALE,
  readRoomPlacements,
  writeRoomPlacements,
} from '@/services/roomPlacementStorage';
import type { RoomPlacement, RoomPlacementMap } from '@/services/roomPlacementStorage';
import type { InventoryItem } from '@/types/api';

type Props = {
  inventory: InventoryItem[];
  onMascotPress?: () => void;
  /** 다른 화면에서 가구 편집기로 바로 열 때 사용합니다. */
  startInEditMode?: boolean;
  /** 편집기에서 저장 또는 취소한 뒤 호출합니다. */
  onEditorClose?: () => void;
};

type RoomAsset = {
  id: string;
  name: string;
  category: 'FURNITURE' | 'DECOR';
  source: ImageSourcePropType;
  acquiredAt: string | null;
};

type Bounds = { width: number; height: number };
type Rect = { left: number; top: number; width: number; height: number };

type RoomStageProps = {
  furniture: RoomAsset[];
  decor: RoomAsset[];
  themeSource: ImageSourcePropType | null;
  wallpaperSource: ImageSourcePropType | null;
  flooringSource: ImageSourcePropType | null;
  mascotColor: string;
  accessorySource: ImageSourcePropType | null;
  accessoryName: string | null;
  placements: RoomPlacementMap;
  editing: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPlacementChange: (id: string, next: RoomPlacement) => void;
  onMascotPress?: () => void;
  onOpenEditor?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return clampRoomValue(value, min, Math.max(min, max));
}

function numeric(value: ImageStyle[keyof ImageStyle] | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function baseRect(asset: RoomAsset, bounds: Bounds): Rect {
  const fallback = asset.category === 'FURNITURE' ? styles.fallbackFurniture : styles.fallbackDecor;
  const map = asset.category === 'FURNITURE' ? ROOM_FURNITURE_LAYOUT : ROOM_DECOR_LAYOUT;
  const layout = (StyleSheet.flatten(map[asset.name] ?? fallback) ?? {}) as ImageStyle;
  const width = numeric(layout.width, asset.category === 'FURNITURE' ? 92 : 60);
  const height = numeric(layout.height, asset.category === 'FURNITURE' ? 92 : 60);
  const left = typeof layout.left === 'number'
    ? layout.left
    : bounds.width - numeric(layout.right, 12) - width;
  const top = typeof layout.top === 'number'
    ? layout.top
    : bounds.height - numeric(layout.bottom, 18) - height;
  return { left, top, width, height };
}

/** Generate the default center from the existing roomLayout.ts positions. */
function defaultPlacement(asset: RoomAsset, bounds: Bounds): RoomPlacement {
  const rect = baseRect(asset, bounds);
  return {
    x: clamp((rect.left + rect.width / 2) / Math.max(1, bounds.width), 0, 1),
    y: clamp((rect.top + rect.height / 2) / Math.max(1, bounds.height), 0, 1),
    scale: 1,
  };
}

function assetRect(asset: RoomAsset, bounds: Bounds, placement: RoomPlacement): Rect {
  const original = baseRect(asset, bounds);
  const width = Math.min(bounds.width, original.width * placement.scale);
  const height = Math.min(bounds.height, original.height * placement.scale);
  return {
    left: clamp(placement.x * bounds.width - width / 2, 0, bounds.width - width),
    top: clamp(placement.y * bounds.height - height / 2, 0, bounds.height - height),
    width,
    height,
  };
}

/** PanResponder works with touch on mobile and mouse dragging on Expo Web. */
function EditableAsset({
  asset,
  bounds,
  placement,
  selected,
  onSelect,
  onChange,
}: {
  asset: RoomAsset;
  bounds: Bounds;
  placement: RoomPlacement;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, next: RoomPlacement) => void;
}) {
  const latest = useRef({ asset, bounds, placement, onSelect, onChange });
  latest.current = { asset, bounds, placement, onSelect, onChange };
  const start = useRef<RoomPlacement>(placement);
  const pan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const current = latest.current;
        start.current = current.placement;
        current.onSelect(current.asset.id);
      },
      onPanResponderMove: (_event, gesture) => {
        const current = latest.current;
        const { width, height } = current.bounds;
        if (!width || !height) return;
        current.onChange(current.asset.id, {
          x: clamp(start.current.x + gesture.dx / width, 0, 1),
          y: clamp(start.current.y + gesture.dy / height, 0, 1),
          scale: start.current.scale,
        });
      },
      onPanResponderTerminationRequest: () => false,
    }),
    []
  );
  const rect = assetRect(asset, bounds, placement);
  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel={`${asset.name}, 이동 가능`}
      style={[
        styles.editAsset,
        rect,
        selected ? styles.selectedAsset : styles.unselectedAsset,
      ]}
    >
      <Image source={asset.source} resizeMode="contain" style={styles.editAssetImage} />
      {selected ? <View pointerEvents="none" style={styles.selectionDot} /> : null}
    </View>
  );
}

function RoomStage({
  furniture,
  decor,
  themeSource,
  wallpaperSource,
  flooringSource,
  mascotColor,
  accessorySource,
  accessoryName,
  placements,
  editing,
  selectedId,
  onSelect,
  onPlacementChange,
  onMascotPress,
  onOpenEditor,
}: RoomStageProps) {
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 });
  const assets = useMemo(() => [...decor, ...furniture], [decor, furniture]);
  const content = (
    <>
      {!themeSource ? (
        <>
          <View style={styles.defaultWall} />
          {wallpaperSource ? <Image source={wallpaperSource} resizeMode="cover" style={styles.wallpaper} /> : null}
          <View style={styles.defaultFloor} />
          {flooringSource ? <Image source={flooringSource} resizeMode="cover" style={styles.flooring} /> : null}
        </>
      ) : null}
      <View pointerEvents="none" style={styles.roomLine} />

      {bounds.width > 0 && bounds.height > 0 ? assets.map((asset) => {
        const placement = placements[asset.id] ?? defaultPlacement(asset, bounds);
        if (editing) {
          return (
            <EditableAsset
              key={asset.id}
              asset={asset}
              bounds={bounds}
              placement={placement}
              selected={selectedId === asset.id}
              onSelect={onSelect}
              onChange={onPlacementChange}
            />
          );
        }
        return (
          <Image
            key={asset.id}
            source={asset.source}
            resizeMode="contain"
            style={[styles.roomAsset, assetRect(asset, bounds, placement)]}
          />
        );
      }) : null}

      <View style={styles.floorWalkZone} pointerEvents={editing ? 'none' : 'auto'}>
        <WanderingMascot
          enabled={!editing}
          motionEnabled={!editing}
          movementMode="ground"
          size={82}
          speed="slow"
          minPauseMs={650}
          maxPauseMs={1250}
          padding={6}
          color={mascotColor}
          accessorySource={accessorySource}
          accessoryName={accessoryName}
          onPress={editing ? undefined : onMascotPress}
          style={styles.wanderArea}
        />
      </View>

      {onOpenEditor && !editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="가구 배치 편집 모드 열기"
          onPress={onOpenEditor}
          style={({ pressed }) => [styles.editEntry, pressed && styles.pressed]}
        >
          <Text style={styles.editEntryText}>가구 편집</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (Math.abs(bounds.width - width) >= 1 || Math.abs(bounds.height - height) >= 1) {
          setBounds({ width, height });
        }
      }}
      style={[styles.room, editing && styles.editorRoom]}
    >
      {themeSource ? (
        <ImageBackground source={themeSource} resizeMode="cover" style={styles.themeBackground} imageStyle={styles.themeImage}>
          {content}
        </ImageBackground>
      ) : content}
    </View>
  );
}

function toAsset(entry: InventoryItem, category: 'FURNITURE' | 'DECOR'): RoomAsset | null {
  const name = entry.item?.name;
  const source = getShopItemSourceByName(name);
  if (!name || !source) return null;
  return { id: entry.id, name, category, source, acquiredAt: entry.acquired_at };
}

function newestFirst(a: RoomAsset, b: RoomAsset) {
  return (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? '');
}

export function CharacterRoom({ inventory, onMascotPress, startInEditMode = false, onEditorClose }: Props) {
  const equipped = useMemo(() => inventory.filter((entry) => entry.is_equipped && entry.item), [inventory]);
  const byCategory = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    equipped.forEach((entry) => {
      const category = entry.item?.category;
      if (!category) return;
      map.set(category, [...(map.get(category) ?? []), entry]);
    });
    return map;
  }, [equipped]);

  const characterItem = byCategory.get('CHARACTER')?.at(-1)?.item ?? null;
  const accessoryItem = byCategory.get('ACCESSORY')?.at(-1)?.item ?? null;
  const themeItem = byCategory.get('THEME')?.at(-1)?.item ?? null;
  const wallpaperItem = byCategory.get('WALLPAPER')?.at(-1)?.item ?? null;
  const flooringItem = byCategory.get('FLOORING')?.at(-1)?.item ?? null;

  const furniture = useMemo(
    () => (byCategory.get('FURNITURE') ?? [])
      .map((entry) => toAsset(entry, 'FURNITURE'))
      .filter((item): item is RoomAsset => item !== null)
      .sort(newestFirst)
      .slice(0, MAX_VISIBLE_FURNITURE),
    [byCategory]
  );
  const decor = useMemo(
    () => (byCategory.get('DECOR') ?? [])
      .map((entry) => toAsset(entry, 'DECOR'))
      .filter((item): item is RoomAsset => item !== null)
      .sort(newestFirst)
      .slice(0, MAX_VISIBLE_DECOR),
    [byCategory]
  );
  const themeSource = getThemeRoomSource(themeItem?.name);
  const wallpaperSource = getShopItemSourceByName(wallpaperItem?.name);
  const flooringSource = getShopItemSourceByName(flooringItem?.name);
  const mascotColor = getCharacterColor(characterItem?.name) ?? '#F6C95E';
  const accessorySource = getShopItemSourceByName(accessoryItem?.name);

  const [userId, setUserId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [saved, setSaved] = useState<RoomPlacementMap>({});
  const [draft, setDraft] = useState<RoomPlacementMap>({});
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [editorBounds, setEditorBounds] = useState<Bounds>({ width: 0, height: 0 });
  const autoEditOpenedRef = useRef(false);

  // Only the owner's character screen supplies onMascotPress. Friend previews
  // must remain read-only and must never load this device's saved room layout.
  const allowEditing = Boolean(onMascotPress) || startInEditMode;
  useEffect(() => {
    if (!allowEditing) return;
    let active = true;
    (async () => {
      try {
        const me = await getCurrentUser();
        if (!me?.user_id) throw new Error('사용자 정보를 확인할 수 없습니다.');
        const loaded = await readRoomPlacements(me.user_id);
        if (active) {
          setUserId(me.user_id);
          setSaved(loaded);
          setDraft(loaded);
        }
      } catch {
        if (active) setUserId(null);
      } finally {
        if (active) setStorageLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [allowEditing]);

  const startEditing = () => {
    if (!storageLoaded || !userId) {
      setErrorText('사용자 정보를 불러오지 못해 배치를 저장할 수 없습니다.');
      return;
    }
    setDraft({ ...saved });
    setSelectedId(null);
    setErrorText('');
    setEditing(true);
  };

  // 전용 편집 화면에서는 사용자/배치 정보 로딩 직후 편집 모달을 자동으로 엽니다.
  useEffect(() => {
    if (!startInEditMode || autoEditOpenedRef.current || !storageLoaded || !userId) return;
    autoEditOpenedRef.current = true;
    setDraft({ ...saved });
    setSelectedId(null);
    setErrorText('');
    setEditing(true);
  }, [startInEditMode, storageLoaded, userId, saved]);

  const closeWithoutSaving = () => {
    if (saving) return;
    setDraft({ ...saved });
    setSelectedId(null);
    setErrorText('');
    setEditing(false);
    onEditorClose?.();
  };

  const handleChange = useCallback((id: string, next: RoomPlacement) => {
    setDraft((current) => ({ ...current, [id]: next }));
  }, []);

  const allAssets = useMemo(() => [...decor, ...furniture], [decor, furniture]);
  const selectedAsset = allAssets.find((item) => item.id === selectedId) ?? null;

  // Keep the toolbar responsive when users select before dragging.
  const effectivePlacement = selectedAsset
    ? draft[selectedAsset.id] ?? defaultPlacement(selectedAsset, editorBounds.width > 0 ? editorBounds : { width: 360, height: 390 })
    : null;

  const changeSelected = (dx: number, dy: number, scaleChange = 0) => {
    if (!selectedAsset || !effectivePlacement) return;
    handleChange(selectedAsset.id, {
      x: clamp(effectivePlacement.x + dx, 0, 1),
      y: clamp(effectivePlacement.y + dy, 0, 1),
      scale: clamp(
        Math.round((effectivePlacement.scale + scaleChange) * 100) / 100,
        MIN_ROOM_ASSET_SCALE,
        MAX_ROOM_ASSET_SCALE,
      ),
    });
  };

  const resetSelected = () => {
    if (!selectedAsset) return;
    setDraft((current) => {
      const copy = { ...current };
      delete copy[selectedAsset.id];
      return copy;
    });
  };

  const saveChanges = async () => {
    if (saving || !userId) return;
    setSaving(true);
    setErrorText('');
    try {
      const normalized = await writeRoomPlacements(userId, draft);
      setSaved(normalized);
      setDraft(normalized);
      setEditing(false);
      setSelectedId(null);
      onEditorClose?.();
    } catch {
      setErrorText('배치를 저장하지 못했습니다. 저장소 설정을 확인하고 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const common = {
    furniture,
    decor,
    themeSource,
    wallpaperSource,
    flooringSource,
    mascotColor,
    accessorySource,
    accessoryName: accessoryItem?.name ?? null,
    onSelect: setSelectedId,
    onPlacementChange: handleChange,
  };

  return (
    <>
      <RoomStage
        {...common}
        editing={false}
        selectedId={null}
        placements={saved}
        onMascotPress={onMascotPress}
        onOpenEditor={allowEditing && !startInEditMode ? startEditing : undefined}
      />
      {allowEditing && !editing && errorText ? (
        <Text style={[styles.errorText, styles.outsideError]}>{errorText}</Text>
      ) : null}

      {allowEditing ? (
        <Modal visible={editing} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeWithoutSaving}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.editorHeader}>
              <View style={styles.editorHeaderCopy}>
                <Text style={styles.editorTitle}>방 배치 편집</Text>
                <Text style={styles.editorSubtitle}>가구·소품을 누르고 끌어 위치를 바꾸세요.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={closeWithoutSaving} disabled={saving} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>취소</Text>
              </Pressable>
            </View>

            <View
              style={styles.editorStageWrap}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setEditorBounds({ width, height });
              }}
            >
              <RoomStage {...common} editing selectedId={selectedId} placements={draft} />
            </View>

            <View style={styles.controls}>
              <Text style={styles.selectedText} numberOfLines={1}>
                {selectedAsset ? `선택: ${selectedAsset.name}` : '가구 또는 소품을 선택하세요.'}
              </Text>
              {selectedAsset && effectivePlacement ? (
                <>
                  <View style={styles.controlLine}>
                    <Text style={styles.controlCaption}>위치</Text>
                    <View style={styles.buttonGroup}>
                      <EditorButton text="←" label="왼쪽으로 이동" onPress={() => changeSelected(-0.03, 0)} />
                      <EditorButton text="↑" label="위로 이동" onPress={() => changeSelected(0, -0.03)} />
                      <EditorButton text="↓" label="아래로 이동" onPress={() => changeSelected(0, 0.03)} />
                      <EditorButton text="→" label="오른쪽으로 이동" onPress={() => changeSelected(0.03, 0)} />
                    </View>
                  </View>
                  <View style={styles.controlLine}>
                    <Text style={styles.controlCaption}>크기 {Math.round(effectivePlacement.scale * 100)}%</Text>
                    <View style={styles.buttonGroup}>
                      <EditorButton text="−" label="크기 축소" onPress={() => changeSelected(0, 0, -0.1)} />
                      <EditorButton text="+" label="크기 확대" onPress={() => changeSelected(0, 0, 0.1)} />
                      <EditorButton text="기본 배치" label="선택한 가구 배치 초기화" onPress={resetSelected} wide />
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.helperText}>아이템을 선택하면 크기와 위치 조절 버튼이 나타납니다.</Text>
              )}
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
              <View style={styles.footerButtons}>
                <Pressable onPress={closeWithoutSaving} disabled={saving} style={[styles.footerButton, styles.cancelButton]}>
                  <Text style={styles.cancelText}>취소</Text>
                </Pressable>
                <Pressable onPress={saveChanges} disabled={saving} style={[styles.footerButton, styles.saveButton]}>
                  <Text style={styles.saveText}>{saving ? '저장 중…' : '배치 저장'}</Text>
                </Pressable>
              </View>
              <Text style={styles.localNote}>배치는 이 기기의 현재 계정에만 저장됩니다. 다른 기기·친구 프로필에는 공유되지 않습니다.</Text>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
}

function EditorButton({ text, label, onPress, wide = false }: {
  text: string;
  label: string;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.toolButton, wide && styles.wideToolButton, pressed && styles.pressed]}>
      <Text style={styles.toolButtonLabel}>{text}</Text>
    </Pressable>
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
  editorRoom: { flex: 1, height: undefined, borderRadius: 18 },
  themeBackground: { flex: 1, position: 'relative' },
  themeImage: { opacity: 0.98 },
  defaultWall: { ...StyleSheet.absoluteFillObject, bottom: '30%', backgroundColor: '#F7F1E6' },
  wallpaper: { position: 'absolute', left: 0, right: 0, top: 0, height: '71%', opacity: 0.95 },
  defaultFloor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '31%', backgroundColor: '#E8D2AD' },
  flooring: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%' },
  roomLine: { position: 'absolute', left: 0, right: 0, bottom: '30%', height: 1, backgroundColor: 'rgba(86,70,49,0.09)' },
  roomAsset: { position: 'absolute', zIndex: 4 },
  fallbackFurniture: { right: 12, bottom: 18, width: 92, height: 92 },
  fallbackDecor: { left: 22, top: 48, width: 60, height: 60 },
  floorWalkZone: { position: 'absolute', left: 4, right: 4, bottom: 4, height: 126, zIndex: 12, overflow: 'hidden' },
  wanderArea: { width: '100%', height: '100%' },
  editEntry: {
    position: 'absolute', right: 12, bottom: 12, zIndex: 35,
    borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#B9A88D', paddingHorizontal: 13, paddingVertical: 9,
  },
  editEntryText: { color: '#493B2A', fontSize: 12, fontWeight: '800' },
  editAsset: { position: 'absolute', zIndex: 21, borderRadius: 5, borderWidth: 1, borderStyle: 'dashed' },
  editAssetImage: { width: '100%', height: '100%' },
  selectedAsset: { zIndex: 26, borderColor: '#5F4B2D', borderStyle: 'solid', borderWidth: 2 },
  unselectedAsset: { borderColor: 'rgba(80,64,42,0.40)' },
  selectionDot: { position: 'absolute', right: -4, bottom: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: '#5F4B2D' },
  pressed: { opacity: 0.7 },
  modalSafe: { flex: 1, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between', paddingBottom: 12 },
  editorHeaderCopy: { flex: 1 },
  editorTitle: { color: '#352B20', fontSize: 18, fontWeight: '800' },
  editorSubtitle: { marginTop: 4, color: '#766959', fontSize: 11 },
  textButton: { padding: 10 },
  textButtonLabel: { fontSize: 13, fontWeight: '700', color: '#6F604B' },
  editorStageWrap: { flex: 1, minHeight: 190, maxWidth: 780, width: '100%', alignSelf: 'center' },
  controls: { width: '100%', maxWidth: 780, alignSelf: 'center', paddingTop: 12, gap: 10 },
  selectedText: { color: '#352B20', fontSize: 14, fontWeight: '800', minHeight: 20 },
  controlLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  controlCaption: { color: '#6D5E4B', fontSize: 12, fontWeight: '700' },
  buttonGroup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolButton: { minWidth: 40, height: 36, borderWidth: 1, borderColor: '#D7CFBF', borderRadius: 9, backgroundColor: '#F6F3EE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  wideToolButton: { minWidth: 75 },
  toolButtonLabel: { color: '#493B2A', fontWeight: '800', fontSize: 13 },
  helperText: { color: '#766959', fontSize: 11, minHeight: 72 },
  errorText: { color: '#B03C3C', fontSize: 12, fontWeight: '700' },
  outsideError: { marginTop: 8, marginHorizontal: 6 },
  footerButtons: { flexDirection: 'row', gap: 9 },
  footerButton: { height: 44, flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#F4F1EC', borderWidth: 1, borderColor: '#D9CFBC' },
  saveButton: { backgroundColor: '#443724' },
  cancelText: { color: '#443724', fontSize: 13, fontWeight: '800' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  localNote: { color: '#8C7D6D', fontSize: 10, lineHeight: 15 },
});
