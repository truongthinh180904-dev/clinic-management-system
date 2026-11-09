import { Employee } from './employee';

export interface MedicalRecord {
  id: number;
  visit_id: number;
  doctor_id: number | null;
  medical_history: string | null;
  diagnosis: string;
  indication: string | null;
  result: string | null;
  treatment: string | null;
  follow_up_date: string | null;
  doctor?: Employee | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMedicalRecordInput {
  doctor_id?: number | null;
  medical_history?: string | null;
  diagnosis: string;
  indication?: string | null;
  result?: string | null;
  treatment?: string | null;
  follow_up_date?: string | null;
}

export interface UpdateMedicalRecordInput {
  doctor_id?: number | null;
  medical_history?: string | null;
  diagnosis?: string;
  indication?: string | null;
  result?: string | null;
  treatment?: string | null;
  follow_up_date?: string | null;
  edit_reason?: string | null;
  reason?: string | null;
}

export interface MedicalRecordAuditLog {
  id: number;
  action: string;
  action_label: string;
  user_id: number | null;
  user_name: string;
  user_role?: string | null;
  edit_reason?: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent?: string | null;
  created_at: string;
}
