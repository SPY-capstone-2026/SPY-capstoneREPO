/** 이전 링크 호환: 예산 관리는 소비 화면의 '항목별 예산'에서 제공합니다. */
import { Redirect } from 'expo-router';
export default function LegacyBudgetRedirect() {
  return <Redirect href="/transactions" />;
}
