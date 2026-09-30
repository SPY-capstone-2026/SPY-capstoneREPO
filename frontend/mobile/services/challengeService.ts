import {
  generateChallengesApi,
  getTodayChallengesApi,
  updateChallengeStatusApi,
} from '@/services/challengeApi';
import type { ApiChallenge } from '@/types/api';

export async function getTodayChallengesFromApi(): Promise<ApiChallenge[]> {
  const todayResponse = await getTodayChallengesApi();

  if (todayResponse.data && todayResponse.data.length > 0) {
    return todayResponse.data;
  }

  const generatedResponse = await generateChallengesApi();
  return generatedResponse.data ?? [];
}

export async function generateTodayChallengesFromApi(): Promise<ApiChallenge[]> {
  const generatedResponse = await generateChallengesApi();
  return generatedResponse.data ?? [];
}

// Compatibility helpers for old callers. New screens should use the plural API.
export async function getTodayChallengeFromApi(): Promise<ApiChallenge> {
  const challenges = await getTodayChallengesFromApi();
  if (!challenges[0]) {
    throw new Error('생성된 챌린지가 없습니다.');
  }
  return challenges[0];
}

export async function generateTodayChallengeFromApi(): Promise<ApiChallenge> {
  const challenges = await generateTodayChallengesFromApi();
  if (!challenges[0]) {
    throw new Error('생성된 챌린지가 없습니다.');
  }
  return challenges[0];
}

export async function completeChallengeFromApi(challengeId: string) {
  return updateChallengeStatusFromApi(challengeId, 'SUCCESS');
}

export async function updateChallengeStatusFromApi(
  challengeId: string,
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
) {
  const response = await updateChallengeStatusApi(challengeId, { status });

  return {
    challenge: response.data.challenge,
    userProgress: response.data.user_progress,
    levelResult: response.data.level_result ?? null,
    reversalResult: response.data.reversal_result ?? null,
  };
}
