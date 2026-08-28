import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  PackageOpen,
} from 'lucide-react-native';
import {
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
import {
  SHOP_CATEGORY_LABELS,
  SHOP_CATEGORY_ORDER,
  getEquipConflictCategories,
  getShopItemEffect,
} from '@/services/shopCatalog';
import {
  getInventoryFromApi,
  setInventoryEquippedFromApi,
} from '@/services/shopService';
import type { InventoryItem } from '@/types/api';

export default function InventoryScreen() {
  const { showToast } = useToast();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      SHOP_CATEGORY_ORDER.filter(
        (category) =>
          category === 'ALL' ||
          inventory.some(
            (entry) => entry.item?.category === category
          )
      ),
    [inventory]
  );

  const visibleInventory = useMemo(() => {
    const filtered =
      selectedCategory === 'ALL'
        ? inventory
        : inventory.filter(
            (entry) => entry.item?.category === selectedCategory
          );

    return [...filtered].sort((a, b) => {
      if (a.is_equipped !== b.is_equipped) {
        return a.is_equipped ? -1 : 1;
      }

      return (b.acquired_at ?? '').localeCompare(a.acquired_at ?? '');
    });
  }, [inventory, selectedCategory]);

  const equippedCount = useMemo(
    () => inventory.filter((entry) => entry.is_equipped).length,
    [inventory]
  );

  const loadInventory = useCallback(async () => {
    try {
      setInventory(await getInventoryFromApi());
    } catch {
      showToast('보유 아이템을 불러오지 못했어요.');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [loadInventory])
  );

  const toggleEquip = async (entry: InventoryItem) => {
    if (updatingId) return;

    const item = entry.item;
    if (!item) return;

    const nextEquip = !entry.is_equipped;

    try {
      setUpdatingId(entry.item_id);

      if (nextEquip) {
        const conflictCategories =
          getEquipConflictCategories(item.category);

        if (conflictCategories.size > 0) {
          const conflicts = inventory.filter(
            (candidate) =>
              candidate.is_equipped &&
              candidate.item_id !== entry.item_id &&
              candidate.item &&
              conflictCategories.has(candidate.item.category)
          );

          for (const conflict of conflicts) {
            await setInventoryEquippedFromApi(
              conflict.item_id,
              false
            );
          }
        }
      }

      await setInventoryEquippedFromApi(
        entry.item_id,
        nextEquip
      );

      await loadInventory();

      showToast(
        nextEquip
          ? `${item.name} 아이템을 적용했어요.`
          : `${item.name} 아이템을 해제했어요.`
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '아이템 상태를 저장하지 못했어요.'
      );
    } finally {
      setUpdatingId(null);
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
            <Text style={styles.title}>보유 아이템</Text>
            <Text style={styles.description}>
              적용한 아이템은 Moni의 방에 바로 반영돼요.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/shop')}
            style={({ pressed }) => [
              styles.shopShortcut,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.shopShortcutText}>상점</Text>
            <ChevronRight
              size={15}
              color={colors.text}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <PackageOpen
              size={20}
              color={colors.text}
              strokeWidth={2.5}
            />
          </View>

          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>
              {inventory.length}개 보유
            </Text>
            <Text style={styles.summaryDescription}>
              현재 {equippedCount}개 아이템이 적용 중이에요.
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((category) => {
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

        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>적용 규칙</Text>
          <Text style={styles.ruleText}>
            캐릭터 색·액세서리·벽지·바닥·테마는 각각 한 종류만 적용됩니다.
            가구와 소품은 여러 개를 함께 배치할 수 있어요.
          </Text>
        </View>

        {visibleInventory.length === 0 ? (
          <View style={styles.emptyCard}>
            <PackageOpen
              size={28}
              color={colors.mutedText}
              strokeWidth={2}
            />
            <Text style={styles.emptyTitle}>아직 아이템이 없어요.</Text>
            <Text style={styles.emptyDescription}>
              상점에서 포인트로 아이템을 구매해 보세요.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visibleInventory.map((entry) => {
              const item = entry.item;
              if (!item) return null;

              const updating = updatingId === entry.item_id;

              return (
                <View
                  key={entry.id}
                  style={[
                    styles.itemCard,
                    entry.is_equipped &&
                      styles.itemCardEquipped,
                  ]}
                >
                  <View style={styles.visualWrap}>
                    <ShopItemVisual
                      item={item}
                      style={styles.visual}
                    />

                    {entry.is_equipped ? (
                      <View style={styles.equippedBadge}>
                        <Check
                          size={11}
                          color={colors.successText}
                          strokeWidth={3}
                        />
                        <Text style={styles.equippedText}>
                          적용 중
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.itemCategory}>
                    {SHOP_CATEGORY_LABELS[item.category] ??
                      item.category}
                  </Text>

                  <Text style={styles.itemName}>
                    {item.name}
                  </Text>

                  <Text
                    style={styles.itemEffect}
                    numberOfLines={2}
                  >
                    {getShopItemEffect(item)}
                  </Text>

                  <Pressable
                    disabled={updatingId !== null}
                    onPress={() => toggleEquip(entry)}
                    style={[
                      styles.equipButton,
                      entry.is_equipped &&
                        styles.unequipButton,
                      updatingId !== null &&
                        styles.buttonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.equipButtonText,
                        entry.is_equipped &&
                          styles.unequipButtonText,
                      ]}
                    >
                      {updating
                        ? '저장 중...'
                        : entry.is_equipped
                          ? '해제'
                          : '적용'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 44,
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
    fontSize: 25,
    fontWeight: '900',
    color: colors.text,
  },
  description: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    color: colors.subText,
  },
  shopShortcut: {
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: colors.butterPale,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  shopShortcutText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  summaryCard: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.text,
  },
  summaryDescription: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    color: colors.subText,
  },
  categoryRow: {
    gap: 7,
    paddingVertical: 12,
    paddingRight: 20,
  },
  categoryChip: {
    height: 35,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipSelected: {
    backgroundColor: colors.butterPale,
    borderColor: colors.butterSoft,
  },
  categoryText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.subText,
  },
  categoryTextSelected: {
    color: colors.butterDeep,
    fontWeight: '900',
  },
  ruleCard: {
    borderRadius: 15,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 11,
    marginBottom: 10,
  },
  ruleTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 3,
  },
  ruleText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.subText,
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
    maxWidth: 270,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 11,
  },
  itemCardEquipped: {
    borderColor: '#A5D6B6',
    backgroundColor: '#FEFFFE',
  },
  visualWrap: {
    height: 132,
    borderRadius: 15,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
    position: 'relative',
  },
  visual: {
    width: '100%',
    height: '100%',
  },
  equippedBadge: {
    position: 'absolute',
    right: 7,
    top: 7,
    borderRadius: 999,
    backgroundColor: colors.successBg,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  equippedText: {
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.successText,
  },
  itemCategory: {
    marginTop: 8,
    fontFamily: typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.mutedText,
  },
  itemName: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  itemEffect: {
    marginTop: 3,
    minHeight: 29,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.subText,
  },
  equipButton: {
    marginTop: 9,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unequipButton: {
    backgroundColor: colors.surfaceMuted,
  },
  equipButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  unequipButtonText: {
    color: colors.subText,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  emptyCard: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  emptyDescription: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    color: colors.subText,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
