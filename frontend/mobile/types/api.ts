export type ApiStatusResponse = {
  status: string;
};

export type SignupRequest = {
  email: string;
  password: string;
  income_type: string;
  payday: number;
  spend_profile: string;
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
  income_type: string;
  payday: number;
  spend_profile: string;
  total_xp: number;
  current_level: number;
  current_points: number;
  created_at?: string | null;
};

export type ChallengeEvaluatedCategory = {
  category_name: string;
  budget_pressure?: number;
  budget_limit?: number;
  predicted_monthly_spend?: number;
  no_spend_streak?: number;
  model_used?: string;
  rank?: number | null;
  [key: string]: unknown;
};

export type ChallengeAiMetadata = {
  schema_version?: string;
  challenge_origin?: 'pressure' | 'streak' | string;
  budget_limit?: number;
  predicted_monthly_spend?: number;
  predicted_today?: number;
  month_to_date_actual?: number;
  predicted_remaining_spend?: number;
  forecast_lower?: number;
  forecast_upper?: number;
  budget_pressure?: number;
  daily_limit?: number;
  pressure_reduction?: number;
  budget_reduction?: number | null;
  final_reduction?: number;
  limit_source?: string;
  context_label?: string;
  text_source?: string;
  model_used?: string;
  data_points_used?: number;
  tx_count_used?: number;
  nonzero_ratio?: number;
  no_spend_streak?: number;
  month_start_date?: string;
  month_end_date?: string;
  days_remaining_in_month?: number;
  month_progress_ratio?: number;
  category_correction_applied?: boolean;
  reason?: string;
  reasons?: string[];
  mae?: number;
  rmse?: number;
  mape?: number;
  forecast_metrics?: Record<string, number | null | undefined>;
  evaluated_categories?: ChallengeEvaluatedCategory[];
  [key: string]: unknown;
};

export type LevelResult = {
  leveled_up: boolean;
  old_level: number;
  new_level: number;
  points_earned: number;
  current_points: number;
  unlocked_items: string[];
  unlocked_item_ids: string[];
};

export type ReversalResult = {
  points_reversed: number;
  items_removed: string[];
  snapshot_found: boolean;
};

export type ApiChallenge = {
  challenge_id: number;
  user_id: string;
  category_name: string;
  challenge_date: string;
  challenge_type: string;
  challenge_text: string;
  difficulty: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  xp_reward: number;
  ai_metadata?: ChallengeAiMetadata | null;
  reward_snapshot?: LevelResult | null;
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

export type UpdateTransactionRequest = {
  tx_date?: string;
  tx_time?: string;
  amount?: number;
  merchant_name?: string;
  mydata_category?: string;
  final_category?: string;
  is_user_corrected?: boolean;
};

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

export type UpdateChallengeStatusRequest = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
};

export type UserProgressResponse = {
  user_id: string;
  total_xp: number;
  current_level: number;
  current_points: number;
};

export type UpdateChallengeStatusResponse = {
  status: 'success' | string;
  data: {
    challenge: ApiChallenge;
    user_progress: UserProgressResponse;
    level_result?: LevelResult | null;
    reversal_result?: ReversalResult | null;
  };
};

export type UpdateMeRequest = {
  email?: string;
  income_type?: string;
  payday?: number;
  spend_profile?: string;
};

export type UpdateMeResponse = {
  status: 'success' | string;
  data: MeResponse;
};

export type ApiCategorySetting = {
  id: string;
  user_id: string;
  category_name: string;
  budget_limit: number;
  is_daily_challenge: boolean;
  alert_threshold: number;
};

export type CategoriesResponse = {
  status: 'success' | string;
  count: number;
  data: ApiCategorySetting[];
};

export type UpdateCategoryRequest = {
  budget_limit?: number;
  is_daily_challenge?: boolean;
  alert_threshold?: number;
};

export type UpdateCategoryResponse = {
  status: 'success' | string;
  data: ApiCategorySetting;
};

export type ShopItem = {
  item_id: string;
  name: string;
  description: string | null;
  category: string;
  price: number | null;
  image_url: string | null;
  is_purchasable: boolean;
  is_repeatable: boolean;
  rarity: string;
  unlock_level: number | null;
};

export type ShopItemsResponse = {
  status: 'success' | string;
  count: number;
  data: ShopItem[];
};

export type PurchaseShopItemResponse = {
  status: 'success' | string;
  data: {
    item: ShopItem;
    current_points: number;
  };
};

export type InventoryItem = {
  id: string;
  item_id: string;
  item: ShopItem | null;
  acquired_type: string;
  is_equipped: boolean;
  acquired_at: string | null;
};

export type InventoryResponse = {
  status: 'success' | string;
  count: number;
  data: InventoryItem[];
};

export type EquipInventoryRequest = {
  equip: boolean;
};

export type EquipInventoryResponse = {
  status: 'success' | string;
  data: InventoryItem;
};
