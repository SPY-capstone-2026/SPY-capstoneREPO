/**
 * 데이터가 전혀 없을 때 화면 전체에 보여주는 안내 UI (아이콘 + 제목 + 설명 + 액션 버튼).
 * 카드 안에 넣어야 할 때는 EmptyStateCard를 쓴다.
 */

import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon, PencilLine } from 'lucide-react-native';

import { AnimatedButton } from '@/components/AnimatedButton';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  Icon?: LucideIcon;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  Icon = PencilLine,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBubble}>
        <Icon size={25} color={colors.butterBrown} strokeWidth={2.8} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {actionLabel && onAction ? (
        <AnimatedButton
          title={actionLabel}
          onPress={onAction}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBubble: {
    width: 62,
    height: 62,
    borderRadius: 24,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 7,
  },
  description: {
    maxWidth: 260,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
});