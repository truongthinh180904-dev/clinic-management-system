import { ApiResponse } from '@/types/auth';
import { AuditLog, AuditLogFilterParams, AuditLogMetadata } from '@/types/audit-log';
import { apiClient } from './client';

/**
 * Fetch paginated list of audit logs.
 */
export async function getAuditLogs(
  params?: AuditLogFilterParams
): Promise<ApiResponse<AuditLog[]>> {
  const query = new URLSearchParams();
  if (params?.module) query.set('module', params.module);
  if (params?.action) query.set('action', params.action);
  if (params?.user_id) query.set('user_id', String(params.user_id));
  if (params?.record_id) query.set('record_id', params.record_id);
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.per_page) query.set('per_page', String(params.per_page));
  if (params?.sort_by) query.set('sort_by', params.sort_by);
  if (params?.sort_direction) query.set('order', params.sort_direction);

  const queryString = query.toString();
  const endpoint = `/audit-logs${queryString ? `?${queryString}` : ''}`;
  return apiClient.get<AuditLog[]>(endpoint);
}

/**
 * Fetch detail of a single audit log.
 */
export async function getAuditLog(
  id: number | string
): Promise<ApiResponse<AuditLog>> {
  return apiClient.get<AuditLog>(`/audit-logs/${id}`);
}

/**
 * Fetch audit logs metadata for filter dropdowns.
 */
export async function getAuditLogMetadata(): Promise<ApiResponse<AuditLogMetadata>> {
  return apiClient.get<AuditLogMetadata>('/audit-logs/metadata');
}
