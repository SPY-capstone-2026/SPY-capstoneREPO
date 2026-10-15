import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  PackageOpen,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppLoadingState } from '@/components/AppLoadingState';
import { CharacterRoom } from '@/components/CharacterRoom';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import {
  deleteFriend,
  getPublicProfile,
} from '@/services/socialApi';
import type {
  InventoryItem,
  PublicItem,
  PublicProfile,
  ShopItem,
} from '@/types/api';

function toInventoryItem(item: PublicItem): InventoryItem {
  const shopItem: ShopItem = {
    item_id: item.item_id,
    name: item.name,
    description: null,
    category: item.category,
    price: null,
    image_url: item.image_url,
    is_purchasable: false,
    is_repeatable: false,
    rarity: item.rarity,
    unlock_level: null,
  };

  return {
    id: item.item_id,
    item_id: item.item_id,
    item: shopItem,
    acquired_type: 'SOCIAL_PUBLIC',
    is_equipped: true,
    acquired_at: null,
  };
}

export default function FriendProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolvedUserId = Array.isArray(userId) ? userId[0] : userId;

  const inventory = useMemo(
    () => profile?.equipped_items.map(toInventoryItem) ?? [],
    [profile]
  );

  const loadProfile = useCallback(async () => {
    if (!resolvedUserId) return;

    try {
      setIsLoading(true);
      const response = await getPublicProfile(resolvedUserId);
      setProfile(response.data);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '프로필을 불러오지 못했어요.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUserId, showToast]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const removeFriend = () => {
    if (!profile || profile.friendship_status !== 'FRIEND') return;

    Alert.alert(
      '친구 삭제',
      `${profile.nickname || '이 사용자'}님을 친구 목록에서 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFriend(profile.user_id);
              showToast('친구를 삭제했어요.');
              router.back();
            } catch (error) {
              showToast(
                error instanceof Error
                  ? error.message
                  : '친구를 삭제하지 못했어요.'
              );
              await loadProfile();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={19} color={colors.text} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>FRIEND PROFILE</Text>
            <Text style={styles.title}>
              {profile?.nickname || '친구 프로필'}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <AppLoadingState compact />
        ) : profile ? (
          <>
            <CharacterRoom inventory={inventory} />

            <GlassCard style={styles.profileCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatar}>
                  <UserRound size={24} color={colors.text} strokeWidth={2.5} />
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.name}>
                    {profile.nickname || '이름 없음'}
                  </Text>
                  <Text style={styles.level}>
                    Lv.{profile.current_level} · {profile.total_xp} XP
                  </Text>
                </View>
              </View>

              <View style={styles.itemSummary}>
                <PackageOpen
                  size={16}
                  color={colors.butterBrown}
                  strokeWidth={2.4}
                />
                <Text style={styles.itemSummaryText}>
                  장착 아이템 {profile.equipped_items.length}개
                </Text>
              </View>

              {profile.equipped_items.length > 0 ? (
                <View style={styles.itemList}>
                  {profile.equipped_items.map((item) => (
                    <View key={item.item_id} style={styles.itemChip}>
                      <Text style={styles.itemChipText}>{item.name}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyItems}>
                  현재 장착한 아이템이 없어요.
                </Text>
              )}
            </GlassCard>

            {profile.friendship_status === 'FRIEND' ? (
              <Pressable
                onPress={removeFriend}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}
              >
                <Trash2 size={16} color={colors.subText} strokeWidth={2.3} />
                <Text style={styles.deleteText}>친구 삭제</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>프로필을 표시할 수 없어요.</Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  label: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.ink,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: colors.backgroundWhite,
    marginBottom: 7,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    color: colors.text,
  },
  profileCard: { marginTop: 14, backgroundColor: colors.butterPale },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1 },
  name: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  level: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    color: colors.subText,
  },
  itemSummary: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemSummaryText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  itemList: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.butterDeep,
    backgroundColor: colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  itemChipText: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.butterBrown,
  },
  emptyItems: {
    marginTop: 8,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    color: colors.mutedText,
  },
  deleteButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.subText,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    color: colors.subText,
  },
  pressed: { opacity: 0.7 },
});
