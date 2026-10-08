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

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function pickWeeklySource(
  response: WeeklyReportApiResponse
): Record<string, unknown> {
  const root = asRecord(response) ?? {};

  const candidates = [
    asRecord(root.data),
    asRecord(root.report),
    asRecord(root.weekly_report),
    asRecord(root.result),
    root,
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  return (
    candidates.find(
      (item) =>
        item.weekly_summary != null ||
        item.category_comparison != null ||
        item.spending != null ||
        item.challenge != null
    ) ?? root
  );
}

function normalizeWeeklyCategory(value: unknown) {
  const item = asRecord(value) ?? {};

  const thisWeek =
    firstNumber(
      item.this_week,
      item.this_week_spend,
      item.this_week_amount,
      item.current_week,
      item.current_week_spend,
      item.current_week_amount,
      item.week_total,
      item.week_spend
    ) ?? 0;

  const lastWeek =
    firstNumber(
      item.last_week,
      item.last_week_spend,
      item.last_week_amount,
      item.previous_week,
      item.previous_week_spend,
      item.previous_week_amount,
      item.prev_week,
      item.prev_week_spend
    ) ?? 0;

  const change =
    firstNumber(
      item.change,
      item.change_amount,
      item.delta,
      item.difference
    ) ?? thisWeek - lastWeek;

  const rawRate = firstNumber(
    item.change_rate,
    item.change_ratio,
    item.rate
  );

  return {
    category_name:
      firstString(
        item.category_name,
        item.category,
        item.name
      ) ?? '기타',
    this_week: thisWeek,
    last_week: lastWeek,
    change,
    change_amount: change,
    change_rate: rawRate,
    change_ratio: rawRate,
    change_direction:
      change > 0 ? 'up' : change < 0 ? 'down' : 'same',
  } as const;
}

function normalizeWeeklyReport(
  response: WeeklyReportApiResponse
): WeeklyReportData {
  const source = pickWeeklySource(response);
  const weeklySummary = asRecord(source.weekly_summary) ?? {};
  const spending = asRecord(source.spending) ?? {};
  const challenge = asRecord(source.challenge) ?? {};
  const budget = asRecord(source.budget);

  const rawCategories =
    (Array.isArray(source.category_comparison)
      ? source.category_comparison
      : Array.isArray(spending.by_category)
        ? spending.by_category
        : []) as unknown[];

  const categories = rawCategories.map(normalizeWeeklyCategory);

  const thisWeekFromCategories = categories.reduce(
    (sum, item) => sum + numberOrZero(item.this_week),
    0
  );

  const lastWeekFromCategories = categories.reduce(
    (sum, item) => sum + numberOrZero(item.last_week),
    0
  );

  const weekTotal =
    firstNumber(
      weeklySummary.week_total,
      weeklySummary.this_week_total,
      weeklySummary.current_week_total,
      weeklySummary.total_this_week,
      weeklySummary.this_week_spend,
      weeklySummary.this_week,
      weeklySummary.this_week_amount,
      weeklySummary.this_week_spending,
      weeklySummary.current_week,
      weeklySummary.current_week_spend,
      weeklySummary.current_week_amount,
      weeklySummary.weekly_total,
      weeklySummary.weekly_spend,
      weeklySummary.this_week_total_spend,
      weeklySummary.current_week_total_spend,
      spending.week_total,
      spending.this_week_total,
      spending.this_week,
      spending.this_week_spend,
      source.week_total,
      source.this_week_total,
      source.this_week
    ) ?? thisWeekFromCategories;

  const lastWeekTotal =
    firstNumber(
      weeklySummary.last_week_total,
      weeklySummary.previous_week_total,
      weeklySummary.prev_week_total,
      weeklySummary.total_last_week,
      weeklySummary.last_week_spend,
      weeklySummary.last_week,
      weeklySummary.last_week_amount,
      weeklySummary.last_week_spending,
      weeklySummary.previous_week,
      weeklySummary.previous_week_spend,
      weeklySummary.previous_week_amount,
      weeklySummary.last_week_total_spend,
      spending.last_week_total,
      spending.last_week,
      spending.last_week_spend,
      source.last_week_total,
      source.last_week,
      source.previous_week_total
    ) ?? lastWeekFromCategories;

  const change =
    firstNumber(
      weeklySummary.change,
      weeklySummary.change_amount,
      weeklySummary.delta,
      spending.change,
      spending.change_amount,
      source.change,
      source.change_amount
    ) ?? weekTotal - lastWeekTotal;

  const changeRate = firstNumber(
    weeklySummary.change_rate,
    weeklySummary.change_ratio,
    weeklySummary.rate,
    spending.change_rate,
    spending.change_ratio,
    source.change_rate,
    source.change_ratio
  );

  const xpEarned = firstNumber(
    weeklySummary.xp_earned,
    weeklySummary.total_xp_earned,
    weeklySummary.earned_xp,
    weeklySummary.weekly_xp,
    weeklySummary.week_xp,
    challenge.xp_earned,
    challenge.total_xp_earned,
    challenge.earned_xp,
    source.xp_earned,
    source.total_xp_earned
  );

  const budgetCategories = Array.isArray(budget?.by_category)
    ? (budget?.by_category as unknown[])
    : [];

  return {
    user_id: firstString(source.user_id),
    report_type: firstString(source.report_type),
    week_start_date: firstString(
      source.week_start_date,
      source.week_start
    ),
    week_end_date: firstString(
      source.week_end_date,
      source.week_end
    ),
    schema_version: firstString(source.schema_version),
    weekly_summary: {
      week_total: weekTotal,
      last_week_total: lastWeekTotal,
      change,
      change_amount: change,
      change_rate: changeRate,
      change_ratio: changeRate,
      xp_earned: xpEarned,
    },
    category_comparison: categories,
    budget: budget
      ? {
          by_category: budgetCategories.map((raw) => {
            const item = asRecord(raw) ?? {};
            return {
              category_name:
                firstString(
                  item.category_name,
                  item.category,
                  item.name
                ) ?? '기타',
              month_to_date:
                firstNumber(
                  item.month_to_date,
                  item.actual_spend,
                  item.spent
                ) ?? 0,
              budget_limit:
                firstNumber(
                  item.budget_limit,
                  item.budget,
                  item.limit
                ) ?? 0,
              usage_ratio:
                firstNumber(
                  item.usage_ratio,
                  item.budget_pressure,
                  item.ratio
                ) ?? 0,
            };
          }),
          total_month_to_date:
            firstNumber(
              budget.total_month_to_date,
              budget.total_spend,
              budget.month_to_date
            ) ?? 0,
          total_budget:
            firstNumber(
              budget.total_budget,
              budget.budget_limit
            ) ?? 0,
          total_usage_ratio:
            firstNumber(
              budget.total_usage_ratio,
              budget.usage_ratio,
              budget.budget_pressure
            ) ?? 0,
        }
      : undefined,
    comment:
      firstString(
        source.comment,
        source.review,
        source.ai_comment,
        source.summary_comment
      ) ?? null,
    comment_source:
      firstString(source.comment_source) ?? null,
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
  const summaryRecord = summary as Record<string, unknown>;
  const responseRecord = response as Record<string, unknown>;

  const xpEarned = numberOrZero(
    firstNumber(
      summary.xp_earned,
      summaryRecord.total_xp_earned,
      response.xp_earned,
      responseRecord.total_xp_earned,
      xpFromCategories
    )
  );

  const completionRate =
    totalCount > 0
      ? Math.min(Math.max(completedCount / totalCount, 0), 1)
      : summary.completion_rate ??
        response.completion_rate ??
        0;

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
