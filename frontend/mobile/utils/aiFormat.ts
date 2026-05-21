import { colors } from '@/constants/colors';
import type { DailyChallenge, EvaluatedCategory } from '@/constants/mockTypes';
import {
  getBudgetColor,
  getBudgetLabel,
  getBudgetTone,
} from '@/utils/budgetStatus';

type ChallengeLike = Pick<DailyChallenge, 'ai_metadata'>;

export function formatWon(amount: number) {
  if (!Number.isFinite(amount)) {
    return '0원';
  }

  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

export function formatPressure(pressure: number) {
  if (!Number.isFinite(pressure)) {
    return '0%';
  }

  return `${Math.round(pressure * 100)}%`;
}

export function getBudgetGap(challenge: ChallengeLike) {
  return (
    challenge.ai_metadata.predicted_monthly_spend -
    challenge.ai_metadata.budget_limit
  );
}

export function sortEvaluatedCategories(categories: EvaluatedCategory[]) {
  return [...categories].sort((a, b) => {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return b.budget_pressure - a.budget_pressure;
  });
}

export function getChallengeTone(challengeType: string) {
  if (
    challengeType.includes('금지') ||
    challengeType.includes('강한') ||
    challengeType.toLowerCase().includes('hard')
  ) {
    return {
      label: '강하게 관리',
      color: colors.dangerText,
      backgroundColor: colors.dangerBg,
    };
  }

  if (
    challengeType.includes('제한') ||
    challengeType.toLowerCase().includes('medium')
  ) {
    return {
      label: '조금 줄이기',
      color: colors.warningText,
      backgroundColor: colors.warningBg,
    };
  }

  if (
    challengeType.includes('유지') ||
    challengeType.includes('streak') ||
    challengeType.toLowerCase().includes('easy')
  ) {
    return {
      label: '가볍게 유지',
      color: colors.successText,
      backgroundColor: colors.successBg,
    };
  }

  return {
    label: '오늘의 미션',
    color: colors.butterBrown,
    backgroundColor: colors.butterPale,
  };
}

/**
 * 이전 화면 코드와의 호환용 alias입니다.
 * 새 화면에서는 budgetStatus.ts의 getBudgetTone / getBudgetColor / getBudgetLabel 사용을 권장합니다.
 */
export function getPressureTone(pressure: number) {
  return getBudgetTone(pressure);
}

export function getPressureColor(pressure: number) {
  return getBudgetColor(pressure);
}

export function getPressureLabel(pressure: number) {
  return getBudgetLabel(pressure);
}