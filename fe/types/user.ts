import { EmployeeProfile, PaginationMeta, UserRole, UserStatus } from './auth';

export type { PaginationMeta };

export interface UserItem {
  id: number;
  employee_id: number | null;
  username: string;
  email: string;
  status: UserStatus;
  last_login_at: string | null;
  employee: EmployeeProfile | null;
  roles: UserRole[];
  permissions: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  employee_id?: number | null;
  status?: UserStatus;
  roles?: string[] | number[];
}

export interface UpdateUserInput {
  email?: string;
  employee_id?: number | null;
  status?: UserStatus;
  roles?: string[] | number[];
}

export interface ChangePasswordInput {
  password: string;
  password_confirmation: string;
  current_password?: string;
  new_password?: string;
  new_password_confirmation?: string;
}

export interface UserQueryParams {
  search?: string;
  q?: string;
  status?: string;
  role?: string | number;
  employee_id?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface RoleItem {
  id: number;
  name: string;
  description: string | null;
}
