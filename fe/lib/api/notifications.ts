import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  AlertRule,
  ApprovalRequest,
  ApprovalRequestsQueryParams,
  Notification,
  NotificationsListResponse,
  NotificationsQueryParams,
  RejectApprovalInput,
  ScanAlertsResponseData,
  StoreAlertRuleInput,
  UpdateAlertRuleInput,
} from '@/types/notification';

/**
 * Build URL query string from parameter object.
 */
function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// ==========================================
// NOTIFICATIONS API
// ==========================================

/**
 * Fetch notifications for the authenticated user with unread count and pagination.
 */
export async function getNotifications(
  params?: NotificationsQueryParams
): Promise<NotificationsListResponse> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<Notification[]>(`/notifications${query}`) as unknown as Promise<NotificationsListResponse>;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(
  id: number
): Promise<ApiResponse<Notification>> {
  return apiClient.patch<Notification>(`/notifications/${id}/read`);
}

/**
 * Mark all unread notifications of the authenticated user as read.
 */
export async function markAllNotificationsAsRead(): Promise<
  ApiResponse<{ updated_count: number }>
> {
  return apiClient.post<{ updated_count: number }>('/notifications/read-all');
}

/**
 * Delete a notification.
 */
export async function deleteNotification(
  id: number
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/notifications/${id}`);
}

// ==========================================
// ALERT RULES & SCAN API
// ==========================================

/**
 * Fetch all configured alert rules.
 */
export async function getAlertRules(params?: {
  status?: string;
  alert_type?: string;
}): Promise<ApiResponse<AlertRule[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<AlertRule[]>(`/alert-rules${query}`);
}

/**
 * Create a new automated alert rule.
 */
export async function createAlertRule(
  data: StoreAlertRuleInput
): Promise<ApiResponse<AlertRule>> {
  return apiClient.post<AlertRule>('/alert-rules', data);
}

/**
 * Update an existing alert rule.
 */
export async function updateAlertRule(
  id: number,
  data: UpdateAlertRuleInput
): Promise<ApiResponse<AlertRule>> {
  return apiClient.put<AlertRule>(`/alert-rules/${id}`, data);
}

/**
 * Delete an alert rule.
 */
export async function deleteAlertRule(
  id: number
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/alert-rules/${id}`);
}

/**
 * Trigger an on-demand scan of active alert rules.
 */
export async function triggerAlertScan(): Promise<
  ApiResponse<ScanAlertsResponseData>
> {
  return apiClient.post<ScanAlertsResponseData>('/alerts/scan');
}

// ==========================================
// APPROVAL REQUESTS WORKFLOW API
// ==========================================

/**
 * Fetch approval requests with filtering, searching, and pagination.
 */
export async function getApprovalRequests(
  params?: ApprovalRequestsQueryParams
): Promise<ApiResponse<ApprovalRequest[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<ApprovalRequest[]>(`/approval-requests${query}`);
}

/**
 * Fetch single approval request detail.
 */
export async function getApprovalRequest(
  id: number
): Promise<ApiResponse<ApprovalRequest>> {
  return apiClient.get<ApprovalRequest>(`/approval-requests/${id}`);
}

/**
 * Approve a pending approval request.
 */
export async function approveApprovalRequest(
  id: number
): Promise<ApiResponse<ApprovalRequest>> {
  return apiClient.post<ApprovalRequest>(`/approval-requests/${id}/approve`);
}

/**
 * Reject a pending approval request with reason.
 */
export async function rejectApprovalRequest(
  id: number,
  input: RejectApprovalInput
): Promise<ApiResponse<ApprovalRequest>> {
  return apiClient.post<ApprovalRequest>(`/approval-requests/${id}/reject`, input);
}
