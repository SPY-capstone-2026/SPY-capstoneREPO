import { apiRequest } from '@/services/apiClient';
import type { MonthlyReportResponse } from '@/types/api';

export async function getMonthlyReportApi() {
  return apiRequest<MonthlyReportResponse>({
    path: '/reports/monthly',
    method: 'GET',
    auth: true,
  });
}