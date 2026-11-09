import { PaginationMeta } from './auth';
import { Employee } from './employee';
import { Patient } from './patient';
import { Service } from './service';

export type { PaginationMeta };

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface Appointment {
  id: number;
  appointment_code: string;
  patient_id: number;
  employee_id: number;
  service_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  created_by?: number | null;
  patient?: Patient;
  employee?: Employee;
  service?: Service;
  creator?: {
    id: number;
    username: string;
    email: string;
  };
  visits_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateAppointmentInput {
  appointment_code?: string;
  patient_id: number;
  employee_id: number;
  service_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status?: AppointmentStatus;
  notes?: string;
}

export interface UpdateAppointmentInput {
  appointment_code?: string;
  patient_id?: number;
  employee_id?: number;
  service_id?: number;
  appointment_date?: string;
  start_time?: string;
  end_time?: string;
  status?: AppointmentStatus;
  notes?: string;
}

export interface AppointmentQueryParams {
  search?: string;
  q?: string;
  appointment_date?: string;
  from_date?: string;
  to_date?: string;
  employee_id?: number | string;
  patient_id?: number | string;
  service_id?: number | string;
  status?: AppointmentStatus | '';
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export const APPOINTMENT_STATUS_MAP: Record<
  AppointmentStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    icon: '⏳',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    icon: '✅',
  },
  COMPLETED: {
    label: 'Đã khám xong',
    badgeClass:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    icon: '🎉',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
    icon: '❌',
  },
  NO_SHOW: {
    label: 'Không đến',
    badgeClass:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700',
    icon: '🚫',
  },
};
