export interface DashboardPeriod {
  start_date: string;
  end_date: string;
}

export interface DashboardSummary {
  invoiced_amount: number;
  total_revenue: number;
  collected_amount: number;
  paid_amount: number;
  debt_amount: number;
  total_debt: number;
  remaining_debt: number;
  expense_amount: number;
  approved_expenses: number;
  net_cashflow: number;
  total_visits: number;
  visits_in_period: number;
  visits_today: number;
  appointments_today: number;
  new_patients: number;
  low_stock_products: number;
  low_stock_count: number;
  pending_approvals: number;
  pending_approvals_count: number;
  period: DashboardPeriod;
}

export interface RevenueChartPoint {
  date: string;
  invoiced_amount: number;
  collected_amount: number;
  expense_amount: number;
  net_cashflow: number;
}

export interface VisitDailyTrend {
  date: string;
  total: number;
  waiting: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

export interface VisitStatusDistribution {
  WAITING: number;
  SCHEDULED: number;
  IN_PROGRESS: number;
  COMPLETED: number;
  CANCELLED: number;
  TOTAL: number;
}

export interface VisitTrendsData {
  trends: VisitDailyTrend[];
  daily: VisitDailyTrend[];
  by_status: VisitStatusDistribution;
  status_distribution: VisitStatusDistribution;
  total_visits: number;
}

export interface TopService {
  id: number;
  service_id: number;
  service_code: string;
  name: string;
  service_name: string;
  price: number;
  visit_count: number;
  total_revenue: number;
}

export interface TopPackage {
  id: number;
  package_id: number;
  package_code: string;
  name: string;
  package_name: string;
  price: number;
  sold_count: number;
  purchase_count: number;
  total_revenue: number;
}

export interface TopDoctor {
  id: number;
  employee_id: number;
  doctor_id: number;
  employee_code: string;
  full_name: string;
  doctor_name: string;
  department: string | null;
  position: string | null;
  total_visits: number;
  completed_visits: number;
  total_revenue: number;
}

export interface TopPerformersData {
  top_services: TopService[];
  top_packages: TopPackage[];
  top_doctors: TopDoctor[];
  doctor_performance: TopDoctor[];
}

export interface DashboardQueryParams {
  start_date?: string;
  end_date?: string;
  days?: number;
  limit?: number;
}
