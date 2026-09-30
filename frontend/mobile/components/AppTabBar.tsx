import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3,
  ClipboardCheck,
  Home,
  ReceiptText,
  Smile,
  UserRound,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type TabMeta = {
  label: string;
  Icon: LucideIcon;
};

const TAB_META: Record<string, TabMeta> = {
  home: { label: '홈', Icon: Home },
  challenge: { label: '챌린지', Icon: ClipboardCheck },
  character: { label: '캐릭터', Icon: Smile },
  transactions: { label: '소비', Icon: ReceiptText },
  report: { label: '리포트', Icon: BarChart3 },
  mypage: { label: '마이', Icon: UserRound },
};

// Requested order: Spend and Challenge swapped from phase 1, My page restored as a tab.
const TAB_ORDER = [
  'home',
  'challenge',
  'character',
  'transactions',
  'report',
  'mypage',
];

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = [...state.routes]
    .filter((route) => TAB_META[route.name])
    .sort((a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name));

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 7) }]}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((item) => item.key === route.key);
          const isFocused = routeIndex === state.index;
          const meta = TAB_META[route.name];
          const Icon = meta.Icon;
          const isCharacter = route.name === 'character';
          const descriptor = descriptors[route.key];

          const onPress = async () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              try {
                await Haptics.selectionAsync();
              } catch {
                // Haptics can be unavailable on web.
              }
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
              testID={descriptor.options.tabBarButtonTestID}
              onPress={onPress}
              style={styles.tab}
            >
              <View
                style={[
                  styles.iconBox,
                  isFocused && styles.iconBoxActive,
                  isCharacter && styles.characterIconBox,
                  isCharacter && isFocused && styles.characterIconBoxActive,
                ]}
              >
                <Icon
                  size={isCharacter ? 22 : 19}
                  strokeWidth={isFocused ? 2.8 : 2.25}
                  color={isFocused ? colors.text : colors.mutedText}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, isFocused && styles.labelActive]}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  bar: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconBox: {
    width: 34,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: colors.butterPale,
  },
  characterIconBox: {
    width: 38,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  characterIconBoxActive: {
    borderColor: colors.butterSoft,
    backgroundColor: colors.butterPale,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.mutedText,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '900',
  },
});
