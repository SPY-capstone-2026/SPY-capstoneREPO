import { getMeApi, loginApi, signupApi } from '@/services/authApi';
import { deleteAccessToken } from '@/services/tokenStorage';

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