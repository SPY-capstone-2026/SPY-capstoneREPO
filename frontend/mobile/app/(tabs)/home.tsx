import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Plus,
  ReceiptText,
  Smile,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { WanderingMascot } from '@/components/mascot';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser } from '@/services/authService';
import { getTodayChallengesFromApi } from '@/services/challengeService';
import { getMonthlyReportFromApi } from '@/services/reportService';
import type { ApiChallenge, MeResponse, MonthlyReportResponse } from '@/types/api';
import { formatWon } from '@/utils/aiFormat';

type MonthlyReportData = MonthlyReportResponse['data'];

const defaultReportData: MonthlyReportData = {
  month: '',
  monthly_summary: {
    total_spend: 0,
    budget_limit: 0,
    predicted_monthly_spend: 0,
    budget_pressure: 0,
    transaction_count: 0,
  },
  weekly_trend: [],
  evaluated_categories: [],
};

function getTodayLabel() {
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일`;
}

export default function HomeScreen() {
  const { showToast } = useToast();
  const [report, setReport] = useState<MonthlyReportData>(defaultReportData);
  const [challenges, setChallenges] = useState<ApiChallenge[]>([]);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const summary = report.monthly_summary;
  const completedCount = useMemo(
    () => challenges.filter((challenge) => challenge.status === 'SUCCESS').length,
    [challenges]
  );
  const nextChallenge = useMemo(
    () => challenges.find((challenge) => challenge.status === 'PENDING') ?? challenges[0] ?? null,
    [challenges]
  );

  const loadHome = useCallback(async () => {
    try {
      setIsLoading(true);
      const [reportResult, challengeResult, userResult] = await Promise.allSettled([
        getMonthlyReportFromApi(),
        getTodayChallengesFromApi(),
        getCurrentUser(),
      ]);

      if (reportResult.status === 'fulfilled') setReport(reportResult.value);
      if (challengeResult.status === 'fulfilled') setChallenges(challengeResult.value);
      if (userResult.status === 'fulfilled') setUser(userResult.value);

      if (
        reportResult.status === 'rejected' ||
        challengeResult.status === 'rejected' ||
        userResult.status === 'rejected'
      ) {
        showToast('일부 정보를 불러오지 못했어요.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <AppScreenHeader
          label="MONI"
          title="오늘의 소비를 가볍게 확인해요."
          description={isLoading ? '정보를 불러오고 있어요.' : `${getTodayLabel()} 기준`}
        />

        <View style={styles.mascotMessageRow}>
          <View style={styles.homeMascot}>
            <WanderingMascot
              enabled={false}
              motionEnabled
              size={78}
              state="idle"
              style={styles.fixedMascotMotion}
            />
          </View>
          <View style={styles.speechBubble}>
            <View style={styles.speechTail} />
            <Text style={styles.speechLabel}>Moni의 오늘 챌린지</Text>
            <Text style={styles.speechText} numberOfLines={3}>
              {nextChallenge?.challenge_text ?? '오늘의 소비 기록을 기다리고 있어요.'}
            </Text>
            <Pressable style={styles.speechLink} onPress={() => router.push('/(tabs)/challenge')}>
              <Text style={styles.speechLinkText}>
                {challenges.length > 0 ? `${challenges.length}개 챌린지 보기` : '챌린지 확인'}
              </Text>
              <ArrowRight size={14} color={colors.text} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        <GlassCard tone="butter" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>이번 달 현재 지출</Text>
              <Text style={styles.heroValue}>{formatWon(summary.total_spend)}</Text>
            </View>
            <View style={styles.reportIcon}>
              <BarChart3 size={21} color={colors.butterDeep} strokeWidth={2.5} />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.miniLabel}>월말 예상</Text>
              <Text style={styles.miniValue}>{formatWon(summary.predicted_monthly_spend)}</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/report')} style={styles.linkButton}>
              <Text style={styles.linkText}>리포트 보기</Text>
              <ArrowRight size={16} color={colors.text} strokeWidth={2.5} />
            </Pressable>
          </View>
        </GlassCard>

        <View style={styles.quickRow}>
          <Pressable
            style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <View style={styles.quickIcon}>
              <Plus size={20} color={colors.text} strokeWidth={2.7} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>지출 기록</Text>
              <Text style={styles.quickDescription}>새 소비 추가하기</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/character')}
          >
            <View style={styles.quickIcon}>
              <Smile size={20} color={colors.text} strokeWidth={2.6} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>캐릭터</Text>
              <Text style={styles.quickDescription}>
                Lv.{user?.current_level ?? '-'} · {user?.current_points ?? 0}P
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 챌린지</Text>
          <Text style={styles.sectionCount}>{completedCount}/{challenges.length}</Text>
        </View>

        <GlassCard style={styles.challengeCard}>
          <View style={styles.challengeRow}>
            <View style={styles.challengeIcon}>
              <ClipboardCheck size={22} color={colors.text} strokeWidth={2.5} />
            </View>
            <View style={styles.challengeCopy}>
              <Text style={styles.challengeLabel}>
                {challenges.length > 0 ? `${challenges.length}개의 챌린지가 있어요` : '오늘의 챌린지'}
              </Text>
              <Text style={styles.challengeText} numberOfLines={2}>
                {nextChallenge?.challenge_text ?? '소비 기록이 쌓이면 맞춤 챌린지를 준비해요.'}
              </Text>
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/challenge')}>
            <Text style={styles.primaryButtonText}>챌린지 확인</Text>
            <ArrowRight size={17} color={colors.text} strokeWidth={2.6} />
          </Pressable>
        </GlassCard>

        {summary.transaction_count === 0 ? (
          <View style={styles.notice}>
            <ReceiptText size={18} color={colors.subText} strokeWidth={2.3} />
            <Text style={styles.noticeText}>
              이번 달 지출 기록이 아직 없어요. 소비를 기록하면 리포트와 개인화 챌린지가 채워집니다.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20,
    paddingTop: 24, paddingBottom: 112,
  },
  mascotMessageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  homeMascot: { width: 132, height: 92, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  fixedMascotMotion: { width: '100%', height: '100%' },
  speechBubble: {
    flex: 1, minHeight: 116, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    backgroundColor: colors.surface, padding: 15, justifyContent: 'center', position: 'relative',
  },
  speechTail: {
    position: 'absolute', left: -7, top: 46, width: 14, height: 14,
    backgroundColor: colors.surface, borderLeftWidth: 1, borderBottomWidth: 1,
    borderColor: colors.border, transform: [{ rotate: '45deg' }],
  },
  speechLabel: { fontFamily: typography.fontFamily, fontSize: 10.5, fontWeight: '900', color: colors.butterDeep, marginBottom: 5 },
  speechText: { fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 20, fontWeight: '800', color: colors.text },
  speechLink: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  speechLinkText: { fontFamily: typography.fontFamily, fontSize: 11.5, fontWeight: '900', color: colors.text },
  heroCard: { padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  eyebrow: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '800', color: colors.subText, marginBottom: 5 },
  heroValue: { fontFamily: typography.fontFamily, fontSize: 31, fontWeight: '900', letterSpacing: -0.8, color: colors.text },
  reportIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.butterPale, alignItems: 'center', justifyContent: 'center' },
  heroDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 17 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  miniLabel: { fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '700', color: colors.mutedText, marginBottom: 3 },
  miniValue: { fontFamily: typography.fontFamily, fontSize: 17, fontWeight: '900', color: colors.text },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 },
  linkText: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900', color: colors.text },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickButton: { flex: 1, minHeight: 82, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.68 },
  quickIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.butterPale, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1 },
  quickTitle: { fontFamily: typography.fontFamily, fontSize: 14, fontWeight: '900', color: colors.text, marginBottom: 3 },
  quickDescription: { fontFamily: typography.fontFamily, fontSize: 11.5, lineHeight: 16, color: colors.subText },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { fontFamily: typography.fontFamily, fontSize: 19, fontWeight: '900', color: colors.text },
  sectionCount: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900', color: colors.butterDeep },
  challengeCard: { marginBottom: 12 },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  challengeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  challengeCopy: { flex: 1 },
  challengeLabel: { fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '800', color: colors.subText, marginBottom: 5 },
  challengeText: { fontFamily: typography.fontFamily, fontSize: 16, lineHeight: 23, fontWeight: '900', color: colors.text },
  primaryButton: { marginTop: 16, height: 48, borderRadius: 15, backgroundColor: colors.butterStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryButtonText: { fontFamily: typography.fontFamily, fontSize: 14, fontWeight: '900', color: colors.text },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 4, paddingVertical: 7 },
  noticeText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 12.5, lineHeight: 19, color: colors.subText },
});
