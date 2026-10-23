import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { UsersRound, Search, UserPlus, X, Check, RefreshCw } from 'lucide-react-native';
import { getCurrentUser, updateCurrentUser } from '@/services/authService';
import { useToast } from '@/contexts/ToastContext';
import { palette, ui } from '@/constants/moniTheme';
import {
  type PublicProfile, type PublicUser, type FriendRequest, getFriends, getFriendRequests,
  searchUserByNickname, sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  cancelFriendRequest,
} from '@/services/socialApi';

type UserWithNickname = { user_id: string; nickname?: string | null; current_level: number };
const nicknameOf = (user: {nickname: string | null}) => user.nickname?.trim() || '닉네임 없음';

export default function SocialScreen() {
  const { showToast } = useToast();
  const [me, setMe] = useState<UserWithNickname | null>(null);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [nickname, setNickname] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<PublicProfile | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser() as UserWithNickname;
      setMe(user);
      if (!user.nickname) { setFriends([]); setReceived([]); setSent([]); return; }
      const [f, r, s] = await Promise.all([getFriends(), getFriendRequests('received'), getFriendRequests('sent')]);
      setFriends(f.data || []); setReceived(r.data || []); setSent(s.data || []);
    } catch (error) { showToast(error instanceof Error ? error.message : '친구 목록을 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveNickname = async () => {
    const next = nickname.trim();
    if (next.length < 2 || next.length > 12) { showToast('닉네임은 2~12자로 입력해 주세요.'); return; }
    try {
      setBusy(true);
      await updateCurrentUser({ nickname: next } as Parameters<typeof updateCurrentUser>[0]);
      showToast('닉네임을 저장했어요.'); setRenaming(false); await load();
    } catch (error) { showToast(error instanceof Error ? error.message : '닉네임을 저장하지 못했어요.'); }
    finally { setBusy(false); }
  };
  const search = async () => {
    if (!query.trim()) return;
    try { setBusy(true); setResult((await searchUserByNickname(query)).data); }
    catch (error) { setResult(null); showToast(error instanceof Error ? error.message : '사용자를 찾지 못했어요.'); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!result?.nickname) return;
    try {
      setBusy(true);
      const action = await sendFriendRequest(result.nickname);
      showToast(action.data.auto_accepted ? '친구가 되었어요.' : '친구 요청을 보냈어요.');
      setResult((await searchUserByNickname(result.nickname)).data);
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : '친구 요청에 실패했어요.'); }
    finally { setBusy(false); }
  };
  const handleRequest = async (action: 'accept' | 'reject' | 'cancel', id: string) => {
    if (busy) return;
    try {
      setBusy(true);
      if (action === 'accept') await acceptFriendRequest(id);
      else if (action === 'reject') await rejectFriendRequest(id);
      else await cancelFriendRequest(id);
      showToast(action === 'accept' ? '친구 요청을 수락했어요.' : '요청을 처리했어요.');
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : '요청을 처리하지 못했어요.'); }
    finally { setBusy(false); }
  };
  return <View style={ui.screen}>
    <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
      <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 13 }]}>
        <View><Text style={ui.title}>친구</Text><Text style={ui.subtitle}>서로의 캐릭터와 성장을 확인해요.</Text></View>
        <Pressable accessibilityLabel="친구 찾기" onPress={() => { setSearchOpen(true); setQuery(''); setResult(null); }} style={ui.button}>
          <View style={ui.row}><UserPlus size={18} color={palette.ink}/><Text style={ui.buttonText}>친구 찾기</Text></View>
        </Pressable>
      </View>
      {!me?.nickname ? <View style={ui.card}>
        <Text style={ui.heading}>먼저 닉네임을 정해 주세요</Text>
        <Text style={ui.subtitle}>닉네임으로 다른 사용자를 찾고 친구 요청을 보낼 수 있어요.</Text>
        <TextInput style={ui.input} value={nickname} onChangeText={setNickname} maxLength={12} placeholder="2~12자 닉네임" />
        <Pressable onPress={() => void saveNickname()} disabled={busy} style={ui.button}><Text style={ui.buttonText}>{busy ? '저장 중' : '닉네임 설정'}</Text></Pressable>
      </View> : <>
        <View style={[ui.card, { backgroundColor: palette.soft }]}>
          <Text style={ui.muted}>내 닉네임</Text><Text style={ui.heading}>{me.nickname} · Lv.{me.current_level}</Text>
          {renaming ? <>
            <TextInput style={ui.input} value={nickname} onChangeText={setNickname} maxLength={12} placeholder="변경할 닉네임" />
            <View style={ui.row}><Pressable style={ui.button} disabled={busy} onPress={() => void saveNickname()}><Text style={ui.buttonText}>저장</Text></Pressable>
              <Pressable style={ui.secondary} onPress={() => setRenaming(false)}><Text style={ui.buttonText}>취소</Text></Pressable></View>
          </> : <Pressable style={[ui.secondary, {alignSelf:'flex-start'}]} onPress={() => {setNickname(me.nickname || '');setRenaming(true);}}>
            <Text style={ui.buttonText}>닉네임 변경</Text>
          </Pressable>}
        </View>
        <View style={[ui.row, { marginBottom: 14 }]}>
          <Pressable onPress={() => setView('friends')} style={view === 'friends' ? ui.button : ui.secondary}>
            <Text style={ui.buttonText}>친구 {friends.length}</Text>
          </Pressable>
          <Pressable onPress={() => setView('requests')} style={view === 'requests' ? ui.button : ui.secondary}>
            <Text style={ui.buttonText}>요청 {received.length + sent.length}</Text>
          </Pressable>
          <Pressable onPress={() => void load()} disabled={loading} style={ui.secondary} accessibilityLabel="새로고침"><RefreshCw size={17} color={palette.ink}/></Pressable>
        </View>
        {view === 'friends' ? friends.length ? friends.map((friend) =>
          <Pressable key={friend.user_id} style={ui.card} onPress={() => router.push({pathname: '/social/[userId]', params: {userId: friend.user_id}})}>
            <View style={ui.row}>
              <View style={[ui.secondary, { width: 48, paddingHorizontal: 0 }]}><UsersRound size={22} color={palette.ink}/></View>
              <View style={{ flex: 1 }}><Text style={ui.heading}>{nicknameOf(friend)}</Text>
                <Text style={ui.muted}>Lv.{friend.current_level} · {friend.total_xp} XP · 장착 {friend.equipped_items?.length || 0}개</Text>
                {friend.character && <Text style={ui.muted}>캐릭터: {friend.character.name}</Text>}
              </View><Text style={ui.muted}>방 보기 ›</Text>
            </View>
          </Pressable>
        ) : <View style={ui.card}><Text style={ui.muted}>아직 친구가 없어요. 닉네임으로 검색해 보세요.</Text></View>
        : <>
          <Text style={ui.heading}>받은 요청</Text>
          {received.length ? received.map(item => <View key={item.request_id} style={ui.card}>
            <View style={ui.row}><View style={{flex: 1}}><Text style={ui.heading}>{nicknameOf(item.user)}</Text><Text style={ui.muted}>Lv.{item.user.current_level}</Text></View>
              <Pressable disabled={busy} onPress={() => void handleRequest('reject', item.request_id)} style={ui.secondary}><X size={18} color={palette.ink}/></Pressable>
              <Pressable disabled={busy} onPress={() => void handleRequest('accept', item.request_id)} style={ui.button}><Check size={18} color={palette.ink}/></Pressable></View>
          </View>) : <Text style={ui.muted}>받은 요청이 없어요.</Text>}
          <Text style={[ui.heading, {marginTop: 22}]}>보낸 요청</Text>
          {sent.length ? sent.map(item => <View key={item.request_id} style={ui.card}>
            <View style={ui.row}><View style={{flex: 1}}><Text style={ui.heading}>{nicknameOf(item.user)}</Text><Text style={ui.muted}>응답 대기</Text></View>
              <Pressable disabled={busy} onPress={() => void handleRequest('cancel', item.request_id)} style={ui.secondary}><Text style={ui.buttonText}>취소</Text></Pressable>
            </View>
          </View>) : <Text style={ui.muted}>보낸 요청이 없어요.</Text>}
        </>}
      </>}
    </ScrollView>
    <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={() => setSearchOpen(false)}>
      <View style={{flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 18}}>
        <View style={[ui.card, { maxWidth: 520, width: '100%', alignSelf: 'center' }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.heading}>친구 찾기</Text><Pressable onPress={() => setSearchOpen(false)}><X size={21} color={palette.ink}/></Pressable></View>
          <TextInput style={ui.input} value={query} onChangeText={setQuery} placeholder="정확한 닉네임" autoCapitalize="none" onSubmitEditing={() => void search()} />
          <Pressable disabled={busy} onPress={() => void search()} style={ui.button}><View style={ui.row}><Search size={17} color={palette.ink}/><Text style={ui.buttonText}>{busy ? '검색 중' : '검색'}</Text></View></Pressable>
          {result && <View style={[ui.card, { marginTop: 15, marginBottom: 0 }]}>
            <Text style={ui.heading}>{nicknameOf(result)}</Text>
            <Text style={ui.muted}>Lv.{result.current_level} · {result.equipped_items?.length || 0}개 장착</Text>
            {result.friendship_status === 'NONE' ? <Pressable disabled={busy} style={[ui.button,{ marginTop: 12 }]} onPress={() => void send()}><Text style={ui.buttonText}>친구 요청 보내기</Text></Pressable>
              : <Text style={[ui.muted, { marginTop: 10 }]}>상태: {result.friendship_status === 'FRIEND' ? '친구' : result.friendship_status === 'SELF' ? '내 프로필' : '요청 처리 중'}</Text>}
          </View>}
        </View>
      </View>
    </Modal>
  </View>;
}
