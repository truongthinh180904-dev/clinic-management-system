export type ImportModule = 'patients' | 'services' | 'products';

export type ImportBatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export interface ImportErrorItem {
  id: number;
  batch_id: number;
  row_number: number;
  column_name: string | null;
  error_message: string;
  raw_data?: Record<string, unknown> | unknown[] | string | null;
  created_at?: string | null;
}

export interface ImportBatchItem {
  id: number;
  module: ImportModule;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: ImportBatchStatus;
  imported_by?: number | null;
  importer?: {
    id: number;
    username: string;
    email: string;
  } | null;
  errors?: ImportErrorItem[] | null;
  created_at: string;
  completed_at?: string | null;
}

export interface ImportBatchesQueryParams {
  module?: ImportModule | '';
  status?: ImportBatchStatus | '';
  page?: number;
  per_page?: number;
}

export interface ImportPaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface ImportBatchesResponse {
  success: boolean;
  data: ImportBatchItem[];
  meta: ImportPaginationMeta;
  message?: string;
}

export type ExportType = 'patients' | 'invoices' | 'cashbook' | 'inventory';

export interface ExportParams {
  start_date?: string;
  end_date?: string;
  status?: string;
  gender?: string;
  payment_method?: string;
  transaction_type?: string;
  created_from?: string;
  created_to?: string;
}

export interface ModuleTemplateInfo {
  module: ImportModule;
  label: string;
  description: string;
  sampleColumns: string[];
  filename: string;
}
