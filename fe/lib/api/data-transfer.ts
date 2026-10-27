import { apiClient, getBaseUrl, getStoredToken, ApiError, request } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  ImportBatchItem,
  ImportBatchesQueryParams,
  ImportBatchesResponse,
  ImportErrorItem,
  ImportModule,
  ExportType,
  ExportParams,
} from '@/types/data-transfer';

/**
 * Fallback import batches for offline UI development or testing
 */
const fallbackBatches: ImportBatchItem[] = [
  {
    id: 101,
    module: 'products',
    file_name: 'danh_sach_thuoc_thang_10_2026.csv',
    total_rows: 35,
    success_rows: 32,
    error_rows: 3,
    status: 'COMPLETED_WITH_ERRORS',
    imported_by: 1,
    importer: {
      id: 1,
      username: 'admin',
      email: 'admin@qlpk.vn',
    },
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 3.9).toISOString(),
    errors: [
      {
        id: 1,
        batch_id: 101,
        row_number: 14,
        column_name: 'product_code',
        error_message: 'Mã sản phẩm PRD-002 đã tồn tại trong hệ thống.',
        raw_data: {
          product_code: 'PRD-002',
          name: 'Bơm tiêm 5ml dùng 1 lần',
          unit: 'Cái',
          minimum_stock: '50',
          initial_stock: '100',
        },
        created_at: new Date(Date.now() - 3600000 * 3.9).toISOString(),
      },
      {
        id: 2,
        batch_id: 101,
        row_number: 22,
        column_name: 'minimum_stock',
        error_message: 'Định mức tồn tối thiểu không được là số âm (-5).',
        raw_data: {
          product_code: 'PRD-045',
          name: 'Bông y tế vô trùng 500g',
          unit: 'Cuộn',
          minimum_stock: '-5',
          initial_stock: '20',
        },
        created_at: new Date(Date.now() - 3600000 * 3.9).toISOString(),
      },
      {
        id: 3,
        batch_id: 101,
        row_number: 29,
        column_name: 'unit',
        error_message: 'Đơn vị tính không được để trống.',
        raw_data: {
          product_code: 'PRD-048',
          name: 'Nước muối sinh lý 0.9% 500ml',
          unit: '',
          minimum_stock: '30',
          initial_stock: '150',
        },
        created_at: new Date(Date.now() - 3600000 * 3.9).toISOString(),
      },
    ],
  },
  {
    id: 102,
    module: 'patients',
    file_name: 'benh_nhan_doan_kham_cong_ty_sun.csv',
    total_rows: 48,
    success_rows: 48,
    error_rows: 0,
    status: 'COMPLETED',
    imported_by: 1,
    importer: {
      id: 1,
      username: 'admin',
      email: 'admin@qlpk.vn',
    },
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    completed_at: new Date(Date.now() - 86400000 * 2 + 15000).toISOString(),
    errors: [],
  },
  {
    id: 103,
    module: 'services',
    file_name: 'bang_gia_dich_vu_chuyen_khoa_moi.csv',
    total_rows: 20,
    success_rows: 19,
    error_rows: 1,
    status: 'COMPLETED_WITH_ERRORS',
    imported_by: 2,
    importer: {
      id: 2,
      username: 'manager',
      email: 'manager@qlpk.vn',
    },
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    completed_at: new Date(Date.now() - 86400000 * 5 + 8000).toISOString(),
    errors: [
      {
        id: 4,
        batch_id: 103,
        row_number: 8,
        column_name: 'price',
        error_message: 'Giá dịch vụ phải là số nguyên dương hợp lệ.',
        raw_data: {
          service_code: 'DV-999',
          name: 'Chụp X-Quang Tim Phổi',
          price: 'mien_phi',
          duration_minutes: '15',
        },
        created_at: new Date(Date.now() - 86400000 * 5 + 8000).toISOString(),
      },
    ],
  },
];

/**
 * Lấy danh sách lịch sử các đợt Import (có phân trang và bộ lọc)
 * GET /api/v1/imports
 */
export async function getImportBatches(
  params?: ImportBatchesQueryParams
): Promise<ImportBatchesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.module) searchParams.append('module', params.module);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.page) searchParams.append('page', String(params.page));
  if (params?.per_page) searchParams.append('per_page', String(params.per_page));

  const query = searchParams.toString();
  const endpoint = `/imports${query ? `?${query}` : ''}`;

  try {
    const res = await request<ImportBatchItem[]>(endpoint, { method: 'GET' });
    return {
      success: true,
      data: res.data || [],
      meta: (res as unknown as { meta?: ImportBatchesResponse['meta'] }).meta || {
        current_page: params?.page || 1,
        from: 1,
        last_page: 1,
        per_page: params?.per_page || 15,
        to: res.data?.length || 0,
        total: res.data?.length || 0,
      },
    };
  } catch (error) {
    console.warn('API getImportBatches failed, fallback to local dataset:', error);
    let filtered = [...fallbackBatches];
    if (params?.module) {
      filtered = filtered.filter((b) => b.module === params.module);
    }
    if (params?.status) {
      filtered = filtered.filter((b) => b.status === params.status);
    }

    return {
      success: true,
      data: filtered,
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        per_page: 15,
        to: filtered.length,
        total: filtered.length,
      },
    };
  }
}

/**
 * Lấy chi tiết 1 đợt Import kèm danh sách lỗi chi tiết
 * GET /api/v1/imports/{batchId}
 */
export async function getImportBatchDetail(
  batchId: number | string
): Promise<ApiResponse<ImportBatchItem>> {
  try {
    return await request<ImportBatchItem>(`/imports/${batchId}`, { method: 'GET' });
  } catch (error) {
    console.warn(`API getImportBatchDetail(${batchId}) failed, fallback to local item:`, error);
    const found = fallbackBatches.find((b) => String(b.id) === String(batchId));
    if (found) {
      return {
        success: true,
        data: found,
        message: 'Lấy chi tiết đợt import thành công (mock)',
      };
    }
    throw error;
  }
}

/**
 * Tải lên tệp CSV để tiến hành Import dữ liệu theo module
 * POST /api/v1/imports/{module}
 */
export async function uploadImportFile(
  module: ImportModule,
  file: File
): Promise<ApiResponse<ImportBatchItem>> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await request<ImportBatchItem>(`/imports/${module}`, {
      method: 'POST',
      body: formData,
    });
    return res;
  } catch (error) {
    console.warn(`API uploadImportFile (${module}) failed:`, error);
    throw error;
  }
}

/**
 * Tải file CSV mẫu chuẩn header cho module
 * GET /api/v1/imports/templates/{module}
 */
export async function downloadModuleTemplate(module: ImportModule): Promise<void> {
  const baseUrl = getBaseUrl();
  const token = getStoredToken();
  const url = `${baseUrl}/imports/templates/${module}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Tải mẫu CSV thất bại với mã lỗi ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `template_${module}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.warn(`Fetch template failed, generating client-side sample CSV:`, error);
    // Client-side fallback template with UTF-8 BOM
    let content = '';
    const bom = '\uFEFF';
    if (module === 'patients') {
      content =
        bom +
        'patient_code,full_name,date_of_birth,gender,phone,email,address,emergency_contact_name,emergency_contact_phone,notes\n' +
        'BN000001,Nguyễn Văn An,1990-05-15,MALE,0901234567,an.nguyen@example.com,123 Lê Lợi TP.HCM,Trần Thị Mai,0909999888,Tiền sử dị ứng penicillin\n' +
        'BN000002,Trần Thị Bình,1985-11-20,FEMALE,0912345678,binh.tran@example.com,456 Nguyễn Huệ TP.HCM,Trần Văn Cường,0919888777,Khám sức khỏe tổng quát\n';
    } else if (module === 'services') {
      content =
        bom +
        'service_code,name,price,duration_minutes,description,status\n' +
        'DV000001,Khám nội tổng quát,150000,30,Khám lâm sàng và tư vấn ban đầu,ACTIVE\n' +
        'DV000002,Siêu âm tổng quát 4D,250000,20,Khảo sát hình ảnh các cơ quan ổ bụng,ACTIVE\n';
    } else {
      content =
        bom +
        'product_code,name,unit,minimum_stock,initial_stock,status\n' +
        'PRD-001,Paracetamol 500mg,Hộp,20,100,ACTIVE\n' +
        'PRD-002,Bơm tiêm 5ml dùng 1 lần,Cái,50,500,ACTIVE\n';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `template_${module}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Xuất dữ liệu báo cáo ra CSV UTF-8 BOM trực tiếp
 * GET /api/v1/exports/{type}
 */
export async function downloadExportCsv(
  type: ExportType,
  params?: ExportParams
): Promise<void> {
  const baseUrl = getBaseUrl();
  const token = getStoredToken();

  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.append('start_date', params.start_date);
  if (params?.end_date) searchParams.append('end_date', params.end_date);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.gender) searchParams.append('gender', params.gender);
  if (params?.payment_method) searchParams.append('payment_method', params.payment_method);
  if (params?.transaction_type)
    searchParams.append('transaction_type', params.transaction_type);
  if (params?.created_from) searchParams.append('created_from', params.created_from);
  if (params?.created_to) searchParams.append('created_to', params.created_to);

  const query = searchParams.toString();
  const url = `${baseUrl}/exports/${type}${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Xuất file CSV thất bại với mã lỗi ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `export_${type}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.warn(`Export download failed:`, error);
    throw error;
  }
}
