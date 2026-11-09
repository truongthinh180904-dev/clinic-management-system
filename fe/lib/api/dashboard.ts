import { request } from './client';
import { ApiResponse } from '@/types/auth';
import {
  DashboardSummary,
  RevenueChartPoint,
  VisitTrendsData,
  TopPerformersData,
  DashboardQueryParams,
} from '@/types/dashboard';

function buildQueryString(params?: DashboardQueryParams): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  if (params.start_date) searchParams.append('start_date', params.start_date);
  if (params.end_date) searchParams.append('end_date', params.end_date);
  if (params.days !== undefined) searchParams.append('days', params.days.toString());
  if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function getDashboardSummary(
  params?: DashboardQueryParams
): Promise<ApiResponse<DashboardSummary>> {
  return request<DashboardSummary>(`/dashboard/summary${buildQueryString(params)}`, {
    method: 'GET',
  });
}

export async function getRevenueChart(
  params?: DashboardQueryParams
): Promise<ApiResponse<RevenueChartPoint[]>> {
  return request<RevenueChartPoint[]>(`/dashboard/revenue-chart${buildQueryString(params)}`, {
    method: 'GET',
  });
}

export async function getVisitTrends(
  params?: DashboardQueryParams
): Promise<ApiResponse<VisitTrendsData>> {
  return request<VisitTrendsData>(`/dashboard/visit-trends${buildQueryString(params)}`, {
    method: 'GET',
  });
}

export async function getTopPerformers(
  params?: DashboardQueryParams
): Promise<ApiResponse<TopPerformersData>> {
  return request<TopPerformersData>(`/dashboard/top-performers${buildQueryString(params)}`, {
    method: 'GET',
  });
}
