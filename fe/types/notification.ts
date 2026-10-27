import { ApiResponse, PaginationMeta, User } from './auth';

/**
 * Types of system notifications and alerts.
 */
export type NotificationType =
  | 'LOW_STOCK'
  | 'PACKAGE_EXPIRING'
  | 'OVERDUE_INVOICE'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_STATUS'
  | 'SYSTEM'
  | string;

/**
 * Single user notification record.
 */
export interface Notification {
  id: number;
  user_id: number;
  user?: Partial<User> | null;
  type: NotificationType;
  title: string;
  message: string;
  reference_type?: string | null;
  reference_id?: number | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

/**
 * Query parameters for fetching user notifications.
 */
export interface NotificationsQueryParams {
  unread_only?: boolean | number | string;
  type?: string;
  page?: number;
  per_page?: number;
}

/**
 * Notification listing response with unread count and pagination.
 */
export interface NotificationsListResponse extends ApiResponse<Notification[]> {
  unread_count: number;
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

/**
 * Types of automated alert rules.
 */
export type AlertRuleType =
  | 'LOW_STOCK'
  | 'PACKAGE_EXPIRING'
  | 'OVERDUE_INVOICE'
  | string;

export type AlertRuleStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Configuration of an automated alert rule.
 */
export interface AlertRule {
  id: number;
  name: string;
  alert_type: AlertRuleType;
  threshold_value?: number | null;
  threshold_days?: number | null;
  threshold_sessions?: number | null;
  status: AlertRuleStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StoreAlertRuleInput {
  name: string;
  alert_type: AlertRuleType;
  threshold_value?: number | null;
  threshold_days?: number | null;
  threshold_sessions?: number | null;
  status?: AlertRuleStatus;
}

export interface UpdateAlertRuleInput {
  name?: string;
  alert_type?: AlertRuleType;
  threshold_value?: number | null;
  threshold_days?: number | null;
  threshold_sessions?: number | null;
  status?: AlertRuleStatus;
}

/**
 * Response summary when triggering an on-demand alert scan.
 */
export interface ScanAlertsResponseData {
  scanned_rules_count: number;
  notifications_created: number;
  details?: {
    low_stock_alerts: number;
    package_expiring_alerts: number;
    overdue_invoice_alerts: number;
  };
}

/**
 * Types of centralized approval requests.
 */
export type ApprovalRequestType =
  | 'EXPENSE_APPROVAL'
  | 'INVOICE_CANCEL'
  | 'STOCK_ADJUST'
  | string;

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Attached Expense reference payload inside an approval request.
 */
export interface ApprovalExpenseReference {
  id: number;
  expense_code: string;
  category_id?: number;
  category?: {
    id: number;
    name: string;
  } | null;
  amount: number;
  payment_method?: string;
  expense_date?: string | null;
  description?: string | null;
  approval_status: string;
  created_by?: number;
  approved_by?: number | null;
  approved_at?: string | null;
}

/**
 * Approval request entity.
 */
export interface ApprovalRequest {
  id: number;
  request_type: ApprovalRequestType;
  reference_type?: string | null;
  reference_id?: number | null;
  requested_by?: number | null;
  approved_by?: number | null;
  status: ApprovalStatus;
  reason?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  approved_at?: string | null;
  requester?: {
    id: number;
    username: string;
    email?: string;
    employee?: {
      id: number;
      full_name: string;
    } | null;
  } | null;
  approver?: {
    id: number;
    username: string;
    email?: string;
    employee?: {
      id: number;
      full_name: string;
    } | null;
  } | null;
  reference?: ApprovalExpenseReference | Record<string, unknown> | null;
  expense?: ApprovalExpenseReference | null;
}

/**
 * Query parameters for filtering approval requests.
 */
export interface ApprovalRequestsQueryParams {
  status?: ApprovalStatus | '';
  request_type?: string;
  reference_type?: string;
  reference_id?: number;
  requested_by?: number;
  approved_by?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

/**
 * Rejection reason payload.
 */
export interface RejectApprovalInput {
  rejection_reason: string;
}
