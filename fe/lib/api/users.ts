import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import { PaginatedResponse } from '@/types/employee';
import {
  ChangePasswordInput,
  CreateUserInput,
  RoleItem,
  UpdateUserInput,
  UserItem,
  UserQueryParams,
} from '@/types/user';

/**
 * Build URL query string from parameter object.
 */
function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch paginated list of user accounts with search and filters.
 */
export async function getUsers(
  params?: UserQueryParams
): Promise<PaginatedResponse<UserItem>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<UserItem[]>(`/users${query}`);
  return res as unknown as PaginatedResponse<UserItem>;
}

/**
 * Fetch user details by ID or username.
 */
export async function getUser(
  idOrUsername: number | string
): Promise<ApiResponse<UserItem>> {
  return apiClient.get<UserItem>(`/users/${idOrUsername}`);
}

/**
 * Create a new user account.
 */
export async function createUser(
  data: CreateUserInput
): Promise<ApiResponse<UserItem>> {
  return apiClient.post<UserItem>('/users', data);
}

/**
 * Update an existing user account.
 */
export async function updateUser(
  id: number | string,
  data: UpdateUserInput
): Promise<ApiResponse<UserItem>> {
  return apiClient.put<UserItem>(`/users/${id}`, data);
}

/**
 * Quick update of user status (ACTIVE, INACTIVE, LOCKED).
 */
export async function updateUserStatus(
  id: number | string,
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
): Promise<ApiResponse<UserItem>> {
  return apiClient.patch<UserItem>(`/users/${id}/status`, { status });
}

/**
 * Change or reset user password.
 */
export async function changeUserPassword(
  id: number | string,
  data: ChangePasswordInput
): Promise<ApiResponse<null>> {
  return apiClient.post<null>(`/users/${id}/password`, data);
}

/**
 * Delete a user account.
 */
export async function deleteUser(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/users/${id}`);
}

/**
 * Fetch list of all system roles.
 */
export async function getRoles(): Promise<ApiResponse<RoleItem[]>> {
  return apiClient.get<RoleItem[]>('/roles');
}

/**
 * Update assigned roles for a user.
 */
export async function updateUserRoles(
  userId: number | string,
  roles: string[] | number[]
): Promise<ApiResponse<UserItem>> {
  return apiClient.put<UserItem>(`/users/${userId}/roles`, { roles });
}
