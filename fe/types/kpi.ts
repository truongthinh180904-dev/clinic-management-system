import { Employee } from './employee';
import { ApiResponse, PaginationMeta, User } from './auth';

export type KpiEvaluationStatus = 'EXCEEDED' | 'ON_TRACK' | 'BEHIND';

export interface KpiTarget {
  id: number;
  employee_id: number;
  employee?: Employee | null;
  period_start: string;
  period_end: string;
  target_revenue: number;
  target_visits: number;
  actual_revenue: number;
  actual_visits: number;
  revenue_completion_rate: number;
  visits_completion_rate: number;
  completion_rate: number;
  average_completion_rate?: number;
  evaluation_status: KpiEvaluationStatus;
  status: KpiEvaluationStatus;
  created_by?: number | null;
  creator?: User | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface KpiSummary {
  total_targets: number;
  total_employees_assigned: number;
  exceeded_count: number;
  on_track_count: number;
  behind_count: number;
  total_target_revenue: number;
  total_actual_revenue: number;
  total_target_visits: number;
  total_actual_visits: number;
  average_completion_rate: number;
}

export interface CreateKpiTargetInput {
  employee_id: number;
  period_start: string;
  period_end: string;
  target_revenue: number;
  target_visits: number;
}

export interface UpdateKpiTargetInput {
  employee_id?: number;
  period_start?: string;
  period_end?: string;
  target_revenue?: number;
  target_visits?: number;
}

export interface KpiQueryParams {
  employee_id?: number;
  start_date?: string;
  end_date?: string;
  period_start?: string;
  period_end?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  q?: string;
  status?: string;
  evaluation_status?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface KpiChartComparisonItem {
  id: number;
  employee_name: string;
  employee_code: string;
  department: string;
  target_revenue: number;
  actual_revenue: number;
  revenue_rate: number;
  target_visits: number;
  actual_visits: number;
  visits_rate: number;
  completion_rate: number;
  evaluation_status: KpiEvaluationStatus;
}
