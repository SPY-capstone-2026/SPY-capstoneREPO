import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'expo-router';
import { AppState, Platform } from 'react-native';

import { getInventoryFromApi } from '@/services/shopService';
import type { InventoryItem } from '@/types/api';

/**
 * 단일 색상 규칙
 * - 장착한 CHARACTER 컬러 아이템이 없으면 버터 테마만 사용합니다.
 * - 다른 장착 아이템(가구, 악세서리, 벽지)은 앱 테마를 변경하지 않습니다.
 * - 배경은 항상 흰색이며, 색은 선택한 스킨 계열에서만 가져옵니다.
 */
export type MoniTheme = {
  key: 'butter' | 'green' | 'mint' | 'pink' | 'coral' | 'blue' | 'gold';
  name: string;
  accent: string;   // 주 버튼, 선택된 탭
  soft: string;     // 보조 버튼, 칩, 진행도 트랙
  subtle: string;   // 강조 카드 안쪽
  surface: string;  // 기본 카드
  deep: string;     // 해당 스킨의 진한 색, 라벨·아이콘
  neutral: string;  // 카드 안쪽 중성 영역 (해당 스킨의 매우 연한 색)
};

export const MONI_THEMES: Record<MoniTheme['key'], MoniTheme> = {
  butter: {
    key: 'butter', name: '버터', accent: '#F2CF67', soft: '#FFF0C1',
    subtle: '#FFFBF1', surface: '#FFF7E2', deep: '#785611', neutral: '#FFF9EA',
  },
  green: {
    key: 'green', name: '초록', accent: '#ACD8AB', soft: '#DCEFD9',
    subtle: '#F7FCF5', surface: '#ECF7E9', deep: '#35693B', neutral: '#F1F9EF',
  },
  mint: {
    key: 'mint', name: '민트', accent: '#9ADACC', soft: '#D8F0E9',
    subtle: '#F6FCFA', surface: '#E9F8F3', deep: '#276A5F', neutral: '#EFF9F5',
  },
  pink: {
    key: 'pink', name: '핑크', accent: '#F1B4D0', soft: '#F9DDEB',
    subtle: '#FFF8FB', surface: '#FDECF4', deep: '#96516F', neutral: '#FFF2F7',
  },
  coral: {
    key: 'coral', name: '코랄', accent: '#F1B0A4', soft: '#FADFD8',
    subtle: '#FFFAF8', surface: '#FCEEE9', deep: '#9B5142', neutral: '#FFF2EE',
  },
  blue: {
    key: 'blue', name: '블루', accent: '#B3C9F0', soft: '#DFE9FB',
    subtle: '#F8FAFE', surface: '#EDF2FD', deep: '#405D96', neutral: '#F1F5FD',
  },
  gold: {
    key: 'gold', name: '골드', accent: '#E8C76D', soft: '#F9ECCA',
    subtle: '#FFFCF4', surface: '#FFF5DC', deep: '#785918', neutral: '#FFF9E9',
  },
};

export const DEFAULT_MONI_THEME = MONI_THEMES.butter;

/** 아이템 이름으로 컬러를 구분합니다. 알 수 없는 색상은 반드시 버터로 되돌립니다. */
export function themeForCharacter(name?: string | null): MoniTheme {
  const value = (name ?? '').toLowerCase().trim();
  if (/민트|mint/.test(value)) return MONI_THEMES.mint;
  if (/초록|녹색|그린|green/.test(value)) return MONI_THEMES.green;
  if (/핑크|분홍|pink/.test(value)) return MONI_THEMES.pink;
  if (/코랄|연어|coral/.test(value)) return MONI_THEMES.coral;
  if (/딥블루|블루|파랑|남색|blue|navy/.test(value)) return MONI_THEMES.blue;
  if (/골드|금색|gold/.test(value)) return MONI_THEMES.gold;
  return DEFAULT_MONI_THEME;
}

export function themeForInventory(items: InventoryItem[]): MoniTheme {
  const color = items
    .filter((item) => item.is_equipped && item.item?.category === 'CHARACTER')
    .sort((a, b) => (b.acquired_at ?? '').localeCompare(a.acquired_at ?? ''))[0];
  return themeForCharacter(color?.item?.name);
}

type ThemeContextValue = { theme: MoniTheme; refreshTheme: () => Promise<void> };
const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_MONI_THEME,
  refreshTheme: async () => {},
});

export function MoniThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<MoniTheme>(DEFAULT_MONI_THEME);
  const requestId = useRef(0);

  const refreshTheme = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const inventory = await getInventoryFromApi();
      // 느린 이전 요청이 최신 장착 상태를 덮지 않도록 합니다.
      if (requestId.current === current) setTheme(themeForInventory(inventory));
    } catch {
      // 로그아웃·로그인 전 또는 조회 실패 시 임의의 스킨 색을 유지하지 않습니다.
      if (requestId.current === current) setTheme(DEFAULT_MONI_THEME);
    }
  }, []);

  useEffect(() => {
    if (pathname === '/' || pathname.startsWith('/auth')) {
      requestId.current += 1;
      setTheme(DEFAULT_MONI_THEME);
    } else {
      void refreshTheme();
    }
  }, [pathname, refreshTheme]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' && pathname !== '/' && !pathname.startsWith('/auth')) {
        void refreshTheme();
      }
    });
    return () => subscription.remove();
  }, [pathname, refreshTheme]);

  // 웹: 기존 홈·리포트 등 정적 StyleSheet에서 사용한 색상 토큰도 함께 변경합니다.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const variables = {
      '--moni-accent': theme.accent,
      '--moni-soft': theme.soft,
      '--moni-subtle': theme.subtle,
      '--moni-surface': theme.surface,
      '--moni-deep': theme.deep,
    };
    for (const [key, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, refreshTheme }), [theme, refreshTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useMoniTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
