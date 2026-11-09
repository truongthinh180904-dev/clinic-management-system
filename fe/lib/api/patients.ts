import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CheckDuplicateInput,
  CheckDuplicateResponseData,
  CreatePatientInput,
  Patient,
  PatientMutationResponse,
  PatientQueryParams,
  PatientStatus,
  PatientTimelineResponse,
  UpdatePatientInput,
} from '@/types/patient';
import { PaginatedResponse } from '@/types/employee';

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
 * Fetch paginated list of patients with search and filters.
 */
export async function getPatients(
  params?: PatientQueryParams
): Promise<PaginatedResponse<Patient>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<Patient[]>(`/patients${query}`);
  return res as unknown as PaginatedResponse<Patient>;
}

/**
 * Fetch patient profile details by ID.
 */
export async function getPatient(
  id: number | string
): Promise<ApiResponse<Patient>> {
  return apiClient.get<Patient>(`/patients/${id}`);
}

/**
 * Create a new patient record.
 */
export async function createPatient(
  data: CreatePatientInput
): Promise<PatientMutationResponse> {
  const res = await apiClient.post<Patient>('/patients', data);
  return res as unknown as PatientMutationResponse;
}

/**
 * Update an existing patient record.
 */
export async function updatePatient(
  id: number | string,
  data: UpdatePatientInput
): Promise<PatientMutationResponse> {
  const res = await apiClient.put<Patient>(`/patients/${id}`, data);
  return res as unknown as PatientMutationResponse;
}

/**
 * Quick update of patient status (ACTIVE, INACTIVE, LOCKED).
 */
export async function updatePatientStatus(
  id: number | string,
  status: PatientStatus,
  notes?: string
): Promise<ApiResponse<Patient>> {
  return apiClient.patch<Patient>(`/patients/${id}/status`, { status, notes });
}

/**
 * Delete a patient record.
 */
export async function deletePatient(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/patients/${id}`);
}

/**
 * Pre-check potential duplicate patient records (phone or name + DOB match).
 */
export async function checkDuplicatePatients(
  data: CheckDuplicateInput
): Promise<ApiResponse<CheckDuplicateResponseData>> {
  return apiClient.post<CheckDuplicateResponseData>('/patients/check-duplicates', data);
}

/**
 * Fetch patient chronological clinical history timeline.
 */
export async function getPatientTimeline(
  id: number | string
): Promise<ApiResponse<PatientTimelineResponse>> {
  return apiClient.get<PatientTimelineResponse>(`/patients/${id}/timeline`);
}
