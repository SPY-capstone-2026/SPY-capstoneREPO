import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';

type GlassCardProps = {
  children: ReactNode;
  delay?: number;
  tone?: 'default' | 'soft' | 'butter';
  style?: StyleProp<ViewStyle>;
};

/**
 * Compatibility wrapper for existing screens.
 * The visual style is intentionally no longer glassmorphism:
 * Moni now uses simple white surfaces with subtle borders.
 */
export function GlassCard({
  children,
  tone = 'default',
  style,
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === 'soft' && styles.softCard,
        tone === 'butter' && styles.butterCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  softCard: {
    backgroundColor: colors.popMint,
  },
  butterCard: {
    backgroundColor: colors.popYellow,
    borderColor: colors.border,
  },
});
