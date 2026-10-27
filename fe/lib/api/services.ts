import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import { PaginatedResponse } from '@/types/employee';
import {
  CreateServiceInput,
  Service,
  ServiceQueryParams,
  UpdateServiceInput,
} from '@/types/service';

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
 * Fetch paginated list of services.
 */
export async function getServices(
  params?: ServiceQueryParams
): Promise<PaginatedResponse<Service>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<Service[]>(`/services${query}`);
  return res as unknown as PaginatedResponse<Service>;
}

/**
 * Fetch service details by ID.
 */
export async function getService(
  id: number | string
): Promise<ApiResponse<Service>> {
  return apiClient.get<Service>(`/services/${id}`);
}

/**
 * Create a new service.
 */
export async function createService(
  data: CreateServiceInput
): Promise<ApiResponse<Service>> {
  return apiClient.post<Service>('/services', data);
}

/**
 * Update an existing service.
 */
export async function updateService(
  id: number | string,
  data: UpdateServiceInput
): Promise<ApiResponse<Service>> {
  return apiClient.put<Service>(`/services/${id}`, data);
}

/**
 * Update service status.
 */
export async function updateServiceStatus(
  id: number | string,
  status: string
): Promise<ApiResponse<Service>> {
  return apiClient.patch<Service>(`/services/${id}/status`, { status });
}

/**
 * Delete / deactivate a service.
 */
export async function deleteService(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/services/${id}`);
}
