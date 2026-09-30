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
              {Icon ? <Icon size={15} color={colors.butterDeep} strokeWidth={2.5} /> : null}
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
    marginBottom: 22,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    color: colors.butterDeep,
    letterSpacing: 0.7,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.68,
  },
});
