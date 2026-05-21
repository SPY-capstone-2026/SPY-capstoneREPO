export type IncomeType = 'STUDENT' | 'EMPLOYEE' | 'FREELANCER' | 'ETC';

export type SpendProfile = 'STEADY' | 'IMPULSIVE' | 'CYCLICAL';

export type ChallengeType =
  | '금지형'
  | '강한 제한형'
  | '제한형'
  | '유지형'
  | 'streak형';

export type ChallengeDifficulty = 'Easy' | 'Medium' | 'Hard';

export type ChallengeStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export type UserProfile = {
  user_id: string;
  email: string;
  password_hash?: string;
  income_type: IncomeType;
  payday: number;
  spend_profile: SpendProfile;
  valid_data_start_date: string;
  total_xp: number;
  current_level: number;
  created_at: string;
};

export type CategorySetting = {
  id: string;
  user_id: string;
  category_name: string;
  budget_limit: number;
  is_daily_challenge: boolean;
  alert_threshold: number;
};

export type Transaction = {
  tx_id: string;
  user_id: string;
  tx_date: string;
  tx_time: string;
  amount: number;
  merchant_name: string;
  mydata_category: string;
  final_category: string;
  is_user_corrected: boolean;
};

export type EvaluatedCategory = {
  category_name: string;
  budget_pressure: number;
  budget_limit: number;
  predicted_monthly_spend: number;
  rank: number | null;
};

export type ChallengeAiMetadata = {
  model_version: string;
  generated_at: string;

  budget_limit: number;
  month_to_date_actual: number;
  predicted_remaining_spend: number;
  predicted_monthly_spend: number;
  budget_pressure: number;

  evaluated_categories: EvaluatedCategory[];
};

export type DailyChallenge = {
  challenge_id: string;
  user_id: string;
  category_name: string;
  challenge_date: string;
  challenge_type: ChallengeType;
  challenge_text: string;
  difficulty: ChallengeDifficulty;
  status: ChallengeStatus;
  xp_reward: number;
  ai_metadata: ChallengeAiMetadata;
};