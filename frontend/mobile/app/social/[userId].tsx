import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Trash2, PackageOpen, UsersRound } from 'lucide-react-native';
import { CharacterRoom } from '@/components/CharacterRoom';
import { useToast } from '@/contexts/ToastContext';
import { palette, ui } from '@/constants/moniTheme';
import { deleteFriend, getPublicProfile, type PublicProfile, type PublicItem } from '@/services/socialApi';
import type { InventoryItem, ShopItem } from '@/types/api';

const toInventory = (item: PublicItem): InventoryItem => {
  const shopItem: ShopItem = {
    item_id: item.item_id, name: item.name, description: null, category: item.category,
    price: null, image_url: item.image_url, is_purchasable: false, is_repeatable: false,
    rarity: item.rarity, unlock_level: null,
  };
  return { id: item.item_id, item_id: item.item_id, item: shopItem, acquired_type: 'PUBLIC', is_equipped: true, acquired_at: null };
};

export default function FriendProfileScreen() {
  const params = useLocalSearchParams<{userId: string}>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { showToast } = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const load = useCallback(async () => {
    if (!userId) return;
    try { setLoading(true); setProfile((await getPublicProfile(userId)).data); }
    catch (error) { showToast(error instanceof Error ? error.message : '친구 프로필을 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [userId, showToast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const inventory = useMemo(() => profile?.equipped_items?.map(toInventory) || [], [profile]);
  const remove = async () => {
    if (!profile || removing) return;
    try { setRemoving(true); await deleteFriend(profile.user_id); showToast('친구를 삭제했어요.'); router.back(); }
    catch (error) { showToast(error instanceof Error ? error.message : '친구를 삭제하지 못했어요.'); }
    finally { setRemoving(false); }
  };
  const confirmRemove = () => {
    if (!profile) return;
    const message = `${profile.nickname || '이 사용자'}님을 친구 목록에서 삭제할까요?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) void remove();
    } else {
      Alert.alert('친구 삭제', message, [ { text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => void remove() } ]);
    }
  };
  return <View style={ui.screen}><ScrollView contentContainerStyle={ui.scroll}>
    <Pressable style={[ui.row, {marginBottom: 16}]} onPress={() => router.back()}><ArrowLeft size={19} color={palette.ink}/><Text style={ui.text}>친구 목록으로</Text></Pressable>
    {loading ? <Text style={ui.muted}>친구 프로필을 불러오고 있어요.</Text> : profile ? <>
      <Text style={ui.title}>{profile.nickname || '친구 프로필'}</Text>
      <Text style={ui.subtitle}>Lv.{profile.current_level} · 누적 {profile.total_xp} XP</Text>
      <CharacterRoom inventory={inventory} />
      <View style={[ui.card, { marginTop: 18 }]}>
        <View style={ui.row}><UsersRound color={palette.ink} size={20}/><Text style={ui.heading}>{profile.nickname || '닉네임 없음'}</Text></View>
        <View style={[ui.row, {marginTop: 12}]}><PackageOpen color={palette.ink} size={18}/><Text style={ui.text}>장착 아이템 {inventory.length}개</Text></View>
        {inventory.length ? inventory.map(item => <Text style={[ui.muted,{ marginTop: 7 }]} key={item.id}>· {item.item?.name}</Text>)
          : <Text style={[ui.muted,{ marginTop: 12 }]}>현재 장착한 아이템이 없어요.</Text>}
      </View>
      {profile.friendship_status === 'FRIEND' && <Pressable disabled={removing} style={ui.secondary} onPress={confirmRemove}>
        <View style={ui.row}><Trash2 size={16} color={palette.danger}/><Text style={ui.dangerText}>친구 삭제</Text></View>
      </Pressable>}
    </> : <Text style={ui.muted}>프로필을 표시할 수 없어요.</Text>}
  </ScrollView></View>;
}
