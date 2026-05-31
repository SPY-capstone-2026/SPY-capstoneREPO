import { apiRequest } from '@/services/apiClient';
import { saveAccessToken } from '@/services/tokenStorage';
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  SignupRequest,
  SignupResponse,
} from '@/types/api';

export async function signupApi(payload: SignupRequest) {
  return apiRequest<SignupResponse>({
    path: '/signup',
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export async function loginApi(payload: LoginRequest) {
  const response = await apiRequest<LoginResponse>({
    path: '/login',
    method: 'POST',
    body: payload,
    auth: false,
  });

  await saveAccessToken(response.access_token);

  return response;
}

export async function getMeApi() {
  return apiRequest<MeResponse>({
    path: '/me',
    method: 'GET',
    auth: true,
  });
}