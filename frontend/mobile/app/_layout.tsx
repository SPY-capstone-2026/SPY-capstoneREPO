import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';

void SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [loaded] = useFonts({Pretendard:require('../assets/fonts/PretendardVariable.ttf')});
  useEffect(() => {if (loaded) void SplashScreen.hideAsync();}, [loaded]);
  if (!loaded) return null;
  return <ToastProvider><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#FFFFFF'}}}>
    <Stack.Screen name="index"/>
    <Stack.Screen name="auth/login"/>
    <Stack.Screen name="auth/signup"/>
    <Stack.Screen name="(tabs)"/>
    <Stack.Screen name="social/[userId]"/>
    <Stack.Screen name="shop"/>
    <Stack.Screen name="inventory"/>
  </Stack></ToastProvider>;
}
