import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { getCurrentUser } from '@/services/authService';
import { apiRequest } from '@/services/apiClient';

type ChallengeEntry = {
  challenge_id: number;
  challenge_text: string;
  status: string;
  xp_reward: number;
};
type Settlement = {
  date: string;
  total: number;
  success: number;
  failed: number;
  unattempted: number;
  earned_xp: number;
  earned_points: number;
  unlocked_items: string[];
  level_ups: { old_level: number; new_level: number }[];
  challenges: ChallengeEntry[];
};
type SettlementApiResponse = { status: string; data: Settlement[] };

const memoryAcknowledged = new Set<string>();

function storageKey(userId: string, date: string) {
  // Expo SecureStore accepts letters, digits, periods, underscores and hyphens only.
  return `moni.settlement.${userId.replace(/[^a-zA-Z0-9._-]/g, '_')}.${date}`;
}

async function isAcknowledged(key: string): Promise<boolean> {
  if (memoryAcknowledged.has(key)) return true;
  try {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) === '1';
    }
    return (await SecureStore.getItemAsync(key)) === '1';
  } catch {
    return false;
  }
}

async function acknowledge(key: string): Promise<void> {
  memoryAcknowledged.add(key);
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, '1');
    } else {
      await SecureStore.setItemAsync(key, '1');
    }
  } catch {
    // The popup is still dismissible when persistent storage is unavailable.
  }
}

/** Mounted once inside the authenticated tab layout, not on each tab. */
export function ChallengeSettlementPopup() {
  const [queue, setQueue] = useState<Settlement[]>([]);
  const [userId, setUserId] = useState('');
  const mounted = useRef(true);
  const loading = useRef(false);
  const showing = queue.length > 0 ? queue[0] : null;

  const loadSummaries = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const user = await getCurrentUser();
      const response = await apiRequest<SettlementApiResponse>({
        path: '/challenges/settlements?days=14',
        method: 'GET',
        auth: true,
      });
      if (!mounted.current || response.status !== 'success' || !Array.isArray(response.data)) return;
      const unseen: Settlement[] = [];
      // Most recent results first, then older missed days.
      for (const item of response.data) {
        if (!item.total || await isAcknowledged(storageKey(user.user_id, item.date))) continue;
        unseen.push(item);
      }
      if (mounted.current) {
        setUserId(user.user_id);
        setQueue((existing) => existing.length ? existing : unseen);
      }
    } catch {
      // API may not be deployed yet. Do not show misleading synthetic results.
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadSummaries();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadSummaries();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [loadSummaries]);

  const closeCurrent = async () => {
    if (!showing || !userId) return;
    await acknowledge(storageKey(userId, showing.date));
    setQueue((existing) => existing.slice(1));
  };

  return (
    <Modal visible={Boolean(showing)} animationType="fade" transparent onRequestClose={() => void closeCurrent()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>챌린지 정산 결과</Text>
          <Text style={styles.subtitle}>
            {showing?.date ?? ''} · 총 {showing?.total ?? 0}개 중 {showing?.success ?? 0}개 달성
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statNumber}>{showing?.success ?? 0}</Text><Text style={styles.statLabel}>달성</Text></View>
            <View style={styles.stat}><Text style={styles.statNumber}>{showing?.failed ?? 0}</Text><Text style={styles.statLabel}>실패</Text></View>
            <View style={styles.stat}><Text style={styles.statNumber}>{showing?.unattempted ?? 0}</Text><Text style={styles.statLabel}>미완료</Text></View>
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
            <Text style={styles.heading}>달성한 챌린지</Text>
            {showing?.challenges.filter((c) => c.status === 'SUCCESS').map((c) => (
              <Text key={c.challenge_id} style={styles.item}>✓ {c.challenge_text} (+{c.xp_reward} XP)</Text>
            ))}
            {!showing?.success && <Text style={styles.empty}>달성한 챌린지가 없습니다.</Text>}
            <Text style={styles.heading}>실패한 챌린지</Text>
            {showing?.challenges.filter((c) => c.status === 'FAILED').map((c) => (
              <Text key={c.challenge_id} style={styles.item}>× {c.challenge_text}</Text>
            ))}
            {!showing?.failed && <Text style={styles.empty}>실패한 챌린지가 없습니다.</Text>}
            {(showing?.unattempted ?? 0) > 0 && <>
              <Text style={styles.heading}>완료 표시하지 않은 챌린지</Text>
              {showing?.challenges.filter((c) => c.status === 'PENDING').map((c) => (
                <Text key={c.challenge_id} style={styles.item}>– {c.challenge_text}</Text>
              ))}
            </>}
            <Text style={styles.heading}>획득한 보상</Text>
            <Text style={styles.reward}>{showing?.earned_xp ?? 0} XP · {showing?.earned_points ?? 0} P</Text>
            {(showing?.unlocked_items?.length ?? 0) > 0 && (
              <Text style={styles.item}>새 아이템: {showing?.unlocked_items.join(', ')}</Text>
            )}
            {showing?.level_ups.map((level, i) => (
              <Text key={`${level.new_level}-${i}`} style={styles.item}>레벨업: Lv.{level.old_level} → Lv.{level.new_level}</Text>
            ))}
          </ScrollView>
          <Pressable style={styles.button} onPress={() => void closeCurrent()} accessibilityRole="button">
            <Text style={styles.buttonText}>{queue.length > 1 ? `확인 · 다음 정산 ${queue.length - 1}건` : '확인'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(25,22,16,0.5)', padding: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, maxHeight: '85%', width: '100%', maxWidth: 540, alignSelf: 'center' },
  title: { fontFamily: typography.fontFamily, fontSize: 21, fontWeight: '900', color: colors.text },
  subtitle: { fontFamily: typography.fontFamily, fontSize: 13, marginTop: 6, color: colors.subText },
  stats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 12, backgroundColor: colors.butterPale },
  statNumber: { fontSize: 21, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 11, marginTop: 2, color: colors.subText },
  scroll: { marginTop: 10, marginBottom: 14 },
  heading: { fontFamily: typography.fontFamily, marginTop: 14, marginBottom: 6, fontSize: 14, fontWeight: '900', color: colors.text },
  item: { fontFamily: typography.fontFamily, marginTop: 5, fontSize: 12, lineHeight: 20, color: colors.text },
  empty: { fontSize: 12, color: colors.subText },
  reward: { fontFamily: typography.fontFamily, fontSize: 17, fontWeight: '900', color: colors.butterDeep },
  button: { backgroundColor: colors.butterStrong, paddingVertical: 14, borderRadius: 13, alignItems: 'center' },
  buttonText: { fontFamily: typography.fontFamily, color: colors.text, fontWeight: '900' },
});
