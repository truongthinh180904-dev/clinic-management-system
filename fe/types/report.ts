export interface ReportDateRangeParams {
  start_date?: string;
  end_date?: string;
}

export interface InventoryReportParams extends ReportDateRangeParams {
  search?: string;
  q?: string;
  low_stock_only?: boolean | string;
}

// ==========================================
// 1. FINANCIAL REPORT TYPES
// ==========================================

export interface FinancialSummary {
  invoiced_amount: number;
  total_invoiced?: number;
  subtotal_amount: number;
  discount_amount: number;
  collected_amount: number;
  total_collected?: number;
  debt_amount: number;
  new_debt?: number;
  total_debt?: number;
  expense_amount: number;
  total_expenses?: number;
  net_profit: number;
  net_cashflow: number;
  invoices_count: number;
  payments_count: number;
  expenses_count: number;
}

export interface ExpenseByCategory {
  category_id: number | null;
  category_name: string;
  name?: string;
  total_amount: number;
  amount?: number;
  expense_count: number;
  count?: number;
  percentage: number;
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  method?: string;
  collected_amount: number;
  collected?: number;
  expense_amount: number;
  expense?: number;
  net_amount: number;
  net?: number;
  payment_count: number;
  expense_count: number;
}

export interface DailyFinancialPoint {
  date: string;
  invoiced_amount: number;
  collected_amount: number;
  expense_amount: number;
  net_cashflow: number;
  net_profit: number;
}

export interface FinancialReportData {
  summary: FinancialSummary;
  invoiced_amount: number;
  collected_amount: number;
  debt_amount: number;
  expense_amount: number;
  net_profit: number;
  net_cashflow: number;
  expenses_by_category: ExpenseByCategory[];
  by_payment_method: PaymentMethodBreakdown[];
  payment_methods_breakdown?: Record<string, PaymentMethodBreakdown>;
  daily_series: DailyFinancialPoint[];
  daily?: DailyFinancialPoint[];
  period: {
    start_date: string;
    end_date: string;
  };
}

// ==========================================
// 2. CLINICAL REPORT TYPES
// ==========================================

export interface ClinicalSummary {
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  scheduled_appointments: number;
  attended_appointments: number;
  attendance_rate: number;
  total_visits: number;
  completed_visits: number;
  in_progress_visits: number;
  scheduled_visits: number;
  cancelled_visits: number;
  used_package_sessions: number;
  package_sessions_used?: number;
  active_packages_count: number;
  total_revenue: number;
}

export interface DoctorPerformance {
  employee_id: number;
  doctor_id?: number;
  employee_code: string;
  doctor_name: string;
  name?: string;
  position: string;
  total_visits: number;
  visit_count?: number;
  completed_visits: number;
  total_revenue: number;
}

export interface ServiceUtilization {
  service_id: number;
  service_code: string;
  service_name: string;
  name?: string;
  price: number;
  total_visits: number;
  visit_count?: number;
  completed_visits: number;
  total_revenue: number;
}

export interface DailyClinicalPoint {
  date: string;
  appointments_count: number;
  appointments?: number;
  visits_count: number;
  visits?: number;
  completed_visits: number;
}

export interface ClinicalReportData {
  summary: ClinicalSummary;
  appointments: {
    total: number;
    total_appointments?: number;
    completed: number;
    cancelled: number;
    scheduled: number;
    attendance_rate: number;
  };
  attendance_rate: number;
  visits: {
    total: number;
    total_visits?: number;
    completed: number;
    in_progress: number;
    scheduled: number;
    cancelled: number;
    by_status: Record<string, number>;
  };
  visits_by_status: Record<string, number>;
  package_sessions: {
    used_in_period: number;
    used_package_sessions?: number;
    package_sessions_used?: number;
    total_package_sessions_used: number;
    active_packages_count: number;
  };
  used_package_sessions: number;
  package_sessions_used?: number;
  visits_by_doctor: DoctorPerformance[];
  doctors?: DoctorPerformance[];
  visits_by_service: ServiceUtilization[];
  services?: ServiceUtilization[];
  daily_series: DailyClinicalPoint[];
  daily?: DailyClinicalPoint[];
  period: {
    start_date: string;
    end_date: string;
  };
}

// ==========================================
// 3. INVENTORY REPORT TYPES
// ==========================================

export type InventoryStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryItemReport {
  id: number;
  product_id: number;
  product_code: string;
  name: string;
  product_name?: string;
  unit: string;
  minimum_stock: number;
  opening_stock: number;
  in_quantity: number;
  stock_in?: number;
  out_quantity: number;
  stock_out?: number;
  adjust_quantity: number;
  stock_adjust?: number;
  closing_stock: number;
  current_stock?: number;
  status: InventoryStockStatus;
  is_low_stock: boolean;
}

export interface InventoryReportSummary {
  total_products: number;
  total_items?: number;
  total_in_quantity: number;
  total_out_quantity: number;
  total_adjust_quantity: number;
  in_stock_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  in_stock_products?: number;
  low_stock_products?: number;
  out_of_stock_products?: number;
}

export interface InventoryReportData {
  summary: InventoryReportSummary;
  total_products: number;
  total_in_quantity: number;
  total_out_quantity: number;
  total_adjust_quantity: number;
  in_stock_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  items: InventoryItemReport[];
  products?: InventoryItemReport[];
  period: {
    start_date: string;
    end_date: string;
  };
}
