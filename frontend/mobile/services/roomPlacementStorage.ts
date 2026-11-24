import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Room arrangement is a user-specific, device-local preference.
 * It is NOT published via the social profile API or synchronized between devices.
 * Coordinates are normalized centers in [0, 1] so they adapt to room width.
 */
export type RoomPlacement = { x: number; y: number; scale: number };
export type RoomPlacementMap = Record<string, RoomPlacement>;

const PREFIX = 'moni.room.placement.v1.';
export const MIN_ROOM_ASSET_SCALE = 0.5;
export const MAX_ROOM_ASSET_SCALE = 2;

export function clampRoomValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isValidPlacement(value: unknown): value is RoomPlacement {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<RoomPlacement>;
  return (
    typeof item.x === 'number' && Number.isFinite(item.x) && item.x >= 0 && item.x <= 1 &&
    typeof item.y === 'number' && Number.isFinite(item.y) && item.y >= 0 && item.y <= 1 &&
    typeof item.scale === 'number' && Number.isFinite(item.scale) &&
    item.scale >= MIN_ROOM_ASSET_SCALE && item.scale <= MAX_ROOM_ASSET_SCALE
  );
}

function sanitizePlacements(input: unknown): RoomPlacementMap {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {};
  const result: RoomPlacementMap = {};
  for (const [key, value] of Object.entries(input)) {
    if (key && key.length < 150 && isValidPlacement(value)) result[key] = value;
  }
  return result;
}

/** IDs come from an authenticated /me response; never share layouts across users. */
function storageKey(userId: string) {
  return `${PREFIX}${userId}`;
}

export async function readRoomPlacements(userId: string): Promise<RoomPlacementMap> {
  if (!userId) return {};
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return {};
      raw = window.localStorage.getItem(storageKey(userId));
    } else {
      raw = await SecureStore.getItemAsync(storageKey(userId));
    }
    return raw ? sanitizePlacements(JSON.parse(raw) as unknown) : {};
  } catch {
    // Malformed old data must not block the character room.
    return {};
  }
}

export async function writeRoomPlacements(
  userId: string,
  placements: RoomPlacementMap,
): Promise<RoomPlacementMap> {
  if (!userId) throw new Error('배치를 저장할 사용자 정보를 찾을 수 없습니다.');
  const safe = sanitizePlacements(placements);
  const value = JSON.stringify(safe);
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('브라우저 저장소를 사용할 수 없습니다.');
    window.localStorage.setItem(storageKey(userId), value);
  } else {
    await SecureStore.setItemAsync(storageKey(userId), value);
  }
  return safe;
}
