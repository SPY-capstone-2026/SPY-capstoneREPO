import { apiRequest } from '@/services/apiClient';
import type {
  GenerateChallengesResponse,
  UpdateChallengeStatusRequest,
  UpdateChallengeStatusResponse,
} from '@/types/api';

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

export async function updateChallengeStatusApi(
  challengeId: string,
  payload: UpdateChallengeStatusRequest
) {
  return apiRequest<UpdateChallengeStatusResponse>({
    path: `/challenges/${challengeId}/status`,
    method: 'PATCH',
    body: payload,
    auth: true,
  });
}