import { ApiResponse, PaginationMeta } from './auth';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD';
export type CashTransactionType = 'IN' | 'OUT';
export type ExpenseApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CashTransactionCreator {
  id: number;
  name?: string;
  username?: string;
  email?: string;
  employee?: {
    id?: number;
    employee_code?: string;
    full_name: string;
  } | null;
}

export interface CashTransaction {
  id: number;
  transaction_code: string;
  transaction_type: CashTransactionType;
  reference_type: string | null;
  reference_id: number | null;
  amount: number;
  payment_method: PaymentMethod;
  transaction_date: string;
  description: string | null;
  created_by?: number | null;
  creator?: CashTransactionCreator | null;
  created_at: string | null;
}

export interface CashbookMethodBreakdown {
  opening_balance: number;
  total_in: number;
  total_out: number;
  net_change: number;
  closing_balance: number;
}

export interface CashbookSummary {
  period?: {
    start_date: string | null;
    end_date: string | null;
  };
  opening_balance: number;
  total_in: number;
  total_out: number;
  net_change: number;
  closing_balance: number;
  by_payment_method: {
    CASH: CashbookMethodBreakdown;
    BANK_TRANSFER: CashbookMethodBreakdown;
    CARD: CashbookMethodBreakdown;
    [key: string]: CashbookMethodBreakdown;
  };
}

export interface CashTransactionsQueryParams {
  transaction_type?: CashTransactionType | '';
  payment_method?: PaymentMethod | '';
  reference_type?: string;
  reference_id?: number | string;
  transaction_date?: string;
  start_date?: string;
  end_date?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  q?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface CreateCashTransactionInput {
  transaction_code?: string;
  transaction_type: CashTransactionType;
  amount: number;
  payment_method: PaymentMethod;
  transaction_date?: string;
  description?: string;
  reference_type?: string | null;
  reference_id?: number | null;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  expenses_count?: number;
  total_amount?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateExpenseCategoryInput {
  name: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface Expense {
  id: number;
  expense_code: string;
  category_id: number;
  amount: number;
  payment_method: PaymentMethod;
  expense_date: string;
  description: string | null;
  approval_status: ExpenseApprovalStatus;
  created_by?: number | null;
  approved_by?: number | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  category?: ExpenseCategory | null;
  creator?: CashTransactionCreator | null;
  approver?: CashTransactionCreator | null;
  cash_transactions?: CashTransaction[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateExpenseInput {
  category_id: number;
  amount: number;
  payment_method: PaymentMethod;
  expense_date: string;
  description?: string;
}

export interface UpdateExpenseInput {
  category_id?: number;
  amount?: number;
  payment_method?: PaymentMethod;
  expense_date?: string;
  description?: string;
}

export interface ExpensesQueryParams {
  category_id?: number | string;
  approval_status?: ExpenseApprovalStatus | '';
  payment_method?: PaymentMethod | '';
  start_date?: string;
  end_date?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  q?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ApproveExpenseInput {
  notes?: string;
}

export interface RejectExpenseInput {
  reason: string;
}

export interface CashflowChartDataPoint {
  date: string;
  displayDate: string;
  totalIn: number;
  totalOut: number;
  netFlow: number;
  accumulatedBalance?: number;
}
