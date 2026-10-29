import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useMoniTheme } from '@/contexts/MoniThemeContext';

type Props = Omit<ViewProps, 'children' | 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 이전 홈/리포트 코드와의 호환성 유지. butter는 이제 '현재 스킨 강조'를 뜻합니다. */
  tone?: string;
  /** 이전 화면에서 사용하는 호환 속성. 움직임은 사용하지 않습니다. */
  delay?: number;
};

export function GlassCard({ children, style, tone = 'default', delay: _delay, ...props }: Props) {
  const { theme } = useMoniTheme();
  const backgroundColor = tone === 'white' ? '#FFFFFF'
    : tone === 'butter' || tone === 'accent' ? theme.soft
    : tone === 'soft' ? theme.subtle
    : theme.surface;

  return <View
    {...props}
    style={[
      { borderRadius: 20, padding: 18 },
      style,
      // 화면별 과거 하드코딩 배경색보다 현재 장착 스킨 색을 우선합니다.
      { backgroundColor, borderWidth: 0, borderColor: 'transparent' },
    ]}
  >{children}</View>;
}
