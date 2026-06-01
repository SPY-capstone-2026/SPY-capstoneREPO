import { API_BASE_URL } from '@/services/apiConfig';
import { getAccessToken } from '@/services/tokenStorage';

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ApiRequestOptions = {
  path: string;
  method?: ApiMethod;
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>({
  path,
  method = 'GET',
  body,
  auth = true,
}: ApiRequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getAccessToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : 'API 요청에 실패했습니다.';

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}