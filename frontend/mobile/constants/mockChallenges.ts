import { DailyChallenge, EvaluatedCategory } from '@/constants/mockTypes';

export const mockEvaluatedCategories: EvaluatedCategory[] = [
  {
    category_name: '카페',
    budget_pressure: 4.6,
    budget_limit: 30000,
    predicted_monthly_spend: 137868,
    rank: 1,
  },
  {
    category_name: '쇼핑',
    budget_pressure: 1.32,
    budget_limit: 90000,
    predicted_monthly_spend: 118800,
    rank: 2,
  },
  {
    category_name: '식비',
    budget_pressure: 0.92,
    budget_limit: 180000,
    predicted_monthly_spend: 165600,
    rank: 3,
  },
  {
    category_name: '교통',
    budget_pressure: 0.64,
    budget_limit: 60000,
    predicted_monthly_spend: 38400,
    rank: 4,
  },
];

export const mockTodayChallenge: DailyChallenge = {
  challenge_id: 'challenge-demo-001',
  user_id: 'user-demo-001',
  category_name: '카페',
  challenge_date: '2026-05-19',
  challenge_type: '강한 제한형',
  challenge_text: '오늘 카페 지출을 5,000원 이하로 유지해 보세요.',
  difficulty: 'Hard',
  status: 'PENDING',
  xp_reward: 30,
  ai_metadata: {
    model_version: 'moni-ai-demo-v0.1',
    generated_at: '2026-05-19T00:00:00',

    budget_limit: 30000,
    month_to_date_actual: 48200,
    predicted_remaining_spend: 89668,
    predicted_monthly_spend: 137868,
    budget_pressure: 4.6,

    evaluated_categories: mockEvaluatedCategories,
  },
};

export const mockChallengeHistory: DailyChallenge[] = [
  {
    challenge_id: 'challenge-demo-history-001',
    user_id: 'user-demo-001',
    category_name: '카페',
    challenge_date: '2026-05-18',
    challenge_type: '제한형',
    challenge_text: '오늘 카페 지출을 7,000원 이하로 유지해 보세요.',
    difficulty: 'Medium',
    status: 'SUCCESS',
    xp_reward: 25,
    ai_metadata: {
      model_version: 'moni-ai-demo-v0.1',
      generated_at: '2026-05-18T00:00:00',

      budget_limit: 30000,
      month_to_date_actual: 42400,
      predicted_remaining_spend: 91000,
      predicted_monthly_spend: 133400,
      budget_pressure: 4.45,

      evaluated_categories: mockEvaluatedCategories,
    },
  },
  {
    challenge_id: 'challenge-demo-history-002',
    user_id: 'user-demo-001',
    category_name: '식비',
    challenge_date: '2026-05-17',
    challenge_type: '유지형',
    challenge_text: '오늘 식비를 15,000원 이하로 유지해 보세요.',
    difficulty: 'Easy',
    status: 'SUCCESS',
    xp_reward: 20,
    ai_metadata: {
      model_version: 'moni-ai-demo-v0.1',
      generated_at: '2026-05-17T00:00:00',

      budget_limit: 180000,
      month_to_date_actual: 94000,
      predicted_remaining_spend: 72000,
      predicted_monthly_spend: 166000,
      budget_pressure: 0.92,

      evaluated_categories: mockEvaluatedCategories,
    },
  },
];