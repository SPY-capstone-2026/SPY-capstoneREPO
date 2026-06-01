import { apiRequest } from '@/services/apiClient';
import type { GenerateChallengesResponse } from '@/types/api';

export async function getTodayChallengesApi() {
  return apiRequest<GenerateChallengesResponse>({
    path: '/challenges/today',
    method: 'GET',
    auth: true,
  });
}

export async function generateChallengesApi() {
  return apiRequest<GenerateChallengesResponse>({
    path: '/challenges/generate',
    method: 'POST',
    auth: true,
  });
}