import { apiRequest } from '@/services/apiClient';
import type {
  EquipInventoryResponse,
  InventoryResponse,
  PurchaseShopItemResponse,
  ShopItemsResponse,
} from '@/types/api';

export async function getShopItemsApi(category?: string) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';

  return apiRequest<ShopItemsResponse>({
    path: `/shop/items${query}`,
    method: 'GET',
    auth: true,
  });
}

export async function purchaseShopItemApi(itemId: string) {
  return apiRequest<PurchaseShopItemResponse>({
    path: `/shop/purchase/${itemId}`,
    method: 'POST',
    auth: true,
  });
}

export async function getInventoryApi() {
  return apiRequest<InventoryResponse>({
    path: '/shop/inventory',
    method: 'GET',
    auth: true,
  });
}

export async function setInventoryEquippedApi(itemId: string, equip: boolean) {
  return apiRequest<EquipInventoryResponse>({
    path: `/shop/inventory/${itemId}/equip`,
    method: 'PATCH',
    body: { equip },
    auth: true,
  });
}
