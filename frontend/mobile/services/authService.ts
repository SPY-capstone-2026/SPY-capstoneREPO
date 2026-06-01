import { getMeApi, loginApi, signupApi, updateMeApi } from '@/services/authApi';
import { deleteAccessToken } from '@/services/tokenStorage';
import type { UpdateMeRequest } from '@/types/api';

export async function signupUser(email: string, password: string) {
  return signupApi({
    email,
    password,
  });
}

export async function loginUser(email: string, password: string) {
  return loginApi({
    email,
    password,
  });
}

export async function getCurrentUser() {
  return getMeApi();
}

export async function logoutUser() {
  await deleteAccessToken();
}

export async function updateCurrentUser(payload: UpdateMeRequest) {
  const response = await updateMeApi(payload);

  return response.data;
}