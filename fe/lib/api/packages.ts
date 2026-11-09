import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import { PaginatedResponse } from '@/types/employee';
import {
  AssignPackageInput,
  CreatePackageInput,
  PackageQueryParams,
  PatientPackage,
  ServicePackage,
  UpdatePackageInput,
} from '@/types/package';

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
 * Fetch paginated list of catalog service packages.
 */
export async function getServicePackages(
  params?: PackageQueryParams
): Promise<PaginatedResponse<ServicePackage>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<ServicePackage[]>(`/service-packages${query}`);
  return res as unknown as PaginatedResponse<ServicePackage>;
}

/**
 * Fetch catalog service package details.
 */
export async function getServicePackage(
  id: number | string
): Promise<ApiResponse<ServicePackage>> {
  return apiClient.get<ServicePackage>(`/service-packages/${id}`);
}

/**
 * Create a new service package in catalog.
 */
export async function createServicePackage(
  data: CreatePackageInput
): Promise<ApiResponse<ServicePackage>> {
  return apiClient.post<ServicePackage>('/service-packages', data);
}

/**
 * Update a service package.
 */
export async function updateServicePackage(
  id: number | string,
  data: UpdatePackageInput
): Promise<ApiResponse<ServicePackage>> {
  return apiClient.put<ServicePackage>(`/service-packages/${id}`, data);
}

/**
 * Update catalog package status.
 */
export async function updateServicePackageStatus(
  id: number | string,
  status: string
): Promise<ApiResponse<ServicePackage>> {
  return apiClient.patch<ServicePackage>(`/service-packages/${id}/status`, { status });
}

/**
 * Delete a catalog package.
 */
export async function deleteServicePackage(
  id: number | string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/service-packages/${id}`);
}

/**
 * Assign a package to a patient.
 */
export async function assignPackageToPatient(
  patientId: number | string,
  data: AssignPackageInput
): Promise<ApiResponse<PatientPackage>> {
  return apiClient.post<PatientPackage>(`/patients/${patientId}/packages`, data);
}

/**
 * Get packages assigned to a specific patient.
 */
export async function getPatientPackages(
  patientId: number | string,
  params?: { status?: string; page?: number; per_page?: number }
): Promise<PaginatedResponse<PatientPackage>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<PatientPackage[]>(`/patients/${patientId}/packages${query}`);
  return res as unknown as PaginatedResponse<PatientPackage>;
}

/**
 * Get detail of an assigned patient package by ID.
 */
export async function getPatientPackage(
  id: number | string
): Promise<ApiResponse<PatientPackage>> {
  return apiClient.get<PatientPackage>(`/patient-packages/${id}`);
}

/**
 * Update status of an assigned patient package.
 */
export async function updatePatientPackageStatus(
  id: number | string,
  status: string
): Promise<ApiResponse<PatientPackage>> {
  return apiClient.patch<PatientPackage>(`/patient-packages/${id}/status`, { status });
}

/**
 * Get all patient packages assigned clinic-wide with search and filters.
 */
export async function getAllPatientPackages(
  params?: {
    search?: string;
    status?: string;
    patient_id?: number;
    page?: number;
    per_page?: number;
  }
): Promise<PaginatedResponse<PatientPackage>> {
  const query = buildQueryString(params as Record<string, unknown>);
  const res = await apiClient.get<PatientPackage[]>(`/patient-packages${query}`);
  return res as unknown as PaginatedResponse<PatientPackage>;
}
