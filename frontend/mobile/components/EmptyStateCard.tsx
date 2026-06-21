/**
 * EmptyState를 GlassCard 안에 넣은 카드형 버전.
 * 리포트/소비 화면처럼 다른 카드들 사이에 "데이터 없음" 카드를 끼워 넣을 때 쓴다.
 */

import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type EmptyStateCardProps = {
  delay?: number;
  Icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyStateCard({
  delay = 120,
  Icon,
  title,
  description,
}: EmptyStateCardProps) {
  return (
    <GlassCard delay={delay} tone="soft" style={styles.card}>
      <View style={styles.content}>
        <View style={styles.iconBubble}>
          <Icon size={24} color={colors.butterBrown} strokeWidth={2.8} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  content: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 19,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
    textAlign: 'center',
  },
});