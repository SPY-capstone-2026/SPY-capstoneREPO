import { getCategoriesApi, updateCategoryApi } from '@/services/categoryApi';
import type { CategorySetting } from '@/constants/mockTypes';
import type { ApiCategorySetting, UpdateCategoryRequest } from '@/types/api';

function mapApiCategoryToCategorySetting(
  category: ApiCategorySetting
): CategorySetting {
  return {
    id: category.id,
    user_id: category.user_id,
    category_name: category.category_name,
    budget_limit: category.budget_limit,
    is_daily_challenge: category.is_daily_challenge,
    alert_threshold: category.alert_threshold,
  };
}

export async function getCategoriesFromApi() {
  const response = await getCategoriesApi();

  return response.data.map(mapApiCategoryToCategorySetting);
}

export async function updateCategoryFromApi(
  categoryId: string,
  payload: UpdateCategoryRequest
) {
  const response = await updateCategoryApi(categoryId, payload);

  return mapApiCategoryToCategorySetting(response.data);
}