import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BarChart3, ClipboardCheck, Home, ReceiptText, WalletCards, UserRound, UsersRound } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography } from '@/constants/typography';

const TABS = [
  { name: 'home', label: '홈', Icon: Home },
  { name: 'challenge', label: '챌린지', Icon: ClipboardCheck },
  { name: 'report', label: '리포트', Icon: BarChart3 },
  { name: 'transactions', label: '소비', Icon: ReceiptText },
  { name: 'budget', label: '예산', Icon: WalletCards },
  { name: 'social', label: '소셜', Icon: UsersRound },
  { name: 'mypage', label: '마이', Icon: UserRound },
] as const;

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        <ScrollView horizontal contentContainerStyle={styles.scroll} showsHorizontalScrollIndicator={false}>
          {TABS.map(({ name, label, Icon }) => {
            const route = state.routes.find((item) => item.name === name);
            if (!route) return null;
            const index = state.routes.findIndex((item) => item.key === route.key);
            const focused = state.index === index;
            return (
              <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: focused }}
                accessibilityLabel={label} onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
                }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={[styles.tab, focused && styles.activeTab]}>
                <Icon size={focused ? 18 : 21} color={focused ? '#211B16' : '#A99B8B'} strokeWidth={2.3} />
                {focused && <Text style={styles.activeLabel} numberOfLines={1}>{label}</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 600, borderRadius: 30, backgroundColor: '#211B16', padding: 8, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, elevation: 8 },
  scroll: { width: '100%', minHeight: 52, alignItems: 'center', justifyContent: 'space-around' },
  tab: { minWidth: 43, minHeight: 44, paddingHorizontal: 8, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  activeTab: { minWidth: 80, backgroundColor: '#FFFDF8' },
  activeLabel: { color: '#211B16', fontFamily: typography.fontFamily, fontSize: 11, fontWeight: '800' },
});
