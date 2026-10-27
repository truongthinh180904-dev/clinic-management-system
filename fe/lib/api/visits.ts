import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import { PaginatedResponse } from '@/types/employee';
import {
  CreateVisitInput,
  UpdateVisitInput,
  Visit,
  VisitQueryParams,
  VisitStatus,
} from '@/types/visit';

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
 * Fetch paginated list of visits with search and filters.
 */
export async function getVisits(
  params?: VisitQueryParams
): Promise<PaginatedResponse<Visit>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<Visit[]>(`/visits${query}`);
  return res as unknown as PaginatedResponse<Visit>;
}

/**
 * Fetch detailed visit by ID.
 */
export async function getVisit(
  id: number | string
): Promise<ApiResponse<Visit>> {
  return apiClient.get<Visit>(`/visits/${id}`);
}

/**
 * Create a new visit.
 */
export async function createVisit(
  data: CreateVisitInput
): Promise<ApiResponse<Visit>> {
  return apiClient.post<Visit>('/visits', data);
}

/**
 * Update an existing visit.
 */
export async function updateVisit(
  id: number | string,
  data: UpdateVisitInput
): Promise<ApiResponse<Visit>> {
  return apiClient.put<Visit>(`/visits/${id}`, data);
}

/**
 * Update visit status (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED).
 */
export async function updateVisitStatus(
  id: number | string,
  status: VisitStatus,
  notes?: string
): Promise<ApiResponse<Visit>> {
  return apiClient.patch<Visit>(`/visits/${id}/status`, {
    status,
    notes,
  });
}

/**
 * Cancel a visit with a reason/note.
 */
export async function cancelVisit(
  id: number | string,
  reason?: string
): Promise<ApiResponse<Visit>> {
  return apiClient.post<Visit>(`/visits/${id}/cancel`, {
    reason,
    notes: reason,
  });
}

/**
 * Delete a visit record.
 */
export async function deleteVisit(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/visits/${id}`);
}
