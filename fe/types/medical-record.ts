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
}
