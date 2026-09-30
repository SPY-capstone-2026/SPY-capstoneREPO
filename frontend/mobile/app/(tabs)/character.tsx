import { useCallback, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  PackageOpen,
  ShoppingBag,
  Smile,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreenHeader } from '@/components/AppScreenHeader';
import { CharacterRoom } from '@/components/CharacterRoom';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser } from '@/services/authService';
import { getTodayChallengesFromApi } from '@/services/challengeService';
import { getPrimaryBudgetGuide } from '@/services/budgetGuide';
import { isVisibleShopItemName } from '@/services/shopCatalog';
import { getInventoryFromApi } from '@/services/shopService';
import type { ApiChallenge, InventoryItem, MeResponse } from '@/types/api';
import { formatWon } from '@/utils/aiFormat';

const INTERACTION_LINES = [
  'Moni가 눈을 꼭 감았어요.',
  '뽀용! Moni가 기분 좋아 보여요.',
  'Moni가 쫑긋 반응했어요.',
];

export default function CharacterScreen() {
  const { showToast } = useToast();

  const [user, setUser] = useState<MeResponse | null>(null);
  const [challenges, setChallenges] = useState<ApiChallenge[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(0);
  const [interactionLine, setInteractionLine] = useState<string | null>(null);

  const interactionIndexRef = useRef(0);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speakingChallenges = useMemo(() => {
    const pending = challenges.filter(
      (challenge) => challenge.status === 'PENDING'
    );

    return pending.length > 0 ? pending : challenges;
  }, [challenges]);

  const speakingChallenge =
    speakingChallenges[
      speakingIndex % Math.max(speakingChallenges.length, 1)
    ] ?? null;

  const budgetGuide = useMemo(
    () => getPrimaryBudgetGuide(challenges),
    [challenges]
  );

  const speechText = budgetGuide
    ? `${budgetGuide.categoryName} 예산을 이미 ${formatWon(budgetGuide.overAmount)} 넘었어요. 오늘은 챌린지보다 이번 달 예산을 먼저 다시 확인해 주세요.`
    : speakingChallenge?.challenge_text ??
      '오늘의 소비 기록이 쌓이면 내가 챌린지를 알려줄게.';

  const equippedCount = useMemo(
    () => inventory.filter((item) => item.is_equipped).length,
    [inventory]
  );

  const loadCharacterHome = useCallback(async () => {
    try {
      setIsLoading(true);

      const [userResult, challengeResult, inventoryResult] =
        await Promise.allSettled([
          getCurrentUser(),
          getTodayChallengesFromApi(),
          getInventoryFromApi(),
        ]);

      if (userResult.status === 'fulfilled') {
        setUser(userResult.value);
      }

      if (challengeResult.status === 'fulfilled') {
        setChallenges(challengeResult.value);
      }

      if (inventoryResult.status === 'fulfilled') {
        setInventory(
          inventoryResult.value.filter((entry) =>
            isVisibleShopItemName(entry.item?.name)
          )
        );
      }

      if (
        userResult.status === 'rejected' ||
        challengeResult.status === 'rejected' ||
        inventoryResult.status === 'rejected'
      ) {
        showToast('캐릭터 정보를 일부 불러오지 못했어요.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadCharacterHome();

      return () => {
        if (interactionTimerRef.current) {
          clearTimeout(interactionTimerRef.current);
        }
      };
    }, [loadCharacterHome])
  );

  const showNextChallenge = () => {
    if (speakingChallenges.length <= 1) return;
    setSpeakingIndex((value) => (value + 1) % speakingChallenges.length);
  };

  const handleMascotPress = () => {
    const line =
      INTERACTION_LINES[
        interactionIndexRef.current % INTERACTION_LINES.length
      ];

    interactionIndexRef.current += 1;
    setInteractionLine(line);

    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
    }

    interactionTimerRef.current = setTimeout(() => {
      setInteractionLine(null);
    }, 1200);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="CHARACTER"
          title="Moni의 방"
          description={
            isLoading
              ? '캐릭터 정보를 불러오고 있어요.'
              : '돌아다니는 Moni를 누르고, 아이템으로 방을 꾸며보세요.'
          }
          Icon={Smile}
        />

        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>LEVEL</Text>
            <Text style={styles.statusValue}>
              Lv.{user?.current_level ?? '-'}
            </Text>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>POINT</Text>
            <Text style={styles.statusValue}>
              {user?.current_points ?? 0}P
            </Text>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>ITEM</Text>
            <Text style={styles.statusValue}>{inventory.length}개</Text>
          </View>
        </View>

        <View style={styles.roomWrap}>
          <CharacterRoom
            inventory={inventory}
            onMascotPress={handleMascotPress}
          />

          <View
            style={[
              styles.speechBubble,
              budgetGuide && styles.speechBubbleWarning,
            ]}
          >
            <View
              style={[
                styles.speechTail,
                budgetGuide && styles.speechTailWarning,
              ]}
            />

            <View style={styles.speechTopRow}>
              <View style={styles.speechLabelRow}>
                {budgetGuide ? (
                  <AlertTriangle
                    size={14}
                    color={colors.warningText}
                    strokeWidth={2.5}
                  />
                ) : null}
                <Text
                  style={[
                    styles.speechLabel,
                    budgetGuide && styles.speechLabelWarning,
                  ]}
                >
                  {budgetGuide
                    ? '예산을 먼저 확인해요'
                    : '오늘 Moni의 챌린지'}
                </Text>
              </View>

              {!budgetGuide && speakingChallenges.length > 0 ? (
                <Text style={styles.speechCount}>
                  {(speakingIndex % speakingChallenges.length) + 1}/
                  {speakingChallenges.length}
                </Text>
              ) : null}
            </View>

            <Text style={styles.speechText} numberOfLines={4}>
              {speechText}
            </Text>

            <View style={styles.speechActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.challengeLink,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push('/(tabs)/challenge')}
              >
                <Text style={styles.challengeLinkText}>
                  {budgetGuide ? '예산 안내 확인' : '챌린지 보기'}
                </Text>
                <ArrowRight size={15} color={colors.text} strokeWidth={2.5} />
              </Pressable>

              {!budgetGuide && speakingChallenges.length > 1 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.nextSpeechButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={showNextChallenge}
                >
                  <Text style={styles.nextSpeechText}>다음</Text>
                  <ChevronRight
                    size={14}
                    color={colors.subText}
                    strokeWidth={2.5}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {interactionLine ? (
            <View pointerEvents="none" style={styles.reactionBubble}>
              <Text style={styles.reactionText}>{interactionLine}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.secondaryActions}>
          <Pressable
            onPress={() => router.push('/shop')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.secondaryIcon}>
              <ShoppingBag
                size={19}
                color={colors.text}
                strokeWidth={2.5}
              />
            </View>

            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryTitle}>상점</Text>
              <Text style={styles.secondaryDescription}>
                포인트로 캐릭터와 방 아이템 구매
              </Text>
            </View>

            <ChevronRight
              size={17}
              color={colors.mutedText}
              strokeWidth={2.4}
            />
          </Pressable>

          <Pressable
            onPress={() => router.push('/inventory')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.secondaryIcon}>
              <PackageOpen
                size={19}
                color={colors.text}
                strokeWidth={2.5}
              />
            </View>

            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryTitle}>보유 아이템</Text>
              <Text style={styles.secondaryDescription}>
                {inventory.length}개 보유 · {equippedCount}개 적용 중
              </Text>
            </View>

            <ChevronRight
              size={17}
              color={colors.mutedText}
              strokeWidth={2.4}
            />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
  },
  statusBar: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSoft,
  },
  statusLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.mutedText,
    marginBottom: 4,
  },
  statusValue: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  roomWrap: {
    position: 'relative',
  },
  reactionBubble: {
    position: 'absolute',
    right: 16,
    bottom: 118,
    zIndex: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reactionText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  speechBubble: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    zIndex: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(225, 221, 210, 0.96)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  speechBubbleWarning: {
    backgroundColor: 'rgba(255,247,232,0.97)',
    borderColor: '#F0D4A5',
  },
  speechTail: {
    position: 'absolute',
    left: '52%',
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(225, 221, 210, 0.96)',
    transform: [{ rotate: '45deg' }],
  },
  speechTailWarning: {
    backgroundColor: 'rgba(255,247,232,0.97)',
    borderColor: '#F0D4A5',
  },
  speechTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 5,
  },
  speechLabelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  speechLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  speechLabelWarning: {
    color: colors.warningText,
  },
  speechCount: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.mutedText,
  },
  speechText: {
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '900',
    color: colors.text,
  },
  speechActions: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  challengeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  challengeLinkText: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '900',
    color: colors.text,
  },
  nextSpeechButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
    paddingLeft: 8,
  },
  nextSpeechText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    color: colors.subText,
  },
  secondaryActions: {
    marginTop: 10,
    gap: 8,
  },
  secondaryButton: {
    minHeight: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 11,
  },
  secondaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCopy: {
    flex: 1,
  },
  secondaryTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.text,
  },
  secondaryDescription: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    color: colors.subText,
  },
  pressed: {
    opacity: 0.72,
  },
});
