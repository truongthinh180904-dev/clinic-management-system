import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import { PaginatedResponse } from '@/types/employee';
import {
  Appointment,
  AppointmentQueryParams,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@/types/appointment';

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
 * Fetch paginated list of appointments with search and filters.
 */
export async function getAppointments(
  params?: AppointmentQueryParams
): Promise<PaginatedResponse<Appointment>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<Appointment[]>(`/appointments${query}`);
  return res as unknown as PaginatedResponse<Appointment>;
}

/**
 * Fetch detailed appointment by ID.
 */
export async function getAppointment(
  id: number | string
): Promise<ApiResponse<Appointment>> {
  return apiClient.get<Appointment>(`/appointments/${id}`);
}

/**
 * Create a new appointment booking.
 */
export async function createAppointment(
  data: CreateAppointmentInput
): Promise<ApiResponse<Appointment>> {
  return apiClient.post<Appointment>('/appointments', data);
}

/**
 * Update an existing appointment.
 */
export async function updateAppointment(
  id: number | string,
  data: UpdateAppointmentInput
): Promise<ApiResponse<Appointment>> {
  return apiClient.put<Appointment>(`/appointments/${id}`, data);
}

/**
 * Update appointment status (CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, PENDING).
 */
export async function updateAppointmentStatus(
  id: number | string,
  status: AppointmentStatus,
  notes?: string
): Promise<ApiResponse<Appointment>> {
  return apiClient.patch<Appointment>(`/appointments/${id}/status`, {
    status,
    notes,
  });
}

/**
 * Cancel an appointment with a reason/note.
 */
export async function cancelAppointment(
  id: number | string,
  reason?: string
): Promise<ApiResponse<Appointment>> {
  return apiClient.post<Appointment>(`/appointments/${id}/cancel`, {
    reason,
    notes: reason,
  });
}

/**
 * Atomically check in a confirmed appointment into a clinic visit.
 */
export async function checkInAppointment(
  id: number | string,
  payload?: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  return apiClient.post(`/appointments/${id}/check-in`, payload || {});
}

/**
 * Delete an appointment record.
 */
export async function deleteAppointment(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/appointments/${id}`);
}
