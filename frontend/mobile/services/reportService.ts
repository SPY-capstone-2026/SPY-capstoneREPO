import { getMonthlyReportApi } from '@/services/reportApi';

export async function getMonthlyReportFromApi() {
  const response = await getMonthlyReportApi();

  return response.data;
}