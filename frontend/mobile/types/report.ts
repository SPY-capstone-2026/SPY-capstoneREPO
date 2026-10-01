import type {
  ApiMonthlySummary,
  ApiReportEvaluatedCategory,
  ApiWeeklyTrendItem,
} from '@/types/api';

export type ReportDirection = 'up' | 'down' | 'same';

export type WeeklyReportSummary = {
  week_total: number;
  last_week_total: number;
  change?: number;
  change_amount?: number;
  change_rate?: number | null;
  change_ratio?: number | null;
  xp_earned?: number;
};

export type WeeklyCategoryComparison = {
  category_name: string;
  this_week: number;
  last_week: number;
  change?: number;
  change_amount?: number;
  change_rate?: number | null;
  change_ratio?: number | null;
  change_direction?: ReportDirection;
};

export type WeeklyBudgetCategory = {
  category_name: string;
  month_to_date: number;
  budget_limit: number;
  usage_ratio: number;
};

export type WeeklyBudgetSummary = {
  by_category: WeeklyBudgetCategory[];
  total_month_to_date: number;
  total_budget: number;
  total_usage_ratio: number;
};

export type WeeklyReportData = {
  user_id?: string;
  report_type?: 'weekly' | string;
  week_start_date?: string;
  week_end_date?: string;
  schema_version?: string;
  weekly_summary: WeeklyReportSummary;
  category_comparison: WeeklyCategoryComparison[];
  budget?: WeeklyBudgetSummary;
  comment?: string | null;
  comment_source?: 'llm' | 'rule_fallback' | string | null;
};

export type WeeklyReportApiResponse = {
  status?: 'success' | string;
  data?: WeeklyReportData;
} & Partial<WeeklyReportData>;

export type MonthlyReportSummary = ApiMonthlySummary;

export type MonthlyWeeklyTrendItem = ApiWeeklyTrendItem;

export type MonthlyWeeklyBreakdownItem = {
  week_number?: number;
  week_label?: string;
  label?: string;
  amount?: number;
  total?: number;
  total_spend?: number;
  week_start_date?: string;
  week_end_date?: string;
};

export type MonthlyEvaluatedCategory = ApiReportEvaluatedCategory;

export type DailyCumulativePoint = {
  date: string;
  amount?: number;
  cumulative_spend?: number;
  cumulative_amount?: number;
};

export type CategoryOverrunItem = {
  category_name: string;
  budget_limit?: number;
  overrun_date: string | null;
  daily_cumulative?: DailyCumulativePoint[];
};

export type MonthlyReportData = {
  month: string;
  monthly_summary: MonthlyReportSummary;
  weekly_trend: MonthlyWeeklyTrendItem[];
  weekly_breakdown?: MonthlyWeeklyBreakdownItem[];
  evaluated_categories: MonthlyEvaluatedCategory[];
  category_overrun?: CategoryOverrunItem[];
  comment?: string | null;
  comment_source?: 'llm' | 'rule_fallback' | string | null;
};

export type MonthlyReportApiResponse = {
  status?: 'success' | string;
  data?: MonthlyReportData;
} & Partial<MonthlyReportData>;

export type ChallengeStatsCategory = {
  category_name: string;
  total_count?: number;
  total?: number;
  completed_count?: number;
  completed?: number;
  completion_rate?: number;
  xp_earned?: number;
};

export type ChallengeStatsData = {
  total_count: number;
  completed_count: number;
  completion_rate?: number;
  xp_earned: number;
  by_category: ChallengeStatsCategory[];
};

export type ChallengeStatsApiResponse = {
  status?: 'success' | string;
  data?:
    | ChallengeStatsData
    | ChallengeStatsCategory[]
    | {
        summary?: Partial<ChallengeStatsData>;
        by_category?: ChallengeStatsCategory[];
      };
  total_count?: number;
  completed_count?: number;
  completion_rate?: number;
  xp_earned?: number;
  by_category?: ChallengeStatsCategory[];
};

export type BudgetHistoryItem = {
  id?: string;
  category_name: string;
  old_budget_limit?: number;
  previous_budget_limit?: number;
  before_budget_limit?: number;
  new_budget_limit?: number;
  budget_limit?: number;
  after_budget_limit?: number;
  changed_at?: string;
  changed_date?: string;
  created_at?: string;
};

export type BudgetHistoryApiResponse = {
  status?: 'success' | string;
  data?:
    | BudgetHistoryItem[]
    | {
        history?: BudgetHistoryItem[];
        items?: BudgetHistoryItem[];
      };
  history?: BudgetHistoryItem[];
  items?: BudgetHistoryItem[];
};
