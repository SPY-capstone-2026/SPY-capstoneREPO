import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  LockKeyhole,
  PackageOpen,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react-native';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ShopItemVisual } from '@/components/ShopItemVisual';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser } from '@/services/authService';
import {
  MILESTONE_PREVIEWS,
  RARITY_COLORS,
  RARITY_LABELS,
  SHOP_CATEGORY_LABELS,
  SHOP_CATEGORY_ORDER,
  getShopCategoryLabel,
  getShopItemEffect,
} from '@/services/shopCatalog';
import {
  getInventoryFromApi,
  getShopItemsFromApi,
  purchaseShopItemFromApi,
} from '@/services/shopService';
import type { InventoryItem, MeResponse, ShopItem } from '@/types/api';

const SPACE_BANNER = require('@/assets/shop/theme_space_room.png');

export default function ShopScreen() {
  const { showToast } = useToast();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [user, setUser] = useState<MeResponse | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const ownedIds = useMemo(
    () => new Set(inventory.map((item) => item.item_id)),
    [inventory]
  );

  const purchasableItems = useMemo(
    () => items.filter((item) => item.is_purchasable),
    [items]
  );

  const visibleCategories = useMemo(
    () =>
      SHOP_CATEGORY_ORDER.filter(
        (category) =>
          category === 'ALL' ||
          purchasableItems.some((item) => item.category === category)
      ),
    [purchasableItems]
  );

  const milestoneItems = useMemo(
    () => items.filter((item) => !item.is_purchasable),
    [items]
  );

  const visibleItems = useMemo(
    () =>
      selectedCategory === 'ALL'
        ? purchasableItems
        : purchasableItems.filter(
            (item) => item.category === selectedCategory
          ),
    [purchasableItems, selectedCategory]
  );

  const recommendedItems = useMemo(() => {
    const currentPoints = user?.current_points ?? 0;

    return purchasableItems
      .filter((item) => !ownedIds.has(item.item_id))
      .sort((a, b) => {
        const aAffordable =
          a.price !== null && a.price <= currentPoints ? 1 : 0;
        const bAffordable =
          b.price !== null && b.price <= currentPoints ? 1 : 0;

        if (aAffordable !== bAffordable) {
          return bAffordable - aAffordable;
        }

        return (a.price ?? 999999) - (b.price ?? 999999);
      })
      .slice(0, 6);
  }, [ownedIds, purchasableItems, user?.current_points]);

  const loadShop = useCallback(async () => {
    try {
      const [shopItems, myInventory, me] = await Promise.all([
        getShopItemsFromApi(),
        getInventoryFromApi(),
        getCurrentUser(),
      ]);

      setItems(shopItems);
      setInventory(myInventory);
      setUser(me);
    } catch {
      showToast('상점 정보를 불러오지 못했어요.');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadShop();
    }, [loadShop])
  );

  const buyItem = async (item: ShopItem) => {
    if (buyingId) return;

    const owned = ownedIds.has(item.item_id) && !item.is_repeatable;
    const locked =
      item.unlock_level !== null &&
      (user?.current_level ?? 0) < item.unlock_level;
    const canAfford =
      item.price !== null &&
      (user?.current_points ?? 0) >= item.price;

    if (owned) {
      showToast('이미 보유한 아이템이에요.');
      return;
    }

    if (locked) {
      showToast(`Lv.${item.unlock_level}부터 사용할 수 있어요.`);
      return;
    }

    if (!canAfford || item.price === null) {
      showToast('포인트가 부족해요.');
      return;
    }

    try {
      setBuyingId(item.item_id);

      const result = await purchaseShopItemFromApi(item.item_id);

      setUser((current) =>
        current
          ? {
              ...current,
              current_points: result.current_points,
            }
          : current
      );

      const nextInventory = await getInventoryFromApi();
      setInventory(nextInventory);

      showToast(`${item.name} 아이템을 구매했어요.`);
      setSelectedItem(null);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '아이템을 구매하지 못했어요.'
      );
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="뒤로"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <ArrowLeft
              size={20}
              color={colors.text}
              strokeWidth={2.5}
            />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>상점</Text>
            <Text style={styles.description}>
              포인트로 Moni와 방을 꾸며보세요.
            </Text>
          </View>

          <View style={styles.pointsBadge}>
            <Text style={styles.pointsLabel}>POINT</Text>
            <Text style={styles.pointsValue}>
              {user?.current_points ?? 0}P
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>보유 아이템</Text>
            <Text style={styles.summaryValue}>{inventory.length}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>적용 중</Text>
            <Text style={styles.summaryValue}>
              {inventory.filter((entry) => entry.is_equipped).length}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/inventory')}
            style={({ pressed }) => [
              styles.inventoryShortcut,
              pressed && styles.pressed,
            ]}
          >
            <PackageOpen
              size={16}
              color={colors.text}
              strokeWidth={2.5}
            />
            <Text style={styles.inventoryShortcutText}>보유 아이템</Text>
            <ChevronRight
              size={15}
              color={colors.subText}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>

        <ImageBackground
          source={SPACE_BANNER}
          resizeMode="cover"
          style={styles.banner}
          imageStyle={styles.bannerImage}
        >
          <View style={styles.bannerShade} />
          <View style={styles.bannerCopy}>
            <View style={styles.bannerPill}>
              <Sparkles
                size={13}
                color="#FFF3A7"
                strokeWidth={2.5}
              />
              <Text style={styles.bannerPillText}>EPIC THEME</Text>
            </View>

            <Text style={styles.bannerTitle}>방 전체도 바꿀 수 있어요</Text>
            <Text style={styles.bannerText}>
              테마는 벽지와 바닥을 한 번에 바꾸고, 기존 소품은 추가로 배치할 수 있어요.
            </Text>
          </View>
        </ImageBackground>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {visibleCategories.map((category) => {
            const selected = category === selectedCategory;

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[
                  styles.categoryChip,
                  selected && styles.categoryChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selected && styles.categoryTextSelected,
                  ]}
                >
                  {SHOP_CATEGORY_LABELS[category] ?? category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedCategory === 'ALL' && recommendedItems.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>추천 아이템</Text>
              <Text style={styles.sectionCaption}>
                현재 포인트로 살 수 있는 아이템 우선
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendedRow}
            >
              {recommendedItems.map((item) => (
                <CompactItemCard
                  key={item.item_id}
                  item={item}
                  owned={ownedIds.has(item.item_id)}
                  onPress={() => setSelectedItem(item)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'ALL'
              ? '전체 아이템'
              : getShopCategoryLabel(selectedCategory)}
          </Text>

          <Text style={styles.sectionCaption}>
            {visibleItems.length}개
          </Text>
        </View>

        <View style={styles.grid}>
          {visibleItems.map((item) => {
            const owned =
              ownedIds.has(item.item_id) && !item.is_repeatable;

            const locked =
              item.unlock_level !== null &&
              (user?.current_level ?? 0) < item.unlock_level;

            const canAfford =
              item.price !== null &&
              (user?.current_points ?? 0) >= item.price;

            return (
              <Pressable
                key={item.item_id}
                onPress={() => setSelectedItem(item)}
                style={({ pressed }) => [
                  styles.itemCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.itemVisualWrap}>
                  <ShopItemVisual
                    item={item}
                    style={styles.itemVisual}
                  />

                  {owned ? (
                    <View style={styles.ownedBadge}>
                      <Text style={styles.ownedBadgeText}>보유</Text>
                    </View>
                  ) : null}

                  {locked ? (
                    <View style={styles.lockBadge}>
                      <LockKeyhole
                        size={11}
                        color={colors.subText}
                        strokeWidth={2.5}
                      />
                      <Text style={styles.lockText}>
                        Lv.{item.unlock_level}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <RarityBadge rarity={item.rarity} />

                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>

                <Text
                  style={styles.itemEffect}
                  numberOfLines={2}
                >
                  {getShopItemEffect(item)}
                </Text>

                <View style={styles.itemBottom}>
                  <Text style={styles.price}>
                    {item.price === null ? '-' : `${item.price}P`}
                  </Text>

                  <Text
                    style={[
                      styles.cardStatus,
                      !owned &&
                        !locked &&
                        canAfford &&
                        styles.cardStatusReady,
                    ]}
                  >
                    {owned
                      ? '보유 중'
                      : locked
                        ? '잠김'
                        : canAfford
                          ? '구매 가능'
                          : '포인트 부족'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {selectedCategory === 'ALL' ? (
          <View style={styles.milestoneSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>레벨 보상</Text>
              <Text style={styles.sectionCaption}>구매 불가 · 성장 보상</Text>
            </View>

            <View style={styles.milestoneGrid}>
              {(milestoneItems.length > 0
                ? milestoneItems.map((item) => ({
                    name: item.name,
                    category: item.category,
                    unlock_level: item.unlock_level ?? 0,
                  }))
                : MILESTONE_PREVIEWS
              ).map((item) => {
                const unlocked =
                  (user?.current_level ?? 0) >= item.unlock_level;

                return (
                  <View
                    key={item.name}
                    style={styles.milestoneCard}
                  >
                    <ShopItemVisual
                      name={item.name}
                      category={item.category}
                      style={styles.milestoneVisual}
                    />

                    <Text style={styles.milestoneName}>
                      {item.name}
                    </Text>
                    <Text style={styles.milestoneLevel}>
                      {unlocked
                        ? `Lv.${item.unlock_level} 달성`
                        : `Lv.${item.unlock_level}에 해금`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ItemDetailModal
        item={selectedItem}
        visible={selectedItem !== null}
        owned={
          selectedItem
            ? ownedIds.has(selectedItem.item_id) &&
              !selectedItem.is_repeatable
            : false
        }
        currentLevel={user?.current_level ?? 0}
        currentPoints={user?.current_points ?? 0}
        buying={selectedItem?.item_id === buyingId}
        onClose={() => setSelectedItem(null)}
        onBuy={buyItem}
      />
    </View>
  );
}

function RarityBadge({ rarity }: { rarity: string }) {
  const palette =
    RARITY_COLORS[rarity] ?? RARITY_COLORS.COMMON;

  return (
    <View
      style={[
        styles.rarityBadge,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}
    >
      <Text
        style={[
          styles.rarityText,
          {
            color: palette.text,
          },
        ]}
      >
        {RARITY_LABELS[rarity] ?? rarity}
      </Text>
    </View>
  );
}

function CompactItemCard({
  item,
  owned,
  onPress,
}: {
  item: ShopItem;
  owned: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactCard,
        pressed && styles.pressed,
      ]}
    >
      <ShopItemVisual
        item={item}
        style={styles.compactVisual}
      />

      <Text style={styles.compactName} numberOfLines={1}>
        {item.name}
      </Text>

      <View style={styles.compactBottom}>
        <Text style={styles.compactPrice}>
          {item.price === null ? '-' : `${item.price}P`}
        </Text>
        {owned ? (
          <Text style={styles.compactOwned}>보유</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ItemDetailModal({
  item,
  visible,
  owned,
  currentLevel,
  currentPoints,
  buying,
  onClose,
  onBuy,
}: {
  item: ShopItem | null;
  visible: boolean;
  owned: boolean;
  currentLevel: number;
  currentPoints: number;
  buying: boolean;
  onClose: () => void;
  onBuy: (item: ShopItem) => void;
}) {
  if (!item) return null;

  const locked =
    item.unlock_level !== null &&
    currentLevel < item.unlock_level;

  const canAfford =
    item.price !== null && currentPoints >= item.price;

  const canBuy =
    item.is_purchasable &&
    item.price !== null &&
    !owned &&
    !locked &&
    canAfford &&
    !buying;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Pressable
            accessibilityLabel="닫기"
            onPress={onClose}
            style={styles.closeButton}
          >
            <X
              size={19}
              color={colors.text}
              strokeWidth={2.5}
            />
          </Pressable>

          <ShopItemVisual
            item={item}
            style={styles.modalVisual}
          />

          <View style={styles.modalRarity}>
            <RarityBadge rarity={item.rarity} />
          </View>

          <Text style={styles.modalTitle}>{item.name}</Text>
          <Text style={styles.modalCategory}>
            {getShopCategoryLabel(item.category)}
          </Text>

          <View style={styles.effectBox}>
            <Text style={styles.effectLabel}>적용 효과</Text>
            <Text style={styles.effectText}>
              {getShopItemEffect(item)}
            </Text>
          </View>

          <View style={styles.modalMetaRow}>
            <View>
              <Text style={styles.modalMetaLabel}>보유 포인트</Text>
              <Text style={styles.modalMetaValue}>{currentPoints}P</Text>
            </View>

            <View style={styles.modalPriceBlock}>
              <Text style={styles.modalMetaLabel}>가격</Text>
              <Text style={styles.modalPrice}>
                {item.price === null ? '-' : `${item.price}P`}
              </Text>
            </View>
          </View>

          <Pressable
            disabled={!canBuy}
            onPress={() => onBuy(item)}
            style={[
              styles.buyButton,
              !canBuy && styles.buyButtonDisabled,
            ]}
          >
            <ShoppingBag
              size={17}
              color={!canBuy ? colors.mutedText : colors.text}
              strokeWidth={2.5}
            />

            <Text
              style={[
                styles.buyButtonText,
                !canBuy && styles.buyButtonTextDisabled,
              ]}
            >
              {owned
                ? '이미 보유 중'
                : locked
                  ? `Lv.${item.unlock_level} 필요`
                  : !item.is_purchasable || item.price === null
                    ? '구매할 수 없는 아이템'
                    : !canAfford
                      ? '포인트 부족'
                      : buying
                        ? '구매 중...'
                        : `${item.price}P로 구매`}
            </Text>
          </Pressable>

          {!owned && item.is_purchasable ? (
            <Text style={styles.applyHint}>
              구매 후 ‘보유 아이템’에서 적용할 수 있어요.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },
  description: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    color: colors.subText,
  },
  pointsBadge: {
    minWidth: 78,
    borderRadius: 15,
    backgroundColor: colors.butterPale,
    borderWidth: 1,
    borderColor: colors.butterSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'flex-end',
  },
  pointsLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.butterDeep,
  },
  pointsValue: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  summaryRow: {
    minHeight: 58,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    marginBottom: 12,
  },
  summaryCell: {
    minWidth: 64,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 25,
    backgroundColor: colors.borderSoft,
    marginHorizontal: 8,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  summaryValue: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  inventoryShortcut: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  inventoryShortcutText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  banner: {
    minHeight: 150,
    borderRadius: 21,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  bannerImage: {
    borderRadius: 21,
  },
  bannerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,18,40,0.32)',
  },
  bannerCopy: {
    padding: 16,
    maxWidth: 470,
  },
  bannerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20,18,42,0.50)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 7,
  },
  bannerPillText: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FFF3A7',
  },
  bannerTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerText: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.90)',
  },
  categoryRow: {
    gap: 7,
    paddingVertical: 4,
    paddingRight: 20,
    marginBottom: 10,
  },
  categoryChip: {
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipSelected: {
    backgroundColor: colors.butterPale,
    borderColor: colors.butterSoft,
  },
  categoryText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.subText,
  },
  categoryTextSelected: {
    color: colors.butterDeep,
    fontWeight: '900',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  sectionCaption: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.mutedText,
  },
  recommendedRow: {
    gap: 8,
    paddingRight: 18,
  },
  compactCard: {
    width: 132,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 9,
  },
  compactVisual: {
    width: '100%',
    height: 92,
    borderRadius: 13,
    backgroundColor: colors.surfaceSoft,
  },
  compactName: {
    marginTop: 7,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  compactBottom: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactPrice: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  compactOwned: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.successText,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 155,
    maxWidth: 280,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 11,
  },
  itemVisualWrap: {
    height: 138,
    borderRadius: 15,
    backgroundColor: colors.surfaceSoft,
    position: 'relative',
    overflow: 'hidden',
  },
  itemVisual: {
    width: '100%',
    height: '100%',
  },
  ownedBadge: {
    position: 'absolute',
    right: 7,
    top: 7,
    borderRadius: 999,
    backgroundColor: colors.successBg,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  ownedBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.successText,
  },
  lockBadge: {
    position: 'absolute',
    left: 7,
    top: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockText: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.subText,
  },
  rarityBadge: {
    alignSelf: 'flex-start',
    marginTop: 9,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rarityText: {
    fontFamily: typography.fontFamily,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  itemName: {
    marginTop: 6,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  itemEffect: {
    marginTop: 3,
    minHeight: 30,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.subText,
  },
  itemBottom: {
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  cardStatus: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  cardStatusReady: {
    color: colors.successText,
  },
  milestoneSection: {
    marginTop: 13,
    paddingTop: 4,
  },
  milestoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  milestoneCard: {
    width: 145,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 9,
  },
  milestoneVisual: {
    height: 92,
    borderRadius: 13,
    backgroundColor: colors.surfaceSoft,
  },
  milestoneName: {
    marginTop: 6,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  milestoneLevel: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.26)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 25,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  modalVisual: {
    width: '100%',
    height: 210,
    borderRadius: 19,
    backgroundColor: colors.surfaceSoft,
  },
  modalRarity: {
    marginTop: 2,
  },
  modalTitle: {
    marginTop: 9,
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
  },
  modalCategory: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  effectBox: {
    marginTop: 12,
    borderRadius: 15,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
  },
  effectLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    color: colors.butterDeep,
    marginBottom: 4,
  },
  effectText: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '700',
    color: colors.subText,
  },
  modalMetaRow: {
    marginTop: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalMetaLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.mutedText,
  },
  modalMetaValue: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  modalPriceBlock: {
    alignItems: 'flex-end',
  },
  modalPrice: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  buyButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: colors.butterStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buyButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  buyButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.text,
  },
  buyButtonTextDisabled: {
    color: colors.mutedText,
  },
  applyHint: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.mutedText,
  },
  pressed: {
    opacity: 0.72,
  },
});
