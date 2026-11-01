import { useCallback } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { AppTabBar } from '@/components/AppTabBar';
import { ChallengeSettlementPopup } from '@/components/ChallengeSettlementPopup';
import { useMoniTheme } from '@/contexts/MoniThemeContext';

export default function TabsLayout() {
  const { refreshTheme } = useMoniTheme();
  useFocusEffect(useCallback(() => { void refreshTheme(); }, [refreshTheme]));
  return <>
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="challenge" options={{ title: '챌린지' }} />
      <Tabs.Screen name="social" options={{ title: '소셜' }} />
      <Tabs.Screen name="character" options={{ title: '캐릭터', href: null }} />
      <Tabs.Screen name="report" options={{ title: '리포트' }} />
      <Tabs.Screen name="transactions" options={{ title: '소비' }} />
      <Tabs.Screen name="budget" options={{ title: '예산', href: null }} />
      <Tabs.Screen name="mypage" options={{ title: '마이' }} />
    </Tabs>
    <ChallengeSettlementPopup />
  </>;
}
