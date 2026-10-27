import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CreateEmployeeInput,
  Employee,
  EmployeeQueryParams,
  PaginatedResponse,
  UpdateEmployeeInput,
} from '@/types/employee';

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
 * Fetch paginated list of employees with search and filters.
 */
export async function getEmployees(
  params?: EmployeeQueryParams
): Promise<PaginatedResponse<Employee>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<Employee[]>(`/employees${query}`);
  return res as unknown as PaginatedResponse<Employee>;
}

/**
 * Fetch employee details by ID.
 */
export async function getEmployee(
  id: number | string
): Promise<ApiResponse<Employee>> {
  return apiClient.get<Employee>(`/employees/${id}`);
}

/**
 * Create a new employee record.
 */
export async function createEmployee(
  data: CreateEmployeeInput
): Promise<ApiResponse<Employee>> {
  return apiClient.post<Employee>('/employees', data);
}

/**
 * Update an existing employee record.
 */
export async function updateEmployee(
  id: number | string,
  data: UpdateEmployeeInput
): Promise<ApiResponse<Employee>> {
  return apiClient.put<Employee>(`/employees/${id}`, data);
}

/**
 * Quick update of employee status (ACTIVE, INACTIVE, LOCKED).
 */
export async function updateEmployeeStatus(
  id: number | string,
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
): Promise<ApiResponse<Employee>> {
  return apiClient.patch<Employee>(`/employees/${id}/status`, { status });
}

/**
 * Delete an employee record.
 */
export async function deleteEmployee(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/employees/${id}`);
}
