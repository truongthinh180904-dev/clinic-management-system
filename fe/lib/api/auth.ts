import { apiClient } from '@/lib/api/client';
import { ApiResponse, LoginCredentials, LoginResponseData, User } from '@/types/auth';

/**
 * Send login credentials to backend.
 */
export async function loginApi(credentials: LoginCredentials): Promise<ApiResponse<LoginResponseData>> {
  return apiClient.post<LoginResponseData>('/auth/login', credentials);
}

/**
 * Fetch authenticated user details.
 */
export async function getMeApi(token?: string): Promise<ApiResponse<User>> {
  return apiClient.get<User>('/auth/me', token ? { token } : undefined);
}

/**
 * Revoke user session/token on backend.
 */
export async function logoutApi(): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/auth/logout');
}
