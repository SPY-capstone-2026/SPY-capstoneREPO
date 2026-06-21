/**
 * 화면 상단 타이틀 영역 (라벨 + 제목 + 설명 + 아이콘).
 * 홈/소비/챌린지/리포트 등 각 탭 화면 맨 위에서 공통으로 쓰인다.
 */

import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type AppScreenHeaderProps = {
  label: string;
  title: string;
  description?: string;
  Icon?: LucideIcon;
};

export function AppScreenHeader({
  label,
  title,
  description,
  Icon,
}: AppScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {Icon ? (
          <View style={styles.iconBox}>
            <Icon size={17} color={colors.butterBrown} strokeWidth={2.6} />
          </View>
        ) : null}

        <Text style={styles.label}>{label}</Text>
      </View>

      <Text style={styles.title}>{title}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
    paddingTop: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.7,
  },
  description: {
    marginTop: 8,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
});