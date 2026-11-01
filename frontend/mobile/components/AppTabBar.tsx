import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BarChart3, ClipboardCheck, Home, ReceiptText, UserRound, UsersRound } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '@/constants/typography';
import { useMoniTheme } from '@/contexts/MoniThemeContext';

const TABS = [
  { name: 'home', label: '홈', Icon: Home },
  { name: 'challenge', label: '챌린지', Icon: ClipboardCheck },
  { name: 'report', label: '리포트', Icon: BarChart3 },
  { name: 'transactions', label: '소비', Icon: ReceiptText },
  { name: 'social', label: '소셜', Icon: UsersRound },
  { name: 'mypage', label: '마이', Icon: UserRound },
] as const;

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme, refreshTheme } = useMoniTheme();

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.bar, { backgroundColor: theme.surface }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {TABS.map(({ name, label, Icon }) => {
            const route = state.routes.find(item => item.name === name);
            if (!route) return null;
            const active = state.routes[state.index]?.key === route.key;
            return (
              <Pressable key={name} accessibilityRole="tab"
                accessibilityState={{ selected: active }} accessibilityLabel={label}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
                  void refreshTheme();
                }}
                style={[styles.tab, active && { backgroundColor: theme.accent }]}>
                <Icon size={active ? 19 : 20} color={active ? '#25282B' : theme.deep} strokeWidth={2.2} />
                {active && <Text style={styles.activeLabel}>{label}</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 620, borderRadius: 25, padding: 7, shadowColor: '#000', shadowOpacity: 0.045, shadowRadius: 10, elevation: 2 },
  scroll: { minHeight: 48, flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  tab: { minWidth: 48, minHeight: 44, paddingHorizontal: 10, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  activeLabel: { color: '#25282B', fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '800' },
});
