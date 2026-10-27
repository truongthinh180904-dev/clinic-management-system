import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CreateMedicalRecordInput,
  MedicalRecord,
  UpdateMedicalRecordInput,
} from '@/types/medical-record';

/**
 * Fetch medical record for a specific visit.
 */
export async function getVisitMedicalRecord(
  visitId: number | string
): Promise<ApiResponse<MedicalRecord>> {
  return apiClient.get<MedicalRecord>(`/visits/${visitId}/medical-record`);
}

/**
 * Create a medical record for a visit.
 */
export async function createVisitMedicalRecord(
  visitId: number | string,
  data: CreateMedicalRecordInput
): Promise<ApiResponse<MedicalRecord>> {
  return apiClient.post<MedicalRecord>(`/visits/${visitId}/medical-record`, data);
}

/**
 * Update medical record for a visit.
 */
export async function updateVisitMedicalRecord(
  visitId: number | string,
  data: UpdateMedicalRecordInput
): Promise<ApiResponse<MedicalRecord>> {
  return apiClient.put<MedicalRecord>(`/visits/${visitId}/medical-record`, data);
}

/**
 * Fetch medical record by its own ID.
 */
export async function getMedicalRecord(
  id: number | string
): Promise<ApiResponse<MedicalRecord>> {
  return apiClient.get<MedicalRecord>(`/medical-records/${id}`);
}

/**
 * Update medical record by its own ID.
 */
export async function updateMedicalRecord(
  id: number | string,
  data: UpdateMedicalRecordInput
): Promise<ApiResponse<MedicalRecord>> {
  return apiClient.put<MedicalRecord>(`/medical-records/${id}`, data);
}
