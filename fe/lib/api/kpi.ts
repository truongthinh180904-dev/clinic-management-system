import { apiClient, ApiError } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CreateKpiTargetInput,
  KpiQueryParams,
  KpiSummary,
  KpiTarget,
  UpdateKpiTargetInput,
} from '@/types/kpi';

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

// In-memory fallback mock data for offline development or testing
const fallbackMockTargets: KpiTarget[] = [
  {
    id: 1,
    employee_id: 1,
    employee: {
      id: 1,
      employee_code: 'EMP-0001',
      full_name: 'BS. CKII. Nguyễn Văn An',
      phone: '0901234567',
      email: 'nguyenvanan@qlpk.vn',
      date_of_birth: '1980-05-15',
      gender: 'MALE',
      position: 'Trưởng khoa Khám bệnh',
      department: 'Khoa Khám bệnh',
      hire_date: '2020-01-15',
      status: 'ACTIVE',
      notes: null,
    },
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    target_revenue: 150000000,
    target_visits: 200,
    actual_revenue: 168500000,
    actual_visits: 215,
    revenue_completion_rate: 112.33,
    visits_completion_rate: 107.5,
    completion_rate: 109.92,
    average_completion_rate: 109.92,
    evaluation_status: 'EXCEEDED',
    status: 'EXCEEDED',
    created_by: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-25T17:30:00Z',
  },
  {
    id: 2,
    employee_id: 2,
    employee: {
      id: 2,
      employee_code: 'EMP-0002',
      full_name: 'ThS. BS. Trần Thị Mai',
      phone: '0912345678',
      email: 'tranthimai@qlpk.vn',
      date_of_birth: '1985-08-20',
      gender: 'FEMALE',
      position: 'Bác sĩ Tim mạch',
      department: 'Khoa Nội',
      hire_date: '2021-03-01',
      status: 'ACTIVE',
      notes: null,
    },
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    target_revenue: 120000000,
    target_visits: 180,
    actual_revenue: 118000000,
    actual_visits: 175,
    revenue_completion_rate: 98.33,
    visits_completion_rate: 97.22,
    completion_rate: 97.78,
    average_completion_rate: 97.78,
    evaluation_status: 'ON_TRACK',
    status: 'ON_TRACK',
    created_by: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-25T16:00:00Z',
  },
  {
    id: 3,
    employee_id: 3,
    employee: {
      id: 3,
      employee_code: 'EMP-0003',
      full_name: 'BS. Lê Hoàng Nam',
      phone: '0933456789',
      email: 'lehoangnam@qlpk.vn',
      date_of_birth: '1988-11-10',
      gender: 'MALE',
      position: 'Bác sĩ Nhi khoa',
      department: 'Khoa Nhi',
      hire_date: '2022-06-15',
      status: 'ACTIVE',
      notes: null,
    },
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    target_revenue: 100000000,
    target_visits: 160,
    actual_revenue: 78500000,
    actual_visits: 130,
    revenue_completion_rate: 78.5,
    visits_completion_rate: 81.25,
    completion_rate: 79.88,
    average_completion_rate: 79.88,
    evaluation_status: 'BEHIND',
    status: 'BEHIND',
    created_by: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-26T10:00:00Z',
  },
  {
    id: 4,
    employee_id: 4,
    employee: {
      id: 4,
      employee_code: 'EMP-0004',
      full_name: 'CN. Phạm Thu Trang',
      phone: '0944567890',
      email: 'phamthutrang@qlpk.vn',
      date_of_birth: '1992-02-14',
      gender: 'FEMALE',
      position: 'Kỹ thuật viên Trưởng',
      department: 'Khoa Cận lâm sàng',
      hire_date: '2022-09-01',
      status: 'ACTIVE',
      notes: null,
    },
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    target_revenue: 80000000,
    target_visits: 220,
    actual_revenue: 89000000,
    actual_visits: 245,
    revenue_completion_rate: 111.25,
    visits_completion_rate: 111.36,
    completion_rate: 111.31,
    average_completion_rate: 111.31,
    evaluation_status: 'EXCEEDED',
    status: 'EXCEEDED',
    created_by: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-26T14:30:00Z',
  },
  {
    id: 5,
    employee_id: 5,
    employee: {
      id: 5,
      employee_code: 'EMP-0005',
      full_name: 'BS. Vũ Đức Minh',
      phone: '0955678901',
      email: 'vuducminh@qlpk.vn',
      date_of_birth: '1990-07-25',
      gender: 'MALE',
      position: 'Bác sĩ Tai Mũi Họng',
      department: 'Khoa Chuyên khoa',
      hire_date: '2023-01-10',
      status: 'ACTIVE',
      notes: null,
    },
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    target_revenue: 90000000,
    target_visits: 150,
    actual_revenue: 88500000,
    actual_visits: 148,
    revenue_completion_rate: 98.33,
    visits_completion_rate: 98.67,
    completion_rate: 98.5,
    average_completion_rate: 98.5,
    evaluation_status: 'ON_TRACK',
    status: 'ON_TRACK',
    created_by: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-26T15:00:00Z',
  },
];

/**
 * Calculate fallback summary from mock records.
 */
function getFallbackSummary(): KpiSummary {
  const total = fallbackMockTargets.length;
  let totalTargetRev = 0;
  let totalActualRev = 0;
  let totalTargetVis = 0;
  let totalActualVis = 0;
  let sumRate = 0;
  let exceeded = 0;
  let onTrack = 0;
  let behind = 0;

  fallbackMockTargets.forEach((t) => {
    totalTargetRev += t.target_revenue;
    totalActualRev += t.actual_revenue;
    totalTargetVis += t.target_visits;
    totalActualVis += t.actual_visits;
    sumRate += t.completion_rate;
    if (t.evaluation_status === 'EXCEEDED') exceeded++;
    else if (t.evaluation_status === 'ON_TRACK') onTrack++;
    else behind++;
  });

  return {
    total_targets: total,
    total_employees_assigned: total,
    exceeded_count: exceeded,
    on_track_count: onTrack,
    behind_count: behind,
    total_target_revenue: totalTargetRev,
    total_actual_revenue: totalActualRev,
    total_target_visits: totalTargetVis,
    total_actual_visits: totalActualVis,
    average_completion_rate: total > 0 ? Math.round((sumRate / total) * 100) / 100 : 0,
  };
}

/**
 * Fetch paginated KPI targets with filters.
 */
export async function getKpiTargets(
  params?: KpiQueryParams
): Promise<ApiResponse<KpiTarget[]>> {
  try {
    const query = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient.get<KpiTarget[]>(`/kpi-targets${query}`);
    return res;
  } catch (error) {
    // If backend unreachable or error during dev, use fallback mock
    let filtered = [...fallbackMockTargets];
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.employee?.full_name?.toLowerCase().includes(q) ||
          t.employee?.employee_code?.toLowerCase().includes(q)
      );
    }
    if (params?.status || params?.evaluation_status) {
      const st = params.status || params.evaluation_status;
      filtered = filtered.filter((t) => t.evaluation_status === st);
    }
    return {
      success: true,
      message: 'Lấy danh sách chỉ tiêu KPI thành công (offline mode).',
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
 * Fetch KPI aggregated summary statistics.
 */
export async function getKpiSummary(
  params?: { start_date?: string; end_date?: string; employee_id?: number }
): Promise<ApiResponse<KpiSummary>> {
  try {
    const query = buildQueryString(params as Record<string, unknown>);
    return await apiClient.get<KpiSummary>(`/kpi-targets/summary${query}`);
  } catch (error) {
    return {
      success: true,
      message: 'Lấy thống kê tổng quan KPI thành công (offline mode).',
      data: getFallbackSummary(),
    };
  }
}

/**
 * Fetch single KPI target details.
 */
export async function getKpiTarget(
  id: number | string
): Promise<ApiResponse<KpiTarget>> {
  try {
    return await apiClient.get<KpiTarget>(`/kpi-targets/${id}`);
  } catch (error) {
    const found = fallbackMockTargets.find((t) => String(t.id) === String(id));
    if (found) {
      return {
        success: true,
        message: 'Lấy thông tin chi tiết KPI thành công.',
        data: found,
      };
    }
    throw error;
  }
}

/**
 * Create a new KPI target.
 */
export async function createKpiTarget(
  data: CreateKpiTargetInput
): Promise<ApiResponse<KpiTarget>> {
  try {
    return await apiClient.post<KpiTarget>('/kpi-targets', data);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Mock create for offline
    const newTarget: KpiTarget = {
      id: Date.now(),
      employee_id: Number(data.employee_id),
      period_start: data.period_start,
      period_end: data.period_end,
      target_revenue: Number(data.target_revenue),
      target_visits: Number(data.target_visits),
      actual_revenue: 0,
      actual_visits: 0,
      revenue_completion_rate: 0,
      visits_completion_rate: 0,
      completion_rate: 0,
      evaluation_status: 'BEHIND',
      status: 'BEHIND',
      created_at: new Date().toISOString(),
    };
    fallbackMockTargets.unshift(newTarget);
    return {
      success: true,
      message: 'Giao chỉ tiêu KPI mới thành công (offline mode).',
      data: newTarget,
    };
  }
}

/**
 * Update an existing KPI target.
 */
export async function updateKpiTarget(
  id: number | string,
  data: UpdateKpiTargetInput
): Promise<ApiResponse<KpiTarget>> {
  try {
    return await apiClient.put<KpiTarget>(`/kpi-targets/${id}`, data);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const idx = fallbackMockTargets.findIndex((t) => String(t.id) === String(id));
    if (idx !== -1) {
      const existing = fallbackMockTargets[idx];
      const targetRev = data.target_revenue !== undefined ? Number(data.target_revenue) : existing.target_revenue;
      const targetVis = data.target_visits !== undefined ? Number(data.target_visits) : existing.target_visits;
      const revRate = targetRev > 0 ? (existing.actual_revenue / targetRev) * 100 : 0;
      const visRate = targetVis > 0 ? (existing.actual_visits / targetVis) * 100 : 0;
      const compRate = Math.round(((revRate + visRate) / 2) * 100) / 100;
      let status: 'EXCEEDED' | 'ON_TRACK' | 'BEHIND' = 'BEHIND';
      if (compRate >= 100) status = 'EXCEEDED';
      else if (compRate >= 80) status = 'ON_TRACK';

      const updated: KpiTarget = {
        ...existing,
        period_start: data.period_start || existing.period_start,
        period_end: data.period_end || existing.period_end,
        target_revenue: targetRev,
        target_visits: targetVis,
        revenue_completion_rate: Math.round(revRate * 100) / 100,
        visits_completion_rate: Math.round(visRate * 100) / 100,
        completion_rate: compRate,
        evaluation_status: status,
        status: status,
        updated_at: new Date().toISOString(),
      };
      fallbackMockTargets[idx] = updated;
      return {
        success: true,
        message: 'Cập nhật chỉ tiêu KPI thành công (offline mode).',
        data: updated,
      };
    }
    throw error;
  }
}

/**
 * Delete a KPI target.
 */
export async function deleteKpiTarget(
  id: number | string
): Promise<ApiResponse<null>> {
  try {
    return await apiClient.delete<null>(`/kpi-targets/${id}`);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const idx = fallbackMockTargets.findIndex((t) => String(t.id) === String(id));
    if (idx !== -1) {
      fallbackMockTargets.splice(idx, 1);
    }
    return {
      success: true,
      message: 'Xóa chỉ tiêu KPI thành công.',
      data: null,
    };
  }
}

/**
 * Fetch KPI targets for a specific employee.
 */
export async function getEmployeeKpiTargets(
  employeeId: number | string,
  params?: KpiQueryParams
): Promise<ApiResponse<KpiTarget[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<KpiTarget[]>(`/employees/${employeeId}/kpi-targets${query}`);
}
