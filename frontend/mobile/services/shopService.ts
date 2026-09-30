import { getEquipConflictCategories } from '@/services/shopCatalog';
import {
  getInventoryApi,
  getShopItemsApi,
  purchaseShopItemApi,
  setInventoryEquippedApi,
} from '@/services/shopApi';
import type { InventoryItem } from '@/types/api';

export async function getShopItemsFromApi(category?: string) {
  const response = await getShopItemsApi(category);
  return response.data;
}

export async function purchaseShopItemFromApi(itemId: string) {
  const response = await purchaseShopItemApi(itemId);
  return response.data;
}

export async function getInventoryFromApi() {
  const response = await getInventoryApi();
  return response.data;
}

export async function setInventoryEquippedFromApi(
  itemId: string,
  equip: boolean
) {
  const response = await setInventoryEquippedApi(itemId, equip);
  return response.data;
}

/**
 * 장착/해제는 서버 상태를 기준으로 처리하고 마지막에 다시 조회해 검증합니다.
 * 단일 슬롯 아이템 장착 중 실패하면 먼저 해제했던 충돌 아이템을 가능한 범위에서 복구합니다.
 */
export async function setInventoryEquippedSafely(
  itemId: string,
  category: string,
  equip: boolean
): Promise<InventoryItem[]> {
  const before = await getInventoryFromApi();
  const target = before.find((entry) => entry.item_id === itemId);

  if (!target) {
    throw new Error('보유 아이템 정보를 찾지 못했어요.');
  }

  const conflictCategories = equip
    ? getEquipConflictCategories(category)
    : new Set<string>();

  const conflicts = before.filter(
    (entry) =>
      entry.is_equipped &&
      entry.item_id !== itemId &&
      entry.item &&
      conflictCategories.has(entry.item.category)
  );

  const released: InventoryItem[] = [];

  try {
    for (const conflict of conflicts) {
      await setInventoryEquippedFromApi(conflict.item_id, false);
      released.push(conflict);
    }

    await setInventoryEquippedFromApi(itemId, equip);
  } catch (error) {
    // 새 장착이 실패했다면 기존 장착 상태를 최대한 되돌립니다.
    if (equip && released.length > 0) {
      await Promise.allSettled(
        released.map((entry) =>
          setInventoryEquippedFromApi(entry.item_id, true)
        )
      );
    }
    throw error;
  }

  const verified = await getInventoryFromApi();
  const verifiedTarget = verified.find((entry) => entry.item_id === itemId);

  if (!verifiedTarget || verifiedTarget.is_equipped !== equip) {
    throw new Error('아이템 상태가 서버에 정상 저장되지 않았어요. 다시 시도해 주세요.');
  }

  if (equip && conflictCategories.size > 0) {
    const invalidConflict = verified.find(
      (entry) =>
        entry.is_equipped &&
        entry.item_id !== itemId &&
        entry.item &&
        conflictCategories.has(entry.item.category)
    );

    if (invalidConflict) {
      throw new Error('같은 슬롯의 아이템이 동시에 장착되어 있어 상태를 다시 확인해 주세요.');
    }
  }

  return verified;
}
