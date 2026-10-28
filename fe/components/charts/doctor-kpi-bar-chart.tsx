'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  BarChart2,
  DollarSign,
  Activity,
  Award,
  Filter,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface DoctorKpiItem {
  id?: number | string;
  name: string;
  fullName?: string;
  code?: string;
  department?: string;
  target_revenue: number;
  actual_revenue: number;
  target_visits: number;
  actual_visits: number;
  revenue_completion_rate?: number;
  visits_completion_rate?: number;
  completion_rate?: number;
  evaluation_status?: 'EXCEEDED' | 'ON_TRACK' | 'BEHIND' | string;
}

export interface DoctorKpiBarChartProps {
  data: DoctorKpiItem[];
  title?: string;
  description?: string;
  height?: number;
  metric?: 'both' | 'revenue' | 'visits';
  showReferenceLines?: boolean;
  className?: string;
}

// Format short currency for chart axis (e.g. 50Tr, 1.2B)
function formatShortCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}Tr`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

// Medical SaaS Color Palette
const COLORS = {
  targetRevenue: '#3b82f6', // Medical Blue
  actualRevenue: '#10b981', // Emerald Success
  targetVisits: '#f59e0b',  // Amber Target
  actualVisits: '#8b5cf6',  // Purple Visits
  benchmarkLine: '#ef4444', // Red Benchmark
  avgTargetLine: '#6366f1', // Indigo Reference
};

export function DoctorKpiBarChart({
  data,
  title = 'So sánh Hiệu suất Bác sĩ vs Chỉ tiêu KPI',
  description = 'Đối chiếu đa chiều doanh thu và lượt khám thực đạt với hạn mức mục tiêu',
  height = 360,
  metric = 'both',
  showReferenceLines = true,
  className,
}: DoctorKpiBarChartProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [selectedMetric, setSelectedMetric] = useState<'both' | 'revenue' | 'visits'>(metric);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSelectedMetric(metric);
  }, [metric]);

  // Extract distinct departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => {
      if (item.department) {
        set.add(item.department);
      }
    });
    return Array.from(set);
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (departmentFilter === 'ALL') return data;
    return data.filter((item) => item.department === departmentFilter);
  }, [data, departmentFilter]);

  // Calculate Reference Line statistics
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        avgTargetRevenue: 0,
        avgActualRevenue: 0,
        avgTargetVisits: 0,
        avgActualVisits: 0,
      };
    }
    const sumTargetRev = filteredData.reduce((acc, curr) => acc + (Number(curr.target_revenue) || 0), 0);
    const sumActualRev = filteredData.reduce((acc, curr) => acc + (Number(curr.actual_revenue) || 0), 0);
    const sumTargetVis = filteredData.reduce((acc, curr) => acc + (Number(curr.target_visits) || 0), 0);
    const sumActualVis = filteredData.reduce((acc, curr) => acc + (Number(curr.actual_visits) || 0), 0);

    return {
      avgTargetRevenue: Math.round(sumTargetRev / filteredData.length),
      avgActualRevenue: Math.round(sumActualRev / filteredData.length),
      avgTargetVisits: Math.round(sumTargetVis / filteredData.length),
      avgActualVisits: Math.round(sumActualVis / filteredData.length),
    };
  }, [filteredData]);

  if (!isMounted) {
    return (
      <div
        style={{ height }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl bg-slate-50/50 p-6 dark:bg-slate-900/20 animate-pulse border border-slate-200 dark:border-slate-800',
          className
        )}
      >
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
        <div className="h-48 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl bg-slate-50/40 p-6 text-center border border-dashed border-slate-200 dark:border-slate-800',
          className
        )}
      >
        <BarChart2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Chưa có dữ liệu KPI bác sĩ
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Dữ liệu so sánh chỉ tiêu và thực tế sẽ hiển thị khi có phân bổ KPI
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50',
        className
      )}
    >
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              {title}
            </h3>
            {showReferenceLines && (
              <Badge variant="outline" className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40">
                Có vạch chuẩn KPI
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {departments.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                aria-label="Lọc theo khoa phòng"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả khoa phòng</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Metric Selector Buttons */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSelectedMetric('both')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                selectedMetric === 'both'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              Song song
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('revenue')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                selectedMetric === 'revenue'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              Doanh thu
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('visits')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                selectedMetric === 'visits'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              Lượt khám
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="pt-4">
        {selectedMetric === 'both' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Doanh thu: Chỉ tiêu vs Thực đạt (VNĐ)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Mục tiêu TB: <strong className="text-blue-600 font-mono">{formatShortCurrency(stats.avgTargetRevenue)}</strong>
                </span>
              </div>
              <div style={{ height: height - 60 }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredData}
                    margin={{ top: 15, right: 10, left: -5, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatShortCurrency(v)}
                      width={50}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        formatCurrency(Number(val ?? 0)),
                        name === 'target_revenue' ? 'Chỉ tiêu Doanh thu' : 'Thực đạt Doanh thu',
                      ]}
                      labelFormatter={(label) => `Bác sĩ / NV: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                      formatter={(val) =>
                        val === 'target_revenue' ? 'Chỉ tiêu' : 'Thực đạt'
                      }
                    />
                    {showReferenceLines && stats.avgTargetRevenue > 0 && (
                      <ReferenceLine
                        y={stats.avgTargetRevenue}
                        stroke={COLORS.benchmarkLine}
                        strokeDasharray="4 4"
                        label={{
                          value: `TB: ${formatShortCurrency(stats.avgTargetRevenue)}`,
                          position: 'right',
                          fill: COLORS.benchmarkLine,
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Bar
                      dataKey="target_revenue"
                      name="target_revenue"
                      fill={COLORS.targetRevenue}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="actual_revenue"
                      name="actual_revenue"
                      fill={COLORS.actualRevenue}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visits Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Lượt khám: Chỉ tiêu vs Thực đạt (Lượt)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Chỉ tiêu TB: <strong className="text-amber-600 font-mono">{stats.avgTargetVisits} lượt</strong>
                </span>
              </div>
              <div style={{ height: height - 60 }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredData}
                    margin={{ top: 15, right: 10, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11 }} width={35} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${Number(val ?? 0).toLocaleString('vi-VN')} lượt khám`,
                        name === 'target_visits' ? 'Chỉ tiêu Lượt khám' : 'Thực đạt Lượt khám',
                      ]}
                      labelFormatter={(label) => `Bác sĩ / NV: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                      formatter={(val) =>
                        val === 'target_visits' ? 'Chỉ tiêu Lượt' : 'Thực đạt Lượt'
                      }
                    />
                    {showReferenceLines && stats.avgTargetVisits > 0 && (
                      <ReferenceLine
                        y={stats.avgTargetVisits}
                        stroke={COLORS.targetVisits}
                        strokeDasharray="4 4"
                        label={{
                          value: `TB: ${stats.avgTargetVisits} lượt`,
                          position: 'right',
                          fill: COLORS.targetVisits,
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Bar
                      dataKey="target_visits"
                      name="target_visits"
                      fill={COLORS.targetVisits}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="actual_visits"
                      name="actual_visits"
                      fill={COLORS.actualVisits}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : selectedMetric === 'revenue' ? (
          /* Single Large Revenue Chart */
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 20, right: 30, left: 10, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="fullName"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatShortCurrency(v)}
                  width={65}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val ?? 0)),
                    name === 'target_revenue' ? 'Mục tiêu Doanh thu' : 'Thực đạt Doanh thu',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  formatter={(val) =>
                    val === 'target_revenue' ? 'Chỉ tiêu Doanh thu' : 'Doanh thu Thực đạt'
                  }
                />
                {showReferenceLines && stats.avgTargetRevenue > 0 && (
                  <ReferenceLine
                    y={stats.avgTargetRevenue}
                    stroke={COLORS.benchmarkLine}
                    strokeDasharray="4 4"
                    label={{
                      value: `Chỉ tiêu TB: ${formatCurrency(stats.avgTargetRevenue)}`,
                      position: 'top',
                      fill: COLORS.benchmarkLine,
                      fontSize: 11,
                    }}
                  />
                )}
                <Bar
                  dataKey="target_revenue"
                  name="target_revenue"
                  fill={COLORS.targetRevenue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="actual_revenue"
                  name="actual_revenue"
                  fill={COLORS.actualRevenue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Single Large Visits Chart */
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 20, right: 30, left: 0, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="fullName"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11 }} width={45} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${Number(val ?? 0).toLocaleString('vi-VN')} lượt khám`,
                    name === 'target_visits' ? 'Chỉ tiêu Lượt khám' : 'Thực đạt Lượt khám',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  formatter={(val) =>
                    val === 'target_visits' ? 'Chỉ tiêu Lượt khám' : 'Lượt khám Thực tế'
                  }
                />
                {showReferenceLines && stats.avgTargetVisits > 0 && (
                  <ReferenceLine
                    y={stats.avgTargetVisits}
                    stroke={COLORS.benchmarkLine}
                    strokeDasharray="4 4"
                    label={{
                      value: `Chỉ tiêu TB: ${stats.avgTargetVisits} lượt`,
                      position: 'top',
                      fill: COLORS.benchmarkLine,
                      fontSize: 11,
                    }}
                  />
                )}
                <Bar
                  dataKey="target_visits"
                  name="target_visits"
                  fill={COLORS.targetVisits}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="actual_visits"
                  name="actual_visits"
                  fill={COLORS.actualVisits}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary KPI Badges Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>Mục tiêu Doanh thu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Thực đạt Doanh thu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Mục tiêu Lượt khám</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span>Thực đạt Lượt khám</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>Quy chuẩn: Medical SaaS v3</span>
        </div>
      </div>
    </div>
  );
}
