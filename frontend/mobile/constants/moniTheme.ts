import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { DEFAULT_MONI_THEME, useMoniTheme } from '@/contexts/MoniThemeContext';

/** 홈 배경은 항상 흰색. 장착 스킨 전에는 버터색만 사용합니다. */
export const palette = {
  background: '#FFFFFF',
  surface: DEFAULT_MONI_THEME.surface,
  soft: DEFAULT_MONI_THEME.soft,
  butter: DEFAULT_MONI_THEME.accent,
  ink: '#25282B',
  muted: '#62666B',
  border: 'transparent',
  danger: DEFAULT_MONI_THEME.deep,
};

/** 기존 화면의 정적 기본 스타일. 동적 면 색은 useMoniUi()를 사용하세요. */
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 132 },
  title: { fontSize: 27, fontWeight: '800', color: palette.ink, lineHeight: 36, marginBottom: 7 },
  subtitle: { fontSize: 13, color: palette.muted, lineHeight: 19, marginBottom: 16 },
  card: { borderRadius: 22, backgroundColor: palette.surface, borderWidth: 0, borderColor: 'transparent', padding: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  heading: { fontSize: 17, fontWeight: '800', color: palette.ink, lineHeight: 24, marginBottom: 9 },
  text: { fontSize: 14, lineHeight: 21, color: palette.ink },
  muted: { fontSize: 12, lineHeight: 19, color: palette.muted },
  input: { backgroundColor: '#FFFFFF', borderWidth: 0, borderRadius: 12, paddingHorizontal: 13, minHeight: 46, color: palette.ink, fontSize: 14, marginBottom: 12 },
  button: { backgroundColor: palette.butter, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 13 },
  secondary: { backgroundColor: palette.soft, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 13 },
  buttonText: { fontSize: 13, fontWeight: '800', color: palette.ink },
  dangerText: { fontSize: 13, fontWeight: '700', color: palette.danger },
  divider: { borderTopWidth: 1, borderTopColor: palette.soft, marginVertical: 12 },
});

/** 모든 새 화면의 카드·버튼·칩은 활성 스킨 하나를 기준으로 같이 갱신합니다. */
export function useMoniUi() {
  const { theme } = useMoniTheme();
  return useMemo(() => ({
    ...ui,
    card: [ui.card, { backgroundColor: theme.surface, borderWidth: 0, borderColor: 'transparent' }],
    input: [ui.input, { backgroundColor: theme.subtle }],
    button: [ui.button, { backgroundColor: theme.accent }],
    secondary: [ui.secondary, { backgroundColor: theme.soft }],
    dangerText: [ui.dangerText, { color: theme.deep }],
    divider: [ui.divider, { borderTopColor: theme.soft }],
  }), [theme]);
}
