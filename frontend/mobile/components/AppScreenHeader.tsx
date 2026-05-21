import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LucideIcon, Sparkles } from 'lucide-react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type AppScreenHeaderProps = {
  label: string;
  title: string;
  description?: string;
  Icon?: LucideIcon;
  rightSlot?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppScreenHeader({
  label,
  title,
  description,
  Icon = Sparkles,
  rightSlot,
  style,
}: AppScreenHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={30} tint="light" style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.labelPill}>
            <Icon size={14} color={colors.butterBrown} strokeWidth={2.8} />
            <Text style={styles.label}>{label}</Text>
          </View>

          {rightSlot ? <View>{rightSlot}</View> : null}
        </View>

        <Text style={styles.title}>{title}</Text>

        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 30,
    padding: 20,
    minHeight: 148,
    backgroundColor: 'rgba(255, 248, 216, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  labelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
    letterSpacing: -0.1,
  },
  title: {
    maxWidth: 320,
    fontFamily: typography.fontFamily,
    fontSize: 29,
    lineHeight: 37,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.9,
    marginBottom: 9,
  },
  description: {
    maxWidth: 330,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: colors.subText,
  },
});