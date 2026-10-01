import {
  getBudgetHistoryApi,
  getChallengeStatsByCategoryApi,
  getMonthlyReportApi,
  getWeeklyReportApi,
} from '@/services/reportApi';
import type {
  BudgetHistoryApiResponse,
  BudgetHistoryItem,
  ChallengeStatsApiResponse,
  ChallengeStatsCategory,
  ChallengeStatsData,
  MonthlyReportApiResponse,
  MonthlyReportData,
  WeeklyReportApiResponse,
  WeeklyReportData,
} from '@/types/report';

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeWeeklyReport(
  response: WeeklyReportApiResponse
): WeeklyReportData {
  const source = response.data ?? response;

  return {
    user_id: source.user_id,
    report_type: source.report_type,
    week_start_date: source.week_start_date,
    week_end_date: source.week_end_date,
    schema_version: source.schema_version,
    weekly_summary: {
      week_total: numberOrZero(source.weekly_summary?.week_total),
      last_week_total: numberOrZero(
        source.weekly_summary?.last_week_total
      ),
      change:
        source.weekly_summary?.change ??
        source.weekly_summary?.change_amount,
      change_amount:
        source.weekly_summary?.change_amount ??
        source.weekly_summary?.change,
      change_rate:
        source.weekly_summary?.change_rate ??
        source.weekly_summary?.change_ratio,
      change_ratio:
        source.weekly_summary?.change_ratio ??
        source.weekly_summary?.change_rate,
      xp_earned: source.weekly_summary?.xp_earned,
    },
    category_comparison: source.category_comparison ?? [],
    budget: source.budget
      ? {
          by_category: (source.budget.by_category ?? []).map((item) => ({
            category_name: item.category_name,
            month_to_date: numberOrZero(item.month_to_date),
            budget_limit: numberOrZero(item.budget_limit),
            usage_ratio: numberOrZero(item.usage_ratio),
          })),
          total_month_to_date: numberOrZero(
            source.budget.total_month_to_date
          ),
          total_budget: numberOrZero(source.budget.total_budget),
          total_usage_ratio: numberOrZero(
            source.budget.total_usage_ratio
          ),
        }
      : undefined,
    comment: source.comment ?? null,
    comment_source: source.comment_source ?? null,
  };
}

function normalizeMonthlyReport(
  response: MonthlyReportApiResponse
): MonthlyReportData {
  const source = response.data ?? response;

  if (!source.monthly_summary) {
    throw new Error('월간 리포트 요약 데이터가 없습니다.');
  }

  return {
    month: source.month ?? '',
    // home.tsx도 같은 /reports/monthly 응답 타입을 사용하므로,
    // 기존 types/api.ts의 월간 리포트 타입을 그대로 보존합니다.
    monthly_summary: source.monthly_summary,
    weekly_trend: source.weekly_trend ?? [],
    weekly_breakdown: source.weekly_breakdown ?? [],
    evaluated_categories: source.evaluated_categories ?? [],
    category_overrun: source.category_overrun ?? [],
    comment: source.comment ?? null,
    comment_source: source.comment_source ?? null,
  };
}

function normalizeChallengeStats(
  response: ChallengeStatsApiResponse
): ChallengeStatsData {
  let byCategory: ChallengeStatsCategory[] = [];
  let summary: Partial<ChallengeStatsData> = {};

  if (Array.isArray(response.data)) {
    byCategory = response.data;
  } else if (response.data && 'summary' in response.data) {
    summary = response.data.summary ?? {};
    byCategory = response.data.by_category ?? [];
  } else if (response.data) {
    summary = response.data;
    byCategory = response.data.by_category ?? [];
  } else {
    summary = response;
    byCategory = response.by_category ?? [];
  }

  const totalFromCategories = byCategory.reduce(
    (sum, item) =>
      sum + numberOrZero(item.total_count ?? item.total),
    0
  );
  const completedFromCategories = byCategory.reduce(
    (sum, item) =>
      sum + numberOrZero(item.completed_count ?? item.completed),
    0
  );
  const xpFromCategories = byCategory.reduce(
    (sum, item) => sum + numberOrZero(item.xp_earned),
    0
  );

  const totalCount = numberOrZero(
    summary.total_count ?? response.total_count ?? totalFromCategories
  );
  const completedCount = numberOrZero(
    summary.completed_count ??
      response.completed_count ??
      completedFromCategories
  );
  const xpEarned = numberOrZero(
    summary.xp_earned ?? response.xp_earned ?? xpFromCategories
  );

  const completionRate =
    summary.completion_rate ??
    response.completion_rate ??
    (totalCount > 0 ? completedCount / totalCount : 0);

  return {
    total_count: totalCount,
    completed_count: completedCount,
    completion_rate: completionRate,
    xp_earned: xpEarned,
    by_category: byCategory,
  };
}

function normalizeBudgetHistory(
  response: BudgetHistoryApiResponse
): BudgetHistoryItem[] {
  if (Array.isArray(response.data)) return response.data;
  if (response.data?.history) return response.data.history;
  if (response.data?.items) return response.data.items;
  if (response.history) return response.history;
  if (response.items) return response.items;
  return [];
}

export async function getWeeklyReportFromApi(targetDate?: string) {
  const response = await getWeeklyReportApi(targetDate);
  return normalizeWeeklyReport(response);
}

export async function getMonthlyReportFromApi(targetDate?: string) {
  const response = await getMonthlyReportApi(targetDate);
  return normalizeMonthlyReport(response);
}

export async function getChallengeStatsFromApi(params: {
  period: 'week' | 'all';
  startDate?: string;
  endDate?: string;
}) {
  const response = await getChallengeStatsByCategoryApi(params);
  return normalizeChallengeStats(response);
}

export async function getBudgetHistoryFromApi(params: {
  startDate?: string;
  endDate?: string;
  categoryName?: string;
}) {
  const response = await getBudgetHistoryApi(params);
  return normalizeBudgetHistory(response);
}
