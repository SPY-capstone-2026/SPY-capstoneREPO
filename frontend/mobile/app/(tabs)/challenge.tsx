import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Flame, Trophy } from 'lucide-react-native';
import { WanderingMascot } from '@/components/mascot';
import { useToast } from '@/contexts/ToastContext';
import { getTodayChallengesFromApi, updateChallengeStatusFromApi } from '@/services/challengeService';
import type { ApiChallenge, ChallengeAiMetadata } from '@/types/api';
import { palette, ui } from '@/constants/moniTheme';

function difficultyLabel(value: string) {
  if (value === 'Hard') return '어려움';
  if (value === 'Medium-Hard') return '조금 어려움';
  if (value === 'Medium') return '보통';
  if (value === 'Special') return '보너스';
  return '쉬움';
}
const stateLabel = (status: string) => status === 'VERIFYING' ? '완료 대기' : status === 'SUCCESS' ? '달성 확정'
  : status === 'FAILED' ? '실패' : '완료 표시';
const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;

export default function ChallengeScreen() {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState<ApiChallenge[]>([]);
  const [filter, setFilter] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const load = useCallback(async () => {
    try { setLoading(true); setChallenges(await getTodayChallengesFromApi()); }
    catch(error) { showToast(error instanceof Error ? error.message : '챌린지를 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const verifying = challenges.filter(c => c.status === 'VERIFYING').length;
  const confirmed = challenges.filter(c => c.status === 'SUCCESS').length;
  const selectedCount = verifying + confirmed;
  const totalReward = challenges.reduce((n,c)=>n + c.xp_reward,0);
  const streakCount = challenges.filter(c => c.challenge_type === 'streak형' || c.ai_metadata?.challenge_origin === 'streak').length;
  const displayed = useMemo(() => challenges.filter(c => filter === '전체' || difficultyLabel(c.difficulty) === filter), [challenges, filter]);
  const budgetWarning = challenges.find(c => {
    const m = c.ai_metadata as ChallengeAiMetadata | null | undefined;
    return typeof m?.budget_pressure === 'number' && m.budget_pressure >= 1.2;
  });
  const changeStatus = async (challenge: ApiChallenge) => {
    if (updating !== null) return;
    if (challenge.status === 'SUCCESS' || challenge.status === 'FAILED') {
      showToast('최종 정산된 챌린지는 변경할 수 없어요.'); return;
    }
    const next = challenge.status === 'VERIFYING' ? 'PENDING' : 'SUCCESS';
    try {
      setUpdating(challenge.challenge_id);
      const response = await updateChallengeStatusFromApi(String(challenge.challenge_id), next);
      setChallenges(existing=>existing.map(c=>c.challenge_id===challenge.challenge_id?response.challenge:c));
      if (response.challenge.status === 'VERIFYING') showToast('완료 대기 상태예요. 다음 날 00:05 이후 지출로 검증해요.');
      else if (response.challenge.status === 'PENDING') showToast('완료 표시를 취소했어요.');
      else showToast('상태가 변경됐어요.');
    } catch(error) { showToast(error instanceof Error ? error.message : '완료 상태를 저장하지 못했어요.'); }
    finally { setUpdating(null); }
  };
  return <View style={ui.screen}><ScrollView contentContainerStyle={ui.scroll}>
    <Text style={ui.title}>데일리 챌린지</Text>
    <View style={[ui.row,{marginBottom:15}]}>
      <WanderingMascot enabled={false} motionEnabled size={76} state="idle"/>
      <View style={[ui.card,{flex:1,backgroundColor:palette.soft,marginBottom:0}]}>
        <Text style={ui.text}>오늘의 소비를 확인해 볼까?</Text>
        <Text style={ui.muted}>실천한 챌린지를 체크하면 내일 00:05에 최종 확인할게!</Text>
      </View>
    </View>
    <View style={[ui.card,{backgroundColor:palette.soft}]}>
      <Text style={ui.heading}>오늘의 진행도</Text>
      <Text style={ui.text}>총 {challenges.length}개 중 {selectedCount}개 완료 표시</Text>
      <View style={[ui.row,{marginTop:12,flexWrap:'wrap'}]}>
        <View style={ui.row}><Clock3 size={18} color={palette.ink}/><Text style={ui.text}>검증 대기 {verifying}개</Text></View>
        <View style={ui.row}><CheckCircle2 size={18} color={palette.ink}/><Text style={ui.text}>확정 {confirmed}개</Text></View>
      </View>
      <View style={[ui.row,{marginTop:10}]}><Trophy size={17} color={palette.ink}/><Text style={ui.muted}>전체 달성 시 {totalReward} XP · 무지출 챌린지 {streakCount}개</Text></View>
      <Text style={[ui.muted,{marginTop:13}]}>체크 즉시 XP가 지급되지 않습니다. 다음 날 한국시간 00:05 이후 서버가 소비내역과 비교해 성공·실패를 확정하고, 보상을 지급합니다. 이후 앱에 접속하면 전날 정산 팝업이 표시됩니다.</Text>
    </View>
    {budgetWarning && <Pressable style={[ui.card,{backgroundColor:'#FFF0E6'}]} onPress={()=>router.push('/transactions')}>
      <View style={ui.row}><AlertTriangle size={20} color={palette.danger}/><Text style={ui.heading}>예산 점검이 필요해요</Text></View>
      <Text style={ui.muted}>{budgetWarning.category_name}의 예산 압박도가 높아요. 챌린지보다 예산 재설정을 먼저 검토해 주세요.</Text>
    </Pressable>}
    <View style={[ui.row,{flexWrap:'wrap',marginBottom:12}]}>
      {['전체','쉬움','보통','조금 어려움','어려움','보너스'].map(v=><Pressable key={v} style={filter===v?ui.button:ui.secondary} onPress={()=>setFilter(v)}><Text style={ui.buttonText}>{v}</Text></Pressable>)}
    </View>
    {loading && <Text style={ui.muted}>챌린지를 불러오는 중...</Text>}
    {!displayed.length && !loading && <View style={ui.card}><Text style={ui.muted}>표시할 챌린지가 없어요.</Text></View>}
    {displayed.map(challenge=>{
      const metadata = (challenge.ai_metadata || {}) as ChallengeAiMetadata;
      const isFinal = challenge.status === 'SUCCESS' || challenge.status === 'FAILED';
      const checked = challenge.status === 'VERIFYING' || challenge.status === 'SUCCESS';
      const label = stateLabel(challenge.status);
      return <View key={challenge.challenge_id} style={[ui.card, {backgroundColor:challenge.status === 'VERIFYING'?palette.soft:palette.surface}]}>
        <View style={[ui.row,{justifyContent:'space-between',alignItems:'flex-start'}]}>
          <View style={{flex:1}}>
            <Text style={[ui.muted,{marginBottom:5}]}>{challenge.category_name} · {challenge.challenge_type} · {difficultyLabel(challenge.difficulty)}</Text>
            <Text style={[ui.heading,{fontSize:18,lineHeight:27}]}>{challenge.challenge_text}</Text>
          </View>
          <View style={[ui.secondary,{backgroundColor:palette.soft}]}><Text style={ui.buttonText}>달성 시 +{challenge.xp_reward} XP</Text></View>
        </View>
        {typeof metadata.daily_limit === 'number' && <Text style={[ui.muted,{marginBottom:10}]}>오늘 소비 한도: {money(metadata.daily_limit)}</Text>}
        {typeof metadata.predicted_today === 'number' && <Text style={[ui.muted,{marginBottom:10}]}>오늘의 예상 소비: {money(metadata.predicted_today)}</Text>}
        {metadata.context_label && <Text style={[ui.muted,{marginBottom:10}]}>{metadata.context_label}</Text>}
        <Pressable disabled={isFinal || updating !== null} accessibilityRole="checkbox" accessibilityState={{checked,disabled:isFinal || updating!==null}}
          onPress={()=>void changeStatus(challenge)} style={checked?ui.button:ui.secondary}>
          <View style={ui.row}><ClipboardCheck size={18} color={palette.ink}/><Text style={ui.buttonText}>{updating===challenge.challenge_id?'저장 중':label}</Text></View>
        </Pressable>
        <Text style={[ui.muted,{marginTop:8}]}>{challenge.status === 'VERIFYING' ? '내일 00:05 이후 자동 검증 · 보상 지급 전' : challenge.status === 'SUCCESS'
          ? '검증 완료 · 보상 지급' : challenge.status === 'FAILED' ? '검증 결과: 실패' : '실천했다면 완료 표시해 주세요.'}</Text>
      </View>;
    })}
  </ScrollView></View>;
}
