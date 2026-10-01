import { apiRequest } from '@/services/apiClient';
import type {
  BudgetHistoryApiResponse,
  ChallengeStatsApiResponse,
  MonthlyReportApiResponse,
  WeeklyReportApiResponse,
} from '@/types/report';

function buildQuery(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => Boolean(entry[1])
  );

  if (entries.length === 0) return '';

  return `?${entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join('&')}`;
}

export async function getWeeklyReportApi(targetDate?: string) {
  const query = buildQuery({ target_date: targetDate });

  return apiRequest<WeeklyReportApiResponse>({
    path: `/reports/weekly${query}`,
    method: 'GET',
    auth: true,
  });
}

export async function getMonthlyReportApi(targetDate?: string) {
  const query = buildQuery({ target_date: targetDate });

  return apiRequest<MonthlyReportApiResponse>({
    path: `/reports/monthly${query}`,
    method: 'GET',
    auth: true,
  });
}

export async function getChallengeStatsByCategoryApi(params: {
  period: 'week' | 'all';
  startDate?: string;
  endDate?: string;
}) {
  const query = buildQuery({
    period: params.period,
    start_date: params.startDate,
    end_date: params.endDate,
  });

  return apiRequest<ChallengeStatsApiResponse>({
    path: `/challenges/stats/by-category${query}`,
    method: 'GET',
    auth: true,
  });
}

export async function getBudgetHistoryApi(params: {
  startDate?: string;
  endDate?: string;
  categoryName?: string;
}) {
  const query = buildQuery({
    start_date: params.startDate,
    end_date: params.endDate,
    category_name: params.categoryName,
  });

  return apiRequest<BudgetHistoryApiResponse>({
    path: `/categories/budget-history${query}`,
    method: 'GET',
    auth: true,
  });
}
