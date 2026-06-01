export type ApiStatusResponse = {
  status: string;
};

export type SignupRequest = {
  email: string;
  password: string;
};

export type SignupResponse = {
  status: 'success' | string;
  user_id: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer' | string;
};

export type MeResponse = {
  user_id: string;
  email: string;
};

export type ApiChallenge = {
  challenge_id: number;
  user_id: string;
  category_name: string;
  challenge_date: string;
  challenge_type: string;
  challenge_text: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  xp_reward: number;
  ai_metadata?: unknown;
};

export type GenerateChallengesResponse = {
  status: 'success' | string;
  count: number;
  data: ApiChallenge[];
};

export type ApiTransaction = {
  tx_id: string;
  user_id: string;
  tx_date: string;
  tx_time: string | null;
  amount: number;
  merchant_name: string;
  mydata_category: string;
  final_category: string;
  is_user_corrected: boolean;
};

export type TransactionsResponse = {
  status: 'success' | string;
  count: number;
  data: ApiTransaction[];
};

export type CreateTransactionRequest = {
  tx_date: string;
  tx_time?: string;
  amount: number;
  merchant_name: string;
  mydata_category?: string;
  final_category: string;
  is_user_corrected?: boolean;
};

export type CreateTransactionResponse = {
  status: 'success' | string;
  data: ApiTransaction;
};

export type UpdateTransactionRequest = Partial<CreateTransactionRequest>;

export type UpdateTransactionResponse = {
  status: 'success' | string;
  data: ApiTransaction;
};

export type DeleteTransactionResponse = {
  status: 'success' | string;
  deleted_id: string;
};

export type ApiMonthlySummary = {
  total_spend: number;
  budget_limit: number;
  predicted_monthly_spend: number;
  budget_pressure: number;
  transaction_count: number;
};

export type ApiWeeklyTrendItem = {
  label: string;
  amount: number;
};

export type ApiReportEvaluatedCategory = {
  category_name: string;
  budget_limit: number;
  actual_spend: number;
  predicted_monthly_spend: number;
  budget_pressure: number;
  rank: number | null;
};

export type MonthlyReportResponse = {
  status: 'success' | string;
  data: {
    month: string;
    monthly_summary: ApiMonthlySummary;
    weekly_trend: ApiWeeklyTrendItem[];
    evaluated_categories: ApiReportEvaluatedCategory[];
  };
};