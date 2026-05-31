import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient
        colors={[
          'rgba(255, 248, 216, 0.64)',
          'rgba(255, 255, 255, 0.46)',
          'rgba(255, 244, 199, 0.42)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.softLight} />

        <View style={styles.topRow}>
          <View style={styles.labelRow}>
            <Icon size={15} color={colors.butterBrown} strokeWidth={2.8} />
            <Text style={styles.label}>{label}</Text>
          </View>

          {rightSlot ? <View>{rightSlot}</View> : null}
        </View>

        <Text style={styles.title}>{title}</Text>

        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 22,
    minHeight: 144,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  softLight: {
    position: 'absolute',
    top: 10,
    left: 18,
    width: 92,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
    letterSpacing: 0.8,
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