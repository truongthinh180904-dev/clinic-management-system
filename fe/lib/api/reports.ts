import { request } from './client';
import { ApiResponse } from '@/types/auth';
import {
  ReportDateRangeParams,
  InventoryReportParams,
  FinancialReportData,
  ClinicalReportData,
  InventoryReportData,
} from '@/types/report';

function buildDateRangeQuery(params?: ReportDateRangeParams): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  if (params.start_date) searchParams.append('start_date', params.start_date);
  if (params.end_date) searchParams.append('end_date', params.end_date);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * Lấy Báo cáo Quản trị Tài chính & Lợi nhuận
 * GET /api/v1/reports/financial
 */
export async function getFinancialReport(
  params?: ReportDateRangeParams
): Promise<ApiResponse<FinancialReportData>> {
  return request<FinancialReportData>(`/reports/financial${buildDateRangeQuery(params)}`, {
    method: 'GET',
  });
}

/**
 * Lấy Báo cáo Quản trị Hoạt động Khám chữa bệnh
 * GET /api/v1/reports/clinical
 */
export async function getClinicalReport(
  params?: ReportDateRangeParams
): Promise<ApiResponse<ClinicalReportData>> {
  return request<ClinicalReportData>(`/reports/clinical${buildDateRangeQuery(params)}`, {
    method: 'GET',
  });
}

/**
 * Lấy Báo cáo Nhập Xuất Tồn Kho Dược & Vật tư
 * GET /api/v1/reports/inventory
 */
export async function getInventoryReport(
  params?: InventoryReportParams
): Promise<ApiResponse<InventoryReportData>> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.append('start_date', params.start_date);
  if (params?.end_date) searchParams.append('end_date', params.end_date);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.q) searchParams.append('q', params.q);
  if (params?.low_stock_only !== undefined) {
    searchParams.append('low_stock_only', String(params.low_stock_only));
  }
  const query = searchParams.toString();
  const endpoint = `/reports/inventory${query ? `?${query}` : ''}`;

  return request<InventoryReportData>(endpoint, {
    method: 'GET',
  });
}
