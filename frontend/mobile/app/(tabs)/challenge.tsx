import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Trophy } from 'lucide-react-native';
import { WanderingMascot } from '@/components/mascot';
import { useToast } from '@/contexts/ToastContext';
import { useMoniTheme } from '@/contexts/MoniThemeContext';
import { getTodayChallengesFromApi, updateChallengeStatusFromApi } from '@/services/challengeService';
import type { ApiChallenge, ChallengeAiMetadata } from '@/types/api';
import { palette, useMoniUi } from '@/constants/moniTheme';

function difficultyLabel(value: string) {
  if (value === 'Hard') return '어려움';
  if (value === 'Medium-Hard') return '조금 어려움';
  if (value === 'Medium') return '보통';
  if (value === 'Special') return '보너스';
  return '쉬움';
}
const stateLabel = (value: string) => value === 'VERIFYING' ? '완료 대기' : value === 'SUCCESS' ? '달성 확정'
  : value === 'FAILED' ? '실패' : '완료 표시';
const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const FILTERS = ['전체', '쉬움', '보통', '조금 어려움', '어려움', '보너스'];

export default function ChallengeScreen() {
  const { showToast } = useToast();
  const { theme } = useMoniTheme();
  const themedUi = useMoniUi();
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const [challenges, setChallenges] = useState<ApiChallenge[]>([]);
  const [filter, setFilter] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setChallenges(await getTodayChallengesFromApi()); }
    catch (error) { showToast(error instanceof Error ? error.message : '챌린지를 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const verifying = challenges.filter(c => c.status === 'VERIFYING').length;
  const confirmed = challenges.filter(c => c.status === 'SUCCESS').length;
  const selectedCount = verifying + confirmed;
  const totalReward = challenges.reduce((sum,c) => sum + c.xp_reward, 0);
  const streakCount = challenges.filter(c => c.challenge_type === 'streak형' || c.ai_metadata?.challenge_origin === 'streak').length;
  const displayed = useMemo(() => challenges.filter(c => filter === '전체' || difficultyLabel(c.difficulty) === filter), [challenges, filter]);
  const budgetWarning = challenges.find(c => typeof c.ai_metadata?.budget_pressure === 'number' && c.ai_metadata.budget_pressure >= 1.2);

  const changeStatus = async (challenge: ApiChallenge) => {
    if (updating !== null) return;
    if (challenge.status === 'SUCCESS' || challenge.status === 'FAILED') {
      showToast('최종 정산된 챌린지는 변경할 수 없어요.'); return;
    }
    const next = challenge.status === 'VERIFYING' ? 'PENDING' : 'SUCCESS';
    try {
      setUpdating(challenge.challenge_id);
      const response = await updateChallengeStatusFromApi(String(challenge.challenge_id), next);
      setChallenges(current => current.map(c => c.challenge_id === challenge.challenge_id ? response.challenge : c));
      showToast(response.challenge.status === 'VERIFYING' ? '완료 대기 상태로 변경했어요.' : '완료 표시를 취소했어요.');
    } catch (error) { showToast(error instanceof Error ? error.message : '챌린지 상태를 저장하지 못했어요.'); }
    finally { setUpdating(null); }
  };

  return <View style={themedUi.screen}><ScrollView contentContainerStyle={themedUi.scroll} showsVerticalScrollIndicator={false}>
    <Text style={themedUi.title}>데일리 챌린지</Text>
    <Text style={themedUi.subtitle}>오늘의 작은 실천을 모아보세요.</Text>

    {/* 마스코트 영역과 진행도 영역을 분리하여 겹침을 방지합니다. */}
    <View style={[styles.hero, { backgroundColor: theme.subtle, flexDirection: compact ? 'column' : 'row' }]}>
      <View style={styles.mascotArea}>
        <WanderingMascot enabled={false} motionEnabled size={82} state="idle" style={styles.mascot} />
      </View>
      <View style={[styles.heroTextArea, compact && { width: '100%', alignItems: 'center' }]}>
        <Text style={[styles.heroTitle, compact && { textAlign:'center' }]}>오늘의 소비를 확인해 볼까요?</Text>
        <Text style={[themedUi.muted, compact && { textAlign:'center' }]}>체크한 챌린지는 내일 00:05 이후에 소비내역과 비교해 최종 확인합니다.</Text>
      </View>
    </View>

    <View style={[themedUi.card, { backgroundColor: theme.surface }]}>
      <View style={[themedUi.row, { justifyContent:'space-between', flexWrap:'wrap' }]}>
        <Text style={[themedUi.heading, { marginBottom:0 }]}>오늘의 진행도</Text>
        <Text style={[styles.progressCount, { color: theme.deep }]}>{selectedCount} / {challenges.length}</Text>
      </View>
      <View style={[styles.progressTrack,{backgroundColor:theme.soft}]}>
        <View style={[styles.progressFill, { backgroundColor: theme.accent, width:`${challenges.length ? Math.min(100,selectedCount/challenges.length*100) : 0}%` as `${number}%` }]} />
      </View>
      <View style={styles.statGrid}>
        <View style={[styles.statCard,{backgroundColor:theme.soft}]}><Clock3 size={18} color={theme.deep}/><Text style={themedUi.text}>완료 대기 {verifying}개</Text></View>
        <View style={[styles.statCard,{backgroundColor:theme.soft}]}><CheckCircle2 size={18} color={theme.deep}/><Text style={themedUi.text}>달성 확정 {confirmed}개</Text></View>
      </View>
      <View style={[themedUi.row, { marginTop:13,flexWrap:'wrap' }]}>
        <Trophy size={17} color={theme.deep}/>
        <Text style={themedUi.muted}>전체 달성 시 {totalReward} XP · 무지출 챌린지 {streakCount}개</Text>
      </View>
      <Text style={[themedUi.muted,{marginTop:10}]}>완료 표시만으로 XP는 지급되지 않습니다. 검증 성공 후 보상이 지급됩니다.</Text>
    </View>

    {budgetWarning && <Pressable accessibilityRole="button" style={[themedUi.card,{backgroundColor:theme.soft}]} onPress={()=>router.push('/transactions')}>
      <View style={[themedUi.row,{alignItems:'flex-start'}]}><AlertTriangle size={21} color={theme.deep}/><View style={{flex:1}}>
        <Text style={themedUi.heading}>예산 점검이 필요해요</Text>
        <Text style={themedUi.muted}>{budgetWarning.category_name}의 예산 압박도가 높아요. 소비 탭의 항목별 예산을 확인해 주세요.</Text>
      </View></View>
    </Pressable>}

    <View style={[themedUi.rowWrap,{marginBottom:14}]}>
      {FILTERS.map(value => <Pressable key={value} accessibilityRole="button" onPress={()=>setFilter(value)}
        style={[styles.filterChip,{backgroundColor:filter===value?theme.accent:theme.surface}]}>
        <Text style={themedUi.buttonText}>{value}</Text>
      </Pressable>)}
    </View>
    {loading && <Text style={themedUi.muted}>챌린지를 불러오는 중...</Text>}
    {!displayed.length && !loading && <View style={themedUi.card}><Text style={themedUi.muted}>표시할 챌린지가 없어요.</Text></View>}
    {displayed.map(challenge=>{
      const metadata = (challenge.ai_metadata || {}) as ChallengeAiMetadata;
      const isFinal = challenge.status === 'SUCCESS' || challenge.status === 'FAILED';
      const checked = challenge.status === 'VERIFYING' || challenge.status === 'SUCCESS';
      return <View key={challenge.challenge_id} style={[themedUi.card,{backgroundColor:checked?theme.subtle:theme.surface}]}>
        <View style={[styles.challengeHeading, compact && {flexDirection:'column'}]}>
          <View style={{flex:1,alignSelf:'stretch'}}>
            <Text style={[themedUi.muted,{marginBottom:5}]}>{challenge.category_name} · {challenge.challenge_type} · {difficultyLabel(challenge.difficulty)}</Text>
            <Text style={[themedUi.heading,{fontSize:17,lineHeight:25}]}>{challenge.challenge_text}</Text>
          </View>
          <View style={[styles.rewardBadge,{backgroundColor:theme.soft}]}><Text style={[themedUi.buttonText,{color:theme.deep}]}>달성 시 +{challenge.xp_reward} XP</Text></View>
        </View>
        {typeof metadata.daily_limit === 'number' && <Text style={themedUi.muted}>오늘 소비 한도: {money(metadata.daily_limit)}</Text>}
        {typeof metadata.predicted_today === 'number' && <Text style={themedUi.muted}>오늘 예상 소비: {money(metadata.predicted_today)}</Text>}
        {metadata.context_label && <Text style={[themedUi.muted,{marginTop:6}]}>{metadata.context_label}</Text>}
        <Pressable disabled={isFinal || updating!==null} accessibilityRole="checkbox" accessibilityState={{checked,disabled:isFinal || updating!==null}}
          onPress={()=>void changeStatus(challenge)} style={[styles.action,{backgroundColor:checked?theme.accent:theme.soft,opacity:isFinal?0.72:1}]}>
          <ClipboardCheck size={17} color={palette.ink}/><Text style={themedUi.buttonText}>{updating===challenge.challenge_id?'저장 중':stateLabel(challenge.status)}</Text>
        </Pressable>
        <Text style={[themedUi.muted,{marginTop:8}]}>{challenge.status==='VERIFYING'?'내일 00:05 이후 검증 · 보상 지급 전':challenge.status==='SUCCESS'?'검증 완료 · 보상 지급':challenge.status==='FAILED'?'검증 결과: 실패':'실천했다면 완료로 표시해 주세요.'}</Text>
      </View>;
    })}
  </ScrollView></View>;
}
const styles=StyleSheet.create({
  hero:{minHeight:154,borderRadius:24,paddingHorizontal:16,paddingVertical:13,alignItems:'center',marginBottom:16,gap:12},
  mascotArea:{width:135,height:125,alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'visible'},
  mascot:{width:118,height:118},
  heroTextArea:{flex:1,justifyContent:'center',gap:7,minWidth:0},
  heroTitle:{fontSize:17,fontWeight:'800',lineHeight:25,color:palette.ink},
  progressCount:{fontSize:20,fontWeight:'900'},
  progressTrack:{height:9,borderRadius:99,backgroundColor:'#FFF0C1',marginTop:14,overflow:'hidden'},
  progressFill:{height:'100%',borderRadius:99},
  statGrid:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:15},
  statCard:{flexGrow:1,flexBasis:135,minHeight:52,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  filterChip:{minHeight:38,borderRadius:12,paddingHorizontal:13,justifyContent:'center'},
  challengeHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:8},
  rewardBadge:{borderRadius:12,paddingHorizontal:10,paddingVertical:8,alignSelf:'flex-start'},
  action:{borderRadius:12,minHeight:44,justifyContent:'center',alignItems:'center',flexDirection:'row',gap:9,marginTop:15},
});
