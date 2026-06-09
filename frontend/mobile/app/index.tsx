import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { WalletCards } from 'lucide-react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { getCurrentUser } from '@/services/authService';
import {
  deleteAccessToken,
  getAccessToken,
} from '@/services/tokenStorage';

export default function IndexScreen() {
  const [message, setMessage] = useState('로그인 상태를 확인하고 있어요.');

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const token = await getAccessToken();

        if (!token) {
          if (isMounted) {
            setMessage('로그인이 필요합니다.');
            router.replace('/auth/login');
          }
          return;
        }

        await getCurrentUser();

        if (isMounted) {
          setMessage('환영합니다.');
          router.replace('/(tabs)/home');
        }
      } catch {
        await deleteAccessToken();

        if (isMounted) {
          setMessage('다시 로그인해 주세요.');
          router.replace('/auth/login');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <LinearGradient
      colors={['#FFF4C7', '#FFFBF0', '#FFFFFF']}
      style={styles.gradient}
    >
      <View style={styles.backgroundOrbLarge} />
      <View style={styles.backgroundOrbSmall} />

      <View style={styles.container}>
        <View style={styles.logoBubble}>
          <WalletCards size={40} color={colors.text} strokeWidth={2.8} />
        </View>

        <Text style={styles.title}>Moni</Text>
        <Text style={styles.description}>{message}</Text>

        <ActivityIndicator
          size="small"
          color={colors.butterBrown}
          style={styles.loader}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  backgroundOrbLarge: {
    display: 'none',
  },
  backgroundOrbSmall: {
    display: 'none',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBubble: {
    width: 92,
    height: 92,
    borderRadius: 34,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 7,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 34,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  description: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.subText,
    textAlign: 'center',
  },
  loader: {
    marginTop: 18,
  },
});