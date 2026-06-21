/**
 * 블러 처리된 반투명 상단 헤더.
 * routeName(home/transactions/challenge/report/profile 등)에 따라
 * getHeaderMeta()가 아이콘과 안내 문구를 자동으로 골라준다.
 */

import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChartNoAxesCombined,
  CreditCard,
  Home,
  LucideIcon,
  PiggyBank,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type GlassTopHeaderProps = {
  routeName: string;
  title: string;
};

function getHeaderMeta(routeName: string): {
  eyebrow: string;
  description: string;
  Icon: LucideIcon;
} {
  if (routeName === 'home') {
    return {
      eyebrow: 'TODAY',
      description: '오늘의 소비 흐름',
      Icon: Home,
    };
  }

  if (routeName === 'challenge') {
    return {
      eyebrow: 'MISSION',
      description: '오늘의 목표',
      Icon: Target,
    };
  }

  if (routeName === 'report') {
    return {
      eyebrow: 'INSIGHT',
      description: 'AI 리포트',
      Icon: ChartNoAxesCombined,
    };
  }

  if (routeName === 'transactions') {
    return {
      eyebrow: 'SPENDING',
      description: '지출 기록',
      Icon: CreditCard,
    };
  }

  if (routeName === 'budget') {
    return {
      eyebrow: 'BUDGET',
      description: '예산 설정',
      Icon: PiggyBank,
    };
  }

  if (routeName === 'mypage') {
    return {
      eyebrow: 'PROFILE',
      description: '내 설정',
      Icon: UserRound,
    };
  }

  return {
    eyebrow: 'MONI',
    description: 'AI 소비 코칭',
    Icon: Sparkles,
  };
}

export function GlassTopHeader({ routeName, title }: GlassTopHeaderProps) {
  const insets = useSafeAreaInsets();
  const { eyebrow, description, Icon } = getHeaderMeta(routeName);

  return (
    <View
      style={[
        styles.outer,
        {
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <BlurView intensity={76} tint="light" style={styles.blurCard}>
        <View style={styles.headerLight} />

        <View style={styles.leftGroup}>
          <View style={styles.iconBubble}>
            <View style={styles.iconBubbleLight} />
            <Icon size={20} color={colors.text} strokeWidth={2.7} />
          </View>

          <View>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>

        <View style={styles.rightPill}>
          <Sparkles size={13} color={colors.butterDeep} strokeWidth={2.8} />
          <Text style={styles.rightPillText}>{description}</Text>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFBF0',
  },
  blurCard: {
    height: 68,
    borderRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.80)',
    backgroundColor: 'rgba(255, 255, 255, 0.54)',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    shadowColor: '#B88B00',
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  headerLight: {
    position: 'absolute',
    top: -18,
    left: 30,
    width: 160,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: 'rgba(242, 201, 76, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',

    shadowColor: '#D9A900',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  iconBubbleLight: {
    position: 'absolute',
    top: 5,
    left: 9,
    width: 18,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  eyebrow: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.butterDeep,
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  rightPill: {
    maxWidth: 124,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rightPillText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    color: colors.subText,
  },
});