import { CategorySetting } from '@/constants/mockTypes';

export const mockCategorySettings: CategorySetting[] = [
  {
    id: 'category-setting-001',
    user_id: 'user-demo-001',
    category_name: '카페',
    budget_limit: 30000,
    is_daily_challenge: true,
    alert_threshold: 80,
  },
  {
    id: 'category-setting-002',
    user_id: 'user-demo-001',
    category_name: '식비',
    budget_limit: 180000,
    is_daily_challenge: true,
    alert_threshold: 80,
  },
  {
    id: 'category-setting-003',
    user_id: 'user-demo-001',
    category_name: '쇼핑',
    budget_limit: 90000,
    is_daily_challenge: true,
    alert_threshold: 85,
  },
  {
    id: 'category-setting-004',
    user_id: 'user-demo-001',
    category_name: '교통',
    budget_limit: 60000,
    is_daily_challenge: false,
    alert_threshold: 90,
  },
];