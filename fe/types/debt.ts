import { PaginationMeta } from './auth';
import { Invoice, Payment, PaymentMethod } from './invoice';
import { Patient } from './patient';

export interface DebtAgingBucket {
  range: string;
  label: string;
  amount: number;
  count: number;
}

export interface DebtAgingGroup extends DebtAgingBucket {
  key: string;
}

export interface DebtAgingSummary {
  '0_to_7_days': DebtAgingBucket;
  '8_to_30_days': DebtAgingBucket;
  'over_30_days': DebtAgingBucket;
}

export interface DebtAgingReceivable {
  '0_to_7': number;
  '8_to_30': number;
  over_30: number;
}

export interface DebtSummary {
  total_invoiced: number;
  total_collected: number;
  total_remaining_debt: number;
  debtor_patients_count: number;
  unpaid_invoices_count: number;
  partial_invoices_count: number;
  paid_invoices_count: number;
  aging: DebtAgingSummary;
  aging_groups: DebtAgingGroup[];
  aging_receivable?: DebtAgingReceivable;
}

export interface DebtorPatient {
  id: number;
  patient_id: number;
  patient_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  total_invoiced: number;
  total_paid: number;
  total_collected: number;
  total_remaining_debt: number;
  remaining_debt: number;
  remaining_amount: number;
  debt_invoices_count: number;
  invoices_count: number;
  latest_debt_date: string | null;
  oldest_debt_date: string | null;
  patient?: {
    id: number;
    patient_code: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    date_of_birth: string | null;
  };
}

export interface PatientDebtSummary {
  total_invoiced: number;
  total_paid: number;
  total_collected: number;
  total_remaining_debt: number;
  remaining_debt: number;
  total_invoices_count: number;
  debt_invoices_count: number;
  unpaid_invoices_count: number;
  partial_invoices_count: number;
  paid_invoices_count: number;
  aging?: DebtAgingSummary;
}

export interface PatientDebtDetail {
  patient: {
    id: number;
    patient_code: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    date_of_birth: string | null;
    address?: string | null;
  };
  summary: PatientDebtSummary;
  invoices: Invoice[];
  payments: Payment[];
}

export interface DebtorPatientsQueryParams {
  search?: string;
  q?: string;
  sort_by?:
    | 'total_remaining_debt'
    | 'total_invoiced'
    | 'total_paid'
    | 'debt_invoices_count'
    | 'latest_debt_date'
    | 'full_name'
    | 'patient_code'
    | 'created_at';
  sort_direction?: 'asc' | 'desc';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface DebtSummaryQueryParams {
  start_date?: string;
  end_date?: string;
  from_date?: string;
  to_date?: string;
  patient_id?: number | string;
}

export interface CollectDebtPaymentInput {
  invoice_id: number;
  amount: number;
  payment_method: PaymentMethod;
  reference_code?: string | null;
  payment_date?: string;
  notes?: string | null;
}
