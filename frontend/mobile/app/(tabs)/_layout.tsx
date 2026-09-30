import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/AppTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="challenge" options={{ title: '챌린지' }} />
      <Tabs.Screen name="character" options={{ title: '캐릭터' }} />
      <Tabs.Screen name="transactions" options={{ title: '소비' }} />
      <Tabs.Screen name="report" options={{ title: '리포트' }} />
      <Tabs.Screen name="mypage" options={{ title: '마이' }} />
    </Tabs>
  );
}
