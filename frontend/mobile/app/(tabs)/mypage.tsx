import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Bell, CreditCard, LogOut, Pencil, Target, UserRound, WalletCards, X } from 'lucide-react-native';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser, updateCurrentUser } from '@/services/authService';
import { deleteAccessToken } from '@/services/tokenStorage';
import { DEFAULT_APP_PREFERENCES, getAppPreferences, saveAppPreferences, type AppPreferences } from '@/services/preferenceStorage';
import { useMoniTheme } from '@/contexts/MoniThemeContext';
import { palette, useMoniUi } from '@/constants/moniTheme';
import type { MeResponse } from '@/types/api';

type Profile = MeResponse & {nickname?:string|null};
const INCOME_TYPES = [['STUDENT','학생'],['EMPLOYEE','직장인'],['FREELANCER','프리랜서'],['OTHER','기타']] as const;
const SPEND_PROFILES = [['STEADY','안정형'],['IMPULSIVE','즉흥 소비형'],['CYCLICAL','주기 소비형']] as const;
const toLabel = (options:readonly (readonly [string,string])[],key:string)=>options.find(item=>item[0]===key)?.[1]??key;
function xpNeeded(level:number){return 30+10*Math.max(0,level-1);}
function baseXp(level:number){let sum=0;for(let n=1;n<level;n++)sum+=xpNeeded(n);return sum;}

export default function MyPageScreen(){
  const {showToast}=useToast();
  const {theme,refreshTheme}=useMoniTheme();
  const themedUi=useMoniUi();
  const [user,setUser]=useState<Profile|null>(null);
  const [preferences,setPreferences]=useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [nickname,setNickname]=useState('');
  const [email,setEmail]=useState('');
  const [incomeType,setIncomeType]=useState('STUDENT');
  const [payday,setPayday]=useState('25');
  const [spendProfile,setSpendProfile]=useState('STEADY');
  const load=useCallback(async()=>{
    const [u,p]=await Promise.allSettled([getCurrentUser(),getAppPreferences()]);
    if(u.status==='fulfilled')setUser(u.value as Profile);
    else showToast('내 정보를 불러오지 못했어요.');
    if(p.status==='fulfilled')setPreferences(p.value);
  },[showToast]);
  useFocusEffect(useCallback(()=>{void load();void refreshTheme();},[load,refreshTheme]));

  const xpProgress=useMemo(()=>{
    if(!user)return 0;
    if(user.current_level>=50)return 1;
    const required=xpNeeded(user.current_level);
    return Math.min(1,Math.max(0,(user.total_xp-baseXp(user.current_level))/required));
  },[user]);
  const remainingXp=user&&user.current_level<50?Math.max(0,xpNeeded(user.current_level)-(user.total_xp-baseXp(user.current_level))):0;

  const openEdit=()=>{
    if(!user)return;
    setNickname(user.nickname??'');setEmail(user.email);
    setIncomeType(user.income_type||'STUDENT');setPayday(String(user.payday??25));
    setSpendProfile(user.spend_profile||'STEADY');setEditing(true);
  };
  const saveProfile=async()=>{
    if(saving)return;
    const name=nickname.trim();const day=Number(payday);
    if(name.length<2||name.length>12){showToast('닉네임은 2~12자로 입력해 주세요.');return;}
    if(!email.trim()||!email.includes('@')){showToast('이메일을 확인해 주세요.');return;}
    if(!Number.isInteger(day)||day<1||day>31){showToast('수입일은 1~31일 사이여야 합니다.');return;}
    try{
      setSaving(true);
      const updated=await updateCurrentUser({nickname:name,email:email.trim(),income_type:incomeType,payday:day,spend_profile:spendProfile} as Parameters<typeof updateCurrentUser>[0]);
      setUser(updated as Profile);setEditing(false);showToast('내 정보를 저장했어요.');
    }catch(error){showToast(error instanceof Error?error.message:'내 정보 수정에 실패했어요.');}
    finally{setSaving(false);}
  };
  const changePreference=async(key:keyof AppPreferences,value:boolean)=>{
    const previous=preferences;const next={...preferences,[key]:value};setPreferences(next);
    try{await saveAppPreferences(next);}catch{setPreferences(previous);showToast('설정 저장에 실패했어요.');}
  };
  const logout=async()=>{await deleteAccessToken();router.replace('/auth/login');};

  return <View style={themedUi.screen}><ScrollView contentContainerStyle={themedUi.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Text style={themedUi.title}>마이페이지</Text>
    <Text style={themedUi.subtitle}>내 정보와 앱 설정을 관리합니다.</Text>
    <View style={[themedUi.card,{backgroundColor:theme.subtle}]}>
      <View style={[themedUi.row,{alignItems:'flex-start'}]}>
        <View style={[styles.avatar,{backgroundColor:theme.soft}]}><UserRound size={25} color={theme.deep}/></View>
        <View style={{flex:1,minWidth:0}}>
          <Text style={[themedUi.heading,{fontSize:20}]}>{user?.nickname||'닉네임 미설정'}</Text>
          <Text style={themedUi.text}>{user?.email||'계정 정보 불러오는 중'}</Text>
          <Text style={[themedUi.muted,{marginTop:6}]}>{toLabel(INCOME_TYPES,user?.income_type||'STUDENT')} · {toLabel(SPEND_PROFILES,user?.spend_profile||'STEADY')} · 매월 {user?.payday??25}일</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={openEdit} style={[themedUi.secondary,{paddingHorizontal:12}]}><View style={themedUi.row}><Pencil size={16} color={palette.ink}/><Text style={themedUi.buttonText}>내 정보 수정</Text></View></Pressable>
      </View>
    </View>
    <View style={themedUi.card}>
      <View style={[themedUi.row,{justifyContent:'space-between'}]}>
        <View><Text style={themedUi.muted}>성장 상태</Text><Text style={[themedUi.heading,{fontSize:22,marginTop:3}]}>Lv.{user?.current_level??1}</Text></View>
        <View style={[themedUi.row,{borderRadius:99,backgroundColor:theme.soft,paddingHorizontal:13,paddingVertical:9}]}>
          <WalletCards size={17} color={theme.deep}/><Text style={[themedUi.buttonText,{color:theme.deep}]}>{user?.current_points??0}P</Text>
        </View>
      </View>
      <View style={[styles.progressTrack,{backgroundColor:theme.soft}]}><View style={{width:`${Math.round(xpProgress*100)}%` as `${number}%`,height:'100%',backgroundColor:theme.accent,borderRadius:99}}/></View>
      <View style={[themedUi.row,{justifyContent:'space-between',marginTop:9,flexWrap:'wrap'}]}>
        <Text style={themedUi.muted}>누적 {user?.total_xp??0} XP</Text><Text style={themedUi.muted}>다음 레벨까지 {remainingXp} XP</Text>
      </View>
    </View>
    <View style={themedUi.card}>
      <Text style={themedUi.heading}>앱 설정</Text>
      <PreferenceRow icon={<Bell size={19} color={theme.deep}/>} title="알림 받기" value={preferences.pushEnabled} onChange={value=>void changePreference('pushEnabled',value)}/>
      <PreferenceRow icon={<Target size={19} color={theme.deep}/>} title="챌린지 알림" value={preferences.challengeReminderEnabled} onChange={value=>void changePreference('challengeReminderEnabled',value)}/>
      <PreferenceRow icon={<CreditCard size={19} color={theme.deep}/>} title="예산 알림" value={preferences.budgetAlertEnabled} onChange={value=>void changePreference('budgetAlertEnabled',value)}/>
    </View>
    <Pressable onPress={()=>void logout()} style={themedUi.secondary}><View style={themedUi.row}><LogOut size={18} color={theme.deep}/><Text style={themedUi.dangerText}>로그아웃</Text></View></Pressable>
  </ScrollView>
    <Modal visible={editing} transparent animationType="fade" onRequestClose={()=>!saving&&setEditing(false)}>
      <View style={styles.backdrop}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[themedUi.card,styles.modalCard,{backgroundColor:theme.surface}]}>
        <View style={[themedUi.row,{justifyContent:'space-between'}]}><Text style={themedUi.heading}>내 정보 수정</Text><Pressable disabled={saving} onPress={()=>setEditing(false)}><X size={20} color={palette.ink}/></Pressable></View>
        <Text style={themedUi.muted}>닉네임</Text><TextInput style={themedUi.input} value={nickname} maxLength={12} onChangeText={setNickname} autoCapitalize="none" placeholder="2~12자 닉네임"/>
        <Text style={themedUi.muted}>이메일</Text><TextInput style={themedUi.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>
        <Text style={themedUi.muted}>소득 유형</Text>
        <View style={[themedUi.rowWrap,{marginBottom:12}]}>{INCOME_TYPES.map(([key,label])=><Pressable key={key} onPress={()=>setIncomeType(key)} style={[themedUi.secondary,incomeType===key&&{backgroundColor:theme.accent}]}><Text style={themedUi.buttonText}>{label}</Text></Pressable>)}</View>
        <Text style={themedUi.muted}>수입일</Text><TextInput style={themedUi.input} value={payday} onChangeText={setPayday} keyboardType="numeric" placeholder="1~31"/>
        <Text style={themedUi.muted}>소비 성향</Text>
        <View style={[themedUi.rowWrap,{marginBottom:15}]}>{SPEND_PROFILES.map(([key,label])=><Pressable key={key} onPress={()=>setSpendProfile(key)} style={[themedUi.secondary,spendProfile===key&&{backgroundColor:theme.accent}]}><Text style={themedUi.buttonText}>{label}</Text></Pressable>)}</View>
        <Pressable style={[themedUi.button,{backgroundColor:theme.accent}]} disabled={saving} onPress={()=>void saveProfile()}><Text style={themedUi.buttonText}>{saving?'저장 중':'저장'}</Text></Pressable>
      </ScrollView></View>
    </Modal>
  </View>;
}
function ThemedPreferenceSwitch({value,onChange}:{value:boolean;onChange:(value:boolean)=>void}){
  const {theme}=useMoniTheme();
  return <Switch value={value} onValueChange={onChange} trackColor={{false:theme.soft,true:theme.accent}} thumbColor="#FFFFFF"/>;
}
function PreferenceRow({icon,title,value,onChange}:{icon:ReactNode;title:string;value:boolean;onChange:(value:boolean)=>void}){
  const themedUi = useMoniUi();

  return <View style={[themedUi.row,{minHeight:54,justifyContent:'space-between'}]}>
    <View style={themedUi.row}>{icon}<Text style={themedUi.text}>{title}</Text></View><ThemedPreferenceSwitch value={value} onChange={onChange}/>
  </View>;
}
const styles=StyleSheet.create({
  avatar:{width:50,height:50,borderRadius:16,alignItems:'center',justifyContent:'center'},
  progressTrack:{height:10,backgroundColor:'#FFF0C1',borderRadius:99,overflow:'hidden',marginTop:10},
  backdrop:{flex:1,justifyContent:'center',backgroundColor:'#0008',padding:15},
  modalCard:{width:'100%',maxWidth:560,alignSelf:'center',backgroundColor:'#FFF7E2',paddingBottom:18},
});
