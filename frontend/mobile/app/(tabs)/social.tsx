import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, ChevronRight, RefreshCw, Search, UserPlus, UsersRound, X } from 'lucide-react-native';
import { CharacterRoom } from '@/components/CharacterRoom';
import { getCurrentUser } from '@/services/authService';
import { getInventoryFromApi } from '@/services/shopService';
import { useToast } from '@/contexts/ToastContext';
import { useMoniTheme, themeForCharacter } from '@/contexts/MoniThemeContext';
import { palette, useMoniUi } from '@/constants/moniTheme';
import { getPublicInventory } from '@/services/publicInventory';
import type { InventoryItem } from '@/types/api';
import {
  type PublicProfile, type PublicUser, type FriendRequest, getFriends, getFriendRequests,
  searchUserByNickname, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
} from '@/services/socialApi';

type UserSummary = { user_id: string; nickname?: string | null; current_level: number };
const nicknameOf = (user: {nickname: string | null}) => user.nickname?.trim() || '닉네임 없음';

export default function SocialScreen() {
  const { showToast } = useToast();
  const { theme, refreshTheme } = useMoniTheme();
  const themedUi = useMoniUi();
  const [me,setMe] = useState<UserSummary | null>(null);
  const [inventory,setInventory] = useState<InventoryItem[]>([]);
  const [friends,setFriends] = useState<PublicUser[]>([]);
  const [received,setReceived] = useState<FriendRequest[]>([]);
  const [sent,setSent] = useState<FriendRequest[]>([]);
  const [query,setQuery] = useState('');
  const [result,setResult] = useState<PublicProfile | null>(null);
  const [searchOpen,setSearchOpen] = useState(false);
  const [openRoom,setOpenRoom] = useState<string | null>(null);
  const [view,setView] = useState<'friends' | 'requests'>('friends');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser() as UserSummary;
      setMe(user);
      try { setInventory(await getInventoryFromApi()); void refreshTheme(); }
      catch { setInventory([]); }
      if (!user.nickname) { setFriends([]);setReceived([]);setSent([]);return; }
      const [friendsResult,receivedResult,sentResult] = await Promise.all([
        getFriends(),getFriendRequests('received'),getFriendRequests('sent'),
      ]);
      setFriends(friendsResult.data ?? []);
      setReceived(receivedResult.data ?? []);
      setSent(sentResult.data ?? []);
    } catch(error) { showToast(error instanceof Error ? error.message : '친구 목록을 불러오지 못했어요.'); }
    finally { setLoading(false); }
  },[showToast,refreshTheme]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const search = async () => {
    if (!query.trim()) return;
    try { setBusy(true); setResult((await searchUserByNickname(query)).data); }
    catch(error) {setResult(null);showToast(error instanceof Error ? error.message : '사용자를 찾지 못했어요.');}
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!result?.nickname || busy) return;
    try {
      setBusy(true);
      const action=await sendFriendRequest(result.nickname);
      showToast(action.data.auto_accepted?'친구가 되었어요.':'친구 요청을 보냈어요.');
      setResult((await searchUserByNickname(result.nickname)).data);
      await load();
    } catch(error){showToast(error instanceof Error?error.message:'친구 요청에 실패했어요.');}
    finally{setBusy(false);}
  };
  const handleRequest = async (action:'accept'|'reject'|'cancel',id:string) => {
    if (busy) return;
    try{
      setBusy(true);
      if(action==='accept') await acceptFriendRequest(id);
      else if(action==='reject') await rejectFriendRequest(id);
      else await cancelFriendRequest(id);
      showToast(action==='accept'?'친구 요청을 수락했어요.':'요청을 처리했어요.');
      await load();
    } catch(error){showToast(error instanceof Error?error.message:'요청을 처리하지 못했어요.');}
    finally{setBusy(false);}
  };

  return <View style={themedUi.screen}><ScrollView contentContainerStyle={themedUi.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={[themedUi.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:15,flexWrap:'wrap'}]}>
      <View style={{flex:1,minWidth:135}}><Text style={themedUi.title}>친구</Text><Text style={themedUi.subtitle}>서로의 캐릭터와 방을 구경해요.</Text></View>
      <Pressable style={[themedUi.button,{backgroundColor:theme.accent}]} onPress={()=>{setSearchOpen(true);setResult(null);setQuery('');}}>
        <View style={themedUi.row}><UserPlus size={18} color={palette.ink}/><Text style={themedUi.buttonText}>친구 찾기</Text></View>
      </Pressable>
    </View>

    <View style={[themedUi.card,{backgroundColor:theme.subtle}]}>
      <View style={[themedUi.row,{justifyContent:'space-between',flexWrap:'wrap'}]}>
        <View style={{flex:1,minWidth:150}}>
          <Text style={themedUi.muted}>내 캐릭터</Text>
          <Text style={[themedUi.heading,{fontSize:20,marginTop:4}]}>{me?.nickname || '닉네임 미설정'}</Text>
          <Text style={themedUi.muted}>Lv.{me?.current_level ?? 1} · 장착 아이템 {inventory.filter(item=>item.is_equipped).length}개</Text>
        </View>
        <Pressable onPress={()=>router.push('/mypage')} style={themedUi.secondary}><Text style={themedUi.buttonText}>내 정보 수정</Text></Pressable>
      </View>
      <View style={styles.roomArea}><CharacterRoom inventory={inventory}/></View>
      {!me?.nickname && <Text style={[themedUi.muted,{marginTop:12}]}>친구를 추가하려면 마이페이지의 내 정보 수정에서 닉네임을 설정해 주세요.</Text>}
    </View>

    <View style={[themedUi.row,{marginTop:3,marginBottom:14,flexWrap:'wrap'}]}>
      <Pressable onPress={()=>setView('friends')} style={[view==='friends'?themedUi.button:themedUi.secondary,view==='friends'&&{backgroundColor:theme.accent}]}>
        <Text style={themedUi.buttonText}>친구 {friends.length}</Text>
      </Pressable>
      <Pressable onPress={()=>setView('requests')} style={[view==='requests'?themedUi.button:themedUi.secondary,view==='requests'&&{backgroundColor:theme.accent}]}>
        <Text style={themedUi.buttonText}>요청 {received.length+sent.length}</Text>
      </Pressable>
      <Pressable onPress={()=>void load()} disabled={loading} style={themedUi.secondary} accessibilityLabel="친구 목록 새로고침"><RefreshCw size={17} color={palette.ink}/></Pressable>
    </View>
    {loading && <Text style={themedUi.muted}>친구 정보를 불러오는 중...</Text>}
    {!me?.nickname ? <View style={themedUi.card}><Text style={themedUi.muted}>닉네임을 설정하면 친구를 찾을 수 있습니다.</Text></View>
    :view==='friends'?friends.length?friends.map(friend=>{
      const friendInventory=getPublicInventory(friend);
      const friendTheme=themeForCharacter(friend.character?.name);
      const furniture=(friend.equipped_items??[]).filter(item=>['FURNITURE','WALLPAPER','FLOORING','DECOR','THEME'].includes(item.category));
      const expanded=openRoom===friend.user_id;
      return <View key={friend.user_id} style={themedUi.card}>
        <View style={[themedUi.row,{alignItems:'flex-start'}]}>
          <View style={[styles.avatar,{backgroundColor:friendTheme.soft}]}><UsersRound color={friendTheme.deep} size={22}/></View>
          <View style={{flex:1,minWidth:0}}>
            <Text style={themedUi.heading}>{nicknameOf(friend)}</Text>
            <Text style={themedUi.muted}>Lv.{friend.current_level} · {friend.total_xp} XP</Text>
            <Text style={themedUi.muted}>캐릭터: {friend.character?.name??'기본'} · 가구/꾸미기 {furniture.length}개</Text>
            {furniture.length>0 && <Text style={[themedUi.muted,{marginTop:5}]} numberOfLines={2}>{furniture.map(item=>item.name).join(' · ')}</Text>}
          </View>
        </View>
        <View style={[themedUi.row,{marginTop:12,flexWrap:'wrap'}]}>
          <Pressable style={[themedUi.secondary,{flex:1}]} onPress={()=>setOpenRoom(expanded?null:friend.user_id)}>
            <View style={themedUi.row}><Text style={themedUi.buttonText}>{expanded?'방 미리보기 닫기':'방 미리보기'}</Text><ChevronDown size={16} color={palette.ink}/></View>
          </Pressable>
          <Pressable style={[themedUi.button,{backgroundColor:theme.accent,flex:1}]} onPress={()=>router.push({pathname:'/social/[userId]',params:{userId:friend.user_id}})}>
            <View style={themedUi.row}><Text style={themedUi.buttonText}>프로필 보기</Text><ChevronRight size={16} color={palette.ink}/></View>
          </Pressable>
        </View>
        {expanded && <View style={styles.roomArea}><CharacterRoom inventory={friendInventory}/></View>}
      </View>;
    }):<View style={themedUi.card}><Text style={themedUi.muted}>아직 친구가 없어요. 친구를 검색해 보세요.</Text></View>
    :<>
      <Text style={themedUi.heading}>받은 요청</Text>
      {received.length?received.map(item=><View key={item.request_id} style={themedUi.card}><View style={themedUi.row}>
        <View style={{flex:1}}><Text style={themedUi.heading}>{nicknameOf(item.user)}</Text><Text style={themedUi.muted}>Lv.{item.user.current_level}</Text></View>
        <Pressable style={themedUi.secondary} disabled={busy} onPress={()=>void handleRequest('reject',item.request_id)}><X size={18} color={palette.ink}/></Pressable>
        <Pressable style={[themedUi.button,{backgroundColor:theme.accent}]} disabled={busy} onPress={()=>void handleRequest('accept',item.request_id)}><Check size={18} color={palette.ink}/></Pressable>
      </View></View>):<Text style={themedUi.muted}>받은 요청이 없어요.</Text>}
      <Text style={[themedUi.heading,{marginTop:20}]}>보낸 요청</Text>
      {sent.length?sent.map(item=><View key={item.request_id} style={themedUi.card}><View style={themedUi.row}>
        <View style={{flex:1}}><Text style={themedUi.heading}>{nicknameOf(item.user)}</Text><Text style={themedUi.muted}>응답 대기</Text></View>
        <Pressable style={themedUi.secondary} disabled={busy} onPress={()=>void handleRequest('cancel',item.request_id)}><Text style={themedUi.buttonText}>취소</Text></Pressable>
      </View></View>):<Text style={themedUi.muted}>보낸 요청이 없어요.</Text>}
    </>}
  </ScrollView>
    <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={()=>setSearchOpen(false)}>
      <View style={styles.backdrop}><View style={[themedUi.card,styles.searchModal]}>
        <View style={[themedUi.row,{justifyContent:'space-between'}]}><Text style={themedUi.heading}>친구 찾기</Text><Pressable onPress={()=>setSearchOpen(false)}><X size={20} color={palette.ink}/></Pressable></View>
        <TextInput style={themedUi.input} value={query} onChangeText={setQuery} placeholder="닉네임 입력" autoCapitalize="none" onSubmitEditing={()=>void search()}/>
        <Pressable style={[themedUi.button,{backgroundColor:theme.accent}]} disabled={busy} onPress={()=>void search()}><View style={themedUi.row}><Search size={17} color={palette.ink}/><Text style={themedUi.buttonText}>검색</Text></View></Pressable>
        {result && <View style={[themedUi.card,{marginTop:13,backgroundColor:'#FFFFFF',marginBottom:0}]}>
          <Text style={themedUi.heading}>{nicknameOf(result)}</Text>
          <Text style={themedUi.muted}>Lv.{result.current_level} · {result.character?.name??'기본 캐릭터'}</Text>
          {result.friendship_status==='NONE'?<Pressable style={[themedUi.button,{backgroundColor:theme.accent,marginTop:12}]} onPress={()=>void send()} disabled={busy}><Text style={themedUi.buttonText}>친구 요청</Text></Pressable>
          :<Text style={[themedUi.muted,{marginTop:8}]}>{result.friendship_status==='FRIEND'?'이미 친구입니다.':result.friendship_status==='SELF'?'내 계정입니다.':'친구 요청 처리 중'}</Text>}
        </View>}
      </View></View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  roomArea:{marginTop:14,borderRadius:18,overflow:'hidden'},
  avatar:{width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center'},
  backdrop:{flex:1,justifyContent:'center',backgroundColor:'#0008',padding:18},
  searchModal:{maxWidth:540,width:'100%',alignSelf:'center'},
});
