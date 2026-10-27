import { PaginationMeta } from './auth';

export type { PaginationMeta };
export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface DuplicateMatchedPatient {
  id: number;
  patient_code: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
}

export interface DuplicateWarning {
  type: 'phone' | 'name_and_dob' | string;
  field: string;
  message: string;
  matched_patients: DuplicateMatchedPatient[];
}

export interface Patient {
  id: number;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  first_visit_date: string | null;
  last_visit_date: string | null;
  status: PatientStatus;
  notes: string | null;
  appointments_count?: number;
  visits_count?: number;
  invoices_count?: number;
  patient_packages_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreatePatientInput {
  patient_code?: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: Gender | string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  first_visit_date?: string | null;
  last_visit_date?: string | null;
  status?: PatientStatus;
  notes?: string | null;
}

export interface UpdatePatientInput extends Partial<CreatePatientInput> {}

export interface PatientQueryParams {
  search?: string;
  q?: string;
  status?: string;
  gender?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface CheckDuplicateInput {
  phone?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  exclude_patient_id?: number | null;
}

export interface CheckDuplicateResponseData {
  has_duplicates: boolean;
  duplicate_warnings: DuplicateWarning[];
}

export interface PatientMutationResponse {
  success: boolean;
  message: string;
  data: Patient;
  duplicate_warnings?: DuplicateWarning[];
  errors?: Record<string, string[]> | null;
}
