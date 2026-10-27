import { PaginationMeta } from './auth';
import { Employee } from './employee';
import { Patient } from './patient';
import { Service } from './service';
import { PatientPackage } from './package';
import { Appointment } from './appointment';
import { MedicalRecord } from './medical-record';

export type VisitStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type VisitPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export interface Visit {
  id: number;
  visit_code: string;
  patient_id: number;
  employee_id: number;
  service_id: number;
  patient_package_id: number | null;
  appointment_id: number | null;
  visit_date: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_amount: number;
  payment_status: VisitPaymentStatus;
  status: VisitStatus;
  notes: string | null;
  created_by?: number | null;
  patient?: Patient;
  employee?: Employee;
  service?: Service;
  patient_package?: PatientPackage | null;
  appointment?: Appointment | null;
  creator?: {
    id: number;
    username: string;
    email: string;
  };
  medical_record?: MedicalRecord | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateVisitInput {
  visit_code?: string;
  patient_id: number;
  employee_id: number;
  service_id: number;
  patient_package_id?: number | null;
  appointment_id?: number | null;
  visit_date: string;
  quantity?: number;
  unit_price?: number;
  discount_amount?: number;
  status?: VisitStatus;
  payment_status?: VisitPaymentStatus;
  notes?: string;
}

export interface UpdateVisitInput {
  patient_id?: number;
  employee_id?: number;
  service_id?: number;
  patient_package_id?: number | null;
  appointment_id?: number | null;
  visit_date?: string;
  quantity?: number;
  unit_price?: number;
  discount_amount?: number;
  status?: VisitStatus;
  payment_status?: VisitPaymentStatus;
  notes?: string;
}

export interface VisitQueryParams {
  search?: string;
  q?: string;
  visit_date?: string;
  from_date?: string;
  to_date?: string;
  patient_id?: number | string;
  employee_id?: number | string;
  service_id?: number | string;
  status?: VisitStatus | '';
  payment_status?: VisitPaymentStatus | '';
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export const VISIT_STATUS_MAP: Record<
  VisitStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  SCHEDULED: {
    label: 'Đã lên lịch',
    badgeClass:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    icon: '⏳',
  },
  IN_PROGRESS: {
    label: 'Đang khám',
    badgeClass:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    icon: '🩺',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    badgeClass:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    icon: '✅',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
    icon: '❌',
  },
};

export const PAYMENT_STATUS_MAP: Record<
  VisitPaymentStatus,
  { label: string; badgeClass: string }
> = {
  UNPAID: {
    label: 'Chưa thanh toán',
    badgeClass:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  },
  PARTIALLY_PAID: {
    label: 'Thanh toán một phần',
    badgeClass:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  PAID: {
    label: 'Đã thanh toán',
    badgeClass:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  REFUNDED: {
    label: 'Đã hoàn tiền',
    badgeClass:
      'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800',
  },
};
