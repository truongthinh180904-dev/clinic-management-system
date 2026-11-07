import { request } from './client';

export interface SqlParameter {
  name: string;
  type: string;
  direction: 'IN' | 'OUT';
  description: string;
}

export interface SqlObject {
  id: string;
  name: string;
  type: 'PROCEDURE' | 'TRIGGER' | 'FUNCTION' | 'CURSOR';
  title: string;
  module: 'appointments' | 'patients' | 'invoices' | 'inventory' | 'reports';
  module_label: string;
  purpose: string;
  target_tables: string[];
  target_columns: string[];
  trigger_event?: string;
  parameters?: SqlParameter[];
  sql_definition: string;
  sql_invocation: string;
  status: string;
}

export interface AuditLogItem {
  id: number;
  executed_at: string;
  sql_object_name: string;
  sql_object_type: 'PROCEDURE' | 'TRIGGER' | 'FUNCTION' | 'CURSOR';
  target_table: string;
  action_type: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  status: 'SUCCESS' | 'FAILED' | 'VERIFIED';
  execution_message: string;
  executed_by_name: string;
  duration_ms: number;
}

export interface ExecutionResult {
  success: boolean;
  object_name: string;
  object_type: string;
  status: string;
  message: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  result_rows?: unknown[];
  duration_ms: number;
}

export interface DemoStats {
  total_objects: number;
  procedures: number;
  triggers: number;
  functions: number;
  cursors: number;
  total_executions: number;
  last_execution: AuditLogItem | null;
  modules_distribution: Record<string, number>;
}

/**
 * Lấy danh sách các đối tượng SQL (có thể lọc theo module).
 */
export async function getDatabaseDemoObjects(module?: string): Promise<SqlObject[]> {
  const query = module ? `?module=${encodeURIComponent(module)}` : '';
  try {
    const res = await request<SqlObject[]>(`/database-demo/objects${query}`, {
      method: 'GET',
    });
    return res.data || [];
  } catch (err) {
    console.error('Error fetching database demo objects:', err);
    return [];
  }
}

/**
 * Lấy chi tiết một đối tượng SQL theo tên.
 */
export async function getDatabaseDemoObject(name: string): Promise<SqlObject | null> {
  try {
    const res = await request<SqlObject>(`/database-demo/objects/${encodeURIComponent(name)}`, {
      method: 'GET',
    });
    return res.data || null;
  } catch {
    return null;
  }
}

/**
 * Thực thi câu lệnh SQL DEMO trong chế độ an toàn.
 */
export async function executeDatabaseDemo(
  objectName: string,
  params: Record<string, unknown> = {}
): Promise<ExecutionResult> {
  try {
    const res = await request<ExecutionResult>('/database-demo/execute', {
      method: 'POST',
      body: {
        object_name: objectName,
        params,
      },
    });

    if (res.data) {
      return res.data;
    }

    return {
      success: false,
      object_name: objectName,
      object_type: 'UNKNOWN',
      status: 'FAILED',
      message: res.message || 'Không thể thực thi câu lệnh SQL.',
      before_data: null,
      after_data: null,
      duration_ms: 0,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Lỗi kết nối khi thực thi câu lệnh SQL.';
    return {
      success: false,
      object_name: objectName,
      object_type: 'UNKNOWN',
      status: 'FAILED',
      message: errMsg,
      before_data: null,
      after_data: null,
      duration_ms: 0,
    };
  }
}

/**
 * Lấy lịch sử theo dõi thay đổi dữ liệu (Audit Logs).
 */
export async function getDatabaseDemoHistory(limit = 50): Promise<AuditLogItem[]> {
  try {
    const res = await request<AuditLogItem[]>(`/database-demo/history?limit=${limit}`, {
      method: 'GET',
    });
    return res.data || [];
  } catch (err) {
    console.error('Error fetching database demo history:', err);
    return [];
  }
}

/**
 * Lấy thống kê số lượng đối tượng và tình hình demo.
 */
export async function getDatabaseDemoStats(): Promise<DemoStats | null> {
  try {
    const res = await request<DemoStats>('/database-demo/stats', {
      method: 'GET',
    });
    return res.data || null;
  } catch {
    return null;
  }
}
