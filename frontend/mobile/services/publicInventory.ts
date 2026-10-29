import type { InventoryItem, ShopItem } from '@/types/api';
import type { PublicItem, PublicUser } from '@/services/socialApi';

function asInventoryItem(item: PublicItem): InventoryItem {
  const shop: ShopItem = {
    item_id: item.item_id,
    name: item.name,
    category: item.category,
    rarity: item.rarity,
    image_url: item.image_url,
    description: null,
    price: null,
    is_purchasable: false,
    is_repeatable: false,
    unlock_level: null,
  };
  return { id: item.item_id, item_id: item.item_id, item: shop, acquired_type:'SOCIAL_PUBLIC', is_equipped:true, acquired_at:null };
}

export function getPublicInventory(user: PublicUser): InventoryItem[] {
  const all = [...(user.equipped_items ?? [])];
  if (user.character && !all.some(item => item.item_id === user.character?.item_id)) all.unshift(user.character);
  return all.map(asInventoryItem);
}
