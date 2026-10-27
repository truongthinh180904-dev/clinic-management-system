export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface EmployeeProfile {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  status: string;
}

export interface UserRole {
  id: number;
  name: string;
  description: string | null;
}

export interface User {
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

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  token_type: string;
  user: User;
}

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: Record<string, string[]> | null;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]> | null;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}
