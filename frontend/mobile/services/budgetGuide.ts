import type { ApiChallenge } from '@/types/api';

export type BudgetGuide = {
  categoryName: string;
  budgetLimit: number;
  actualSpend: number;
  overAmount: number;
  ratio: number;
};

function asPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * 챌린지 ai_metadata에 포함된 월 누적 실지출과 예산을 기준으로
 * '이미 예산을 넘긴' 카테고리만 추립니다.
 * 예측 초과(budget_pressure)만으로는 실제 초과로 판정하지 않습니다.
 */
export function getBudgetGuidesFromChallenges(
  challenges: ApiChallenge[]
): BudgetGuide[] {
  const byCategory = new Map<string, BudgetGuide>();

  challenges.forEach((challenge) => {
    const metadata = challenge.ai_metadata ?? {};
    const budgetLimit = asPositiveNumber(metadata.budget_limit);
    const actualSpend = asPositiveNumber(metadata.month_to_date_actual);

    if (!budgetLimit || !actualSpend || actualSpend <= budgetLimit) return;

    const guide: BudgetGuide = {
      categoryName: challenge.category_name,
      budgetLimit,
      actualSpend,
      overAmount: actualSpend - budgetLimit,
      ratio: actualSpend / budgetLimit,
    };

    const existing = byCategory.get(guide.categoryName);
    if (!existing || guide.ratio > existing.ratio) {
      byCategory.set(guide.categoryName, guide);
    }
  });

  return [...byCategory.values()].sort((a, b) => b.ratio - a.ratio);
}

export function getPrimaryBudgetGuide(challenges: ApiChallenge[]) {
  return getBudgetGuidesFromChallenges(challenges)[0] ?? null;
}
