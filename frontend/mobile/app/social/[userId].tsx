import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, PackageOpen, Trash2, UsersRound } from 'lucide-react-native';
import { CharacterRoom } from '@/components/CharacterRoom';
import { useToast } from '@/contexts/ToastContext';
import { useMoniTheme } from '@/contexts/MoniThemeContext';
import { palette,useMoniUi } from '@/constants/moniTheme';
import { getPublicInventory } from '@/services/publicInventory';
import { deleteFriend,getPublicProfile,type PublicProfile } from '@/services/socialApi';

export default function FriendProfileScreen(){
  const params=useLocalSearchParams<{userId:string}>();
  const userId=Array.isArray(params.userId)?params.userId[0]:params.userId;
  const {showToast}=useToast();
  const {theme}=useMoniTheme();
  const themedUi=useMoniUi();
  const [profile,setProfile]=useState<PublicProfile|null>(null);
  const [loading,setLoading]=useState(true);
  const [removing,setRemoving]=useState(false);
  const load=useCallback(async()=>{
    if(!userId)return;
    try{setLoading(true);setProfile((await getPublicProfile(userId)).data);}
    catch(error){showToast(error instanceof Error?error.message:'프로필을 불러오지 못했어요.');}
    finally{setLoading(false);}
  },[userId,showToast]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const inventory=useMemo(()=>profile?getPublicInventory(profile):[],[profile]);
  const furniture=profile?.equipped_items?.filter(item=>['FURNITURE','WALLPAPER','FLOORING','DECOR','THEME'].includes(item.category))??[];
  const remove=async()=>{
    if(!profile||removing)return;
    try{setRemoving(true);await deleteFriend(profile.user_id);showToast('친구를 삭제했어요.');router.back();}
    catch(error){showToast(error instanceof Error?error.message:'친구 삭제에 실패했어요.');}
    finally{setRemoving(false);}
  };
  const confirmRemove=()=>{
    if(!profile)return;
    const message=`${profile.nickname||'이 사용자'}님을 친구 목록에서 삭제할까요?`;
    if(Platform.OS==='web'){if(typeof window!=='undefined'&&window.confirm(message))void remove();}
    else Alert.alert('친구 삭제',message,[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void remove()}]);
  };
  return <View style={themedUi.screen}><ScrollView contentContainerStyle={themedUi.scroll} showsVerticalScrollIndicator={false}>
    <Pressable style={[themedUi.row,{marginBottom:16}]} onPress={()=>router.back()}><ArrowLeft size={18} color={palette.ink}/><Text style={themedUi.text}>친구 목록</Text></Pressable>
    {loading?<Text style={themedUi.muted}>친구 프로필을 불러오는 중...</Text>:profile?<>
      <Text style={themedUi.title}>{profile.nickname||'친구 프로필'}</Text>
      <Text style={themedUi.subtitle}>Lv.{profile.current_level} · 누적 {profile.total_xp} XP</Text>
      <View style={[themedUi.card,{backgroundColor:theme.subtle}]}><CharacterRoom inventory={inventory}/></View>
      <View style={themedUi.card}>
        <View style={themedUi.row}><UsersRound size={20} color={theme.deep}/><Text style={themedUi.heading}>캐릭터와 장착 아이템</Text></View>
        <Text style={themedUi.muted}>캐릭터: {profile.character?.name??'기본'}</Text>
        <View style={[themedUi.rowWrap,{marginTop:11}]}>{inventory.length>0?inventory.map(item=><View key={item.id} style={[themedUi.secondary,{minHeight:32,paddingHorizontal:10}]}><Text style={themedUi.text}>{item.item?.name}</Text></View>):<Text style={themedUi.muted}>장착한 아이템이 없어요.</Text>}</View>
      </View>
      <View style={themedUi.card}>
        <View style={themedUi.row}><PackageOpen size={20} color={theme.deep}/><Text style={themedUi.heading}>방과 가구</Text></View>
        {furniture.length>0?furniture.map(item=><Text key={item.item_id} style={[themedUi.text,{marginVertical:4}]}>{item.name}</Text>):<Text style={themedUi.muted}>배치된 가구가 없어요.</Text>}
      </View>
      {profile.friendship_status==='FRIEND'&&<Pressable disabled={removing} onPress={confirmRemove} style={themedUi.secondary}><View style={themedUi.row}><Trash2 size={17} color={theme.deep}/><Text style={themedUi.dangerText}>친구 삭제</Text></View></Pressable>}
    </>:<View style={themedUi.card}><Text style={themedUi.muted}>프로필을 표시할 수 없어요.</Text></View>}
  </ScrollView></View>;
}
