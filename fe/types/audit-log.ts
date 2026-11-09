export interface AuditLogUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user: AuditLogUser | null;
  module: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogFilterParams {
  module?: string;
  action?: string;
  user_id?: number | string;
  record_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface AuditLogMetadata {
  modules: string[];
  actions: string[];
}
