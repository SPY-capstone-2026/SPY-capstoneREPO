import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type AppScreenHeaderProps = {
  label?: string;
  title: string;
  description?: string;
  Icon?: LucideIcon;
  ActionIcon?: LucideIcon;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function AppScreenHeader({
  label,
  title,
  description,
  Icon,
  ActionIcon,
  actionLabel,
  onActionPress,
}: AppScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          {label || Icon ? (
            <View style={styles.labelRow}>
              {Icon ? <Icon size={14} color={colors.backgroundWhite} strokeWidth={2.6} /> : null}
              {label ? <Text style={styles.label}>{label}</Text> : null}
            </View>
          ) : null}

          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>

        {ActionIcon && onActionPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onActionPress}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <ActionIcon size={20} color={colors.text} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  copy: {
    flex: 1,
  },
  labelRow: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.backgroundWhite,
    letterSpacing: 0.9,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.25,
    color: colors.text,
  },
  description: {
    marginTop: 7,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.popYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.68,
  },
});
