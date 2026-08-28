import {
  getInventoryApi,
  getShopItemsApi,
  purchaseShopItemApi,
  setInventoryEquippedApi,
} from '@/services/shopApi';

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
