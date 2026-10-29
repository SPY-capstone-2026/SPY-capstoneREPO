import { Platform } from 'react-native';

// Expo Web에서는 CSS 변수로 기존 StyleSheet의 색상도 함께 갱신할 수 있습니다.
// 모바일 네이티브에서는 버터 기본색을 유지하며, 테마를 사용하는 새 컴포넌트만 실시간 변경됩니다.
const themed = (token: 'accent' | 'soft' | 'subtle' | 'surface' | 'deep', fallback: string): string =>
  Platform.OS === 'web' ? `var(--moni-${token}, ${fallback})` : fallback;

/**
 * 기존 화면용 색상 토큰.
 * 스킨을 아직 장착하지 않았을 때 혼합된 여러 파스텔색이 나오지 않도록
 * 모든 장식 색상을 버터 계열로 통일합니다.
 * 새 화면과 공통 GlassCard는 MoniThemeContext의 실시간 테마를 사용합니다.
 */
export const colors = {
  background: '#FFFFFF', backgroundWhite: '#FFFFFF',
  surface: themed('surface', '#FFF7E2'), surfaceMuted: themed('soft', '#FFF0C1'), surfaceSoft: themed('subtle', '#FFFBF1'),
  text: '#25282B', subText: '#4E5257', mutedText: '#6A6D71',
  border: 'transparent', borderSoft: 'transparent',
  butterPale: themed('subtle', '#FFF9EA'), butterSoft: themed('soft', '#FFF0C1'), butterStrong: themed('accent', '#F2CF67'),
  butterDeep: themed('deep', '#785611'), butterBrown: themed('deep', '#785611'),
  // 이전 카드들이 번갈아 쓰던 분홍/민트/블루도 기본 상태에서는 버터색으로 표시합니다.
  popLime: themed('soft', '#FFF3D2'), popMint: themed('surface', '#FFF7E2'), popPink: themed('soft', '#FFF0C1'),
  popBlue: themed('subtle', '#FFF9EA'), popPurple: themed('soft', '#FFF3D2'), popOrange: themed('soft', '#FFF0C1'),
  popGreen: themed('surface', '#FFF7E2'), popYellow: themed('soft', '#FFF0C1'), ink: '#25282B',
  successBg: themed('soft', '#FFF3D2'), successText: themed('deep', '#785611'),
  warningBg: themed('soft', '#FFF0C1'), warningText: themed('deep', '#785611'),
  dangerBg: themed('soft', '#FFF0C1'), dangerText: themed('deep', '#785611'),
  infoBg: themed('surface', '#FFF7E2'), infoText: themed('deep', '#785611'), shadow: '#000000',
  glassBorder: 'transparent', glassWhite: themed('surface', '#FFF7E2'),
  glassSoft: themed('subtle', '#FFFBF1'), glassYellow: themed('subtle', '#FFF9EA'),
  gray50: '#FFFFFF', gray100: themed('subtle', '#FFFBF1'), gray200: themed('surface', '#FFF7E2'),
  gray300: '#EEE8DC', gray400: '#C9BFAF', gray500: '#938B7D',
  gray600: '#6A645A', gray700: '#4F4A42', gray800: '#38342E', gray900: '#25282B',
};
