import { PaginationMeta } from './auth';
import { Patient } from './patient';

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD';

export interface CashTransactionItem {
  id: number;
  transaction_code: string;
  transaction_type: 'IN' | 'OUT';
  reference_type: string;
  reference_id: number;
  amount: number;
  payment_method: PaymentMethod | string;
  transaction_date: string;
  description: string | null;
  created_by?: number | null;
  created_at?: string;
}

export interface PaymentReceiver {
  id: number;
  username: string;
  email?: string;
  employee?: {
    id?: number;
    full_name?: string;
    employee_code?: string;
  } | null;
}

export interface Payment {
  id: number;
  payment_code: string;
  invoice_id: number;
  amount: number;
  payment_method: PaymentMethod;
  reference_code: string | null;
  payment_date: string;
  received_by: number | null;
  notes: string | null;
  invoice?: Invoice | null;
  receiver?: PaymentReceiver | null;
  cash_transactions?: CashTransactionItem[];
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceCreator {
  id: number;
  username: string;
  email?: string;
  employee?: {
    id?: number;
    full_name?: string;
    employee_code?: string;
  } | null;
}

export interface InvoiceVisit {
  id: number;
  visit_code?: string;
  patient_id?: number;
  doctor_id?: number;
  status?: string;
  payment_status?: string;
  check_in_time?: string;
  check_out_time?: string | null;
}

export interface InvoicePatientPackage {
  id: number;
  patient_id?: number;
  package_id?: number;
  package_name?: string;
  package_code?: string;
  total_price?: number;
  package?: {
    id?: number;
    name?: string;
    package_code?: string;
  } | null;
}

export interface Invoice {
  id: number;
  invoice_code: string;
  patient_id: number | null;
  visit_id: number | null;
  patient_package_id: number | null;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: InvoiceStatus;
  issued_at: string;
  created_by: number | null;
  patient?: Patient | null;
  visit?: InvoiceVisit | null;
  patient_package?: InvoicePatientPackage | null;
  creator?: InvoiceCreator | null;
  payments?: Payment[];
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  q?: string;
  status?: InvoiceStatus | string;
  patient_id?: number;
  visit_id?: number;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  sort_direction?: 'asc' | 'desc';
}

export interface CreateInvoiceInput {
  patient_id?: number | null;
  visit_id?: number | null;
  patient_package_id?: number | null;
  invoice_code?: string;
  subtotal_amount: number;
  discount_amount?: number;
  issued_at?: string;
}

export interface UpdateInvoiceInput {
  subtotal_amount?: number;
  discount_amount?: number;
  issued_at?: string;
}

export interface CancelInvoiceInput {
  reason?: string;
}

export interface CreatePaymentInput {
  invoice_id?: number;
  amount: number;
  payment_method: PaymentMethod;
  reference_code?: string | null;
  payment_date?: string;
  notes?: string | null;
  payment_code?: string;
}

export interface InvoiceStats {
  totalInvoiced: number;
  totalCollected: number;
  totalRemaining: number;
  pendingCount: number;
  paidCount: number;
  cancelledCount: number;
  totalCount: number;
}
