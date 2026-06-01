import { apiRequest } from '@/services/apiClient';
import type {
  CategoriesResponse,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
} from '@/types/api';

export async function getCategoriesApi() {
  return apiRequest<CategoriesResponse>({
    path: '/categories',
    method: 'GET',
    auth: true,
  });
}

export async function updateCategoryApi(
  categoryId: string,
  payload: UpdateCategoryRequest
) {
  return apiRequest<UpdateCategoryResponse>({
    path: `/categories/${categoryId}`,
    method: 'PATCH',
    body: payload,
    auth: true,
  });
}