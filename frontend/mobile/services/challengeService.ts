import {
  generateChallengesApi,
  getTodayChallengesApi,
} from '@/services/challengeApi';
import type { ApiChallenge } from '@/types/api';
import type {
  ChallengeAiMetadata,
  ChallengeDifficulty,
  ChallengeStatus,
  ChallengeType,
  DailyChallenge,
  EvaluatedCategory,
} from '@/constants/mockTypes';

function normalizeDifficulty(difficulty: string): ChallengeDifficulty {
  if (difficulty === 'Easy' || difficulty === 'Medium' || difficulty === 'Hard') {
    return difficulty;
  }

  return 'Easy';
}

function normalizeStatus(status: string): ChallengeStatus {
  if (status === 'PENDING' || status === 'SUCCESS' || status === 'FAILED') {
    return status;
  }

  return 'PENDING';
}

function normalizeChallengeType(challengeType: string): ChallengeType {
  if (
    challengeType === '금지형' ||
    challengeType === '강한 제한형' ||
    challengeType === '제한형' ||
    challengeType === '유지형' ||
    challengeType === 'streak형'
  ) {
    return challengeType;
  }

  if (challengeType.includes('절약')) {
    return '제한형';
  }

  return '유지형';
}

function isChallengeAiMetadata(value: unknown): value is ChallengeAiMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'budget_limit' in value &&
    'predicted_monthly_spend' in value &&
    'budget_pressure' in value
  );
}

function makeFallbackAiMetadata(challenge: ApiChallenge): ChallengeAiMetadata {
  const evaluatedCategories: EvaluatedCategory[] = [
    {
      category_name: challenge.category_name,
      budget_pressure: 1,
      budget_limit: 0,
      predicted_monthly_spend: 0,
      rank: 1,
    },
  ];

  return {
    model_version: 'api-v1',
    generated_at: new Date().toISOString(),

    budget_limit: 0,
    month_to_date_actual: 0,
    predicted_remaining_spend: 0,
    predicted_monthly_spend: 0,
    budget_pressure: 1,

    evaluated_categories: evaluatedCategories,
  };
}

function mapApiChallengeToDailyChallenge(
  challenge: ApiChallenge
): DailyChallenge {
  return {
    challenge_id: String(challenge.challenge_id),
    user_id: challenge.user_id,
    category_name: challenge.category_name,
    challenge_date: challenge.challenge_date,
    challenge_type: normalizeChallengeType(challenge.challenge_type),
    challenge_text: challenge.challenge_text,
    difficulty: normalizeDifficulty(challenge.difficulty),
    status: normalizeStatus(challenge.status),
    xp_reward: challenge.xp_reward,
    ai_metadata: isChallengeAiMetadata(challenge.ai_metadata)
      ? challenge.ai_metadata
      : makeFallbackAiMetadata(challenge),
  };
}

export async function getTodayChallengeFromApi() {
  const todayResponse = await getTodayChallengesApi();

  if (todayResponse.data && todayResponse.data.length > 0) {
    return mapApiChallengeToDailyChallenge(todayResponse.data[0]);
  }

  const generatedResponse = await generateChallengesApi();

  if (!generatedResponse.data || generatedResponse.data.length === 0) {
    throw new Error('생성된 챌린지가 없습니다.');
  }

  return mapApiChallengeToDailyChallenge(generatedResponse.data[0]);
}

export async function generateTodayChallengeFromApi() {
  const generatedResponse = await generateChallengesApi();

  if (!generatedResponse.data || generatedResponse.data.length === 0) {
    throw new Error('생성된 챌린지가 없습니다.');
  }

  return mapApiChallengeToDailyChallenge(generatedResponse.data[0]);
}