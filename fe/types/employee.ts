import { PaginationMeta } from './auth';

export type { PaginationMeta };
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface EmployeeUser {
  id: number;
  username: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
}

export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: Gender | string | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  status: EmployeeStatus;
  notes: string | null;
  user?: EmployeeUser | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateEmployeeInput {
  employee_code?: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | string | null;
  position?: string | null;
  department?: string | null;
  hire_date?: string | null;
  status?: EmployeeStatus;
  notes?: string | null;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export interface EmployeeQueryParams {
  search?: string;
  q?: string;
  status?: string;
  department?: string;
  position?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;
  errors?: Record<string, string[]> | null;
}
