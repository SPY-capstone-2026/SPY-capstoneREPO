import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CharacterRoom } from '@/components/CharacterRoom';
import { colors } from '@/constants/colors';
import { getCurrentUser } from '@/services/authService';
import { getInventoryFromApi } from '@/services/shopService';
import type { InventoryItem } from '@/types/api';

/** 소셜·보유 아이템 화면에서 공통으로 사용하는 가구 편집 진입 화면. */
export default function RoomEditorScreen() {
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([getCurrentUser(), getInventoryFromApi()])
      .then(([, items]) => {
        if (active) setInventory(items);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorText(error instanceof Error ? error.message : '방 정보를 불러오지 못했어요.');
      });

    return () => {
      active = false;
    };
  }, []);

  const leaveEditor = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/social');
  };

  return (
    <View style={styles.screen}>
      {inventory ? (
        <CharacterRoom
          inventory={inventory}
          startInEditMode
          onEditorClose={leaveEditor}
        />
      ) : (
        <View style={styles.center}>
          {errorText ? (
            <>
              <Text style={styles.message}>{errorText}</Text>
              <Pressable accessibilityRole="button" onPress={leaveEditor} style={styles.backButton}>
                <Text style={styles.backText}>돌아가기</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.message}>가구 배치 편집 화면을 준비하고 있어요.</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  message: { color: colors.text, fontSize: 14, textAlign: 'center' },
  backButton: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.butterPale },
  backText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
