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

export type UpdatePatientInput = Partial<CreatePatientInput>;

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

export interface PatientTimelineDoctor {
  id: number;
  employee_code: string;
  full_name: string;
  phone?: string | null;
}

export interface PatientTimelineService {
  id: number;
  service_code: string;
  name: string;
  price?: number;
}

export interface PatientTimelineAppointment {
  id: number;
  appointment_code: string;
  appointment_date: string;
  status: string;
}

export interface PatientTimelineMedicalRecord {
  id: number;
  visit_id: number;
  doctor_id?: number | null;
  doctor_name?: string | null;
  medical_history?: string | null;
  diagnosis: string;
  indication?: string | null;
  result?: string | null;
  treatment?: string | null;
  follow_up_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PatientTimelineItem {
  id: number;
  visit_code: string;
  visit_date: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | string;
  quantity?: number;
  unit_price?: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string | null;
  doctor?: PatientTimelineDoctor | null;
  service?: PatientTimelineService | null;
  appointment?: PatientTimelineAppointment | null;
  medical_record?: PatientTimelineMedicalRecord | null;
}

export interface PatientTimelineResponse {
  patient: Patient;
  timeline: PatientTimelineItem[];
  total_visits: number;
}
