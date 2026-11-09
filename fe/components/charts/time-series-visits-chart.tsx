'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Activity,
  Calendar,
  Stethoscope,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface VisitDataPoint {
  date: string;
  appointments_count?: number;
  appointments?: number;
  visits_count?: number;
  visits?: number;
  total?: number;
  completed_visits?: number;
  completed?: number;
  in_progress?: number;
  waiting?: number;
  cancelled?: number;
  [key: string]: any;
}

export interface TimeSeriesVisitsChartProps {
  data: VisitDataPoint[];
  title?: string;
  description?: string;
  height?: number;
  chartType?: 'area' | 'line';
  defaultMetric?: 'all' | 'visits' | 'appointments' | 'completed';
  showControls?: boolean;
  showSummaryBar?: boolean;
  className?: string;
}

function formatAxisDate(val: string): string {
  if (!val) return '';
  const parts = String(val).split('-');
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return val;
}

const VISIT_COLORS = {
  appointments: {
    stroke: '#8b5cf6', // Violet
    gradientStart: '#8b5cf6',
    label: 'Lịch hẹn đã đặt',
    shortLabel: 'Lịch hẹn',
  },
  visits: {
    stroke: '#3b82f6', // Medical Blue
    gradientStart: '#3b82f6',
    label: 'Tổng lượt tiếp nhận',
    shortLabel: 'Lượt khám',
  },
  completed: {
    stroke: '#10b981', // Emerald Success
    gradientStart: '#10b981',
    label: 'Đã hoàn thành khám',
    shortLabel: 'Đã xong',
  },
  waiting: {
    stroke: '#f59e0b', // Amber Waiting
    gradientStart: '#f59e0b',
    label: 'Chờ khám / Đang khám',
    shortLabel: 'Chờ khám',
  },
};

export function TimeSeriesVisitsChart({
  data = [],
  title = 'Xu Hướng Lịch Hẹn & Lượt Khám Bệnh',
  description = 'Theo dõi lưu lượng bệnh nhân đăng ký lịch hẹn và số ca khám lâm sàng thực tế theo ngày',
  height = 320,
  chartType = 'line',
  defaultMetric = 'all',
  showControls = true,
  showSummaryBar = true,
  className,
}: TimeSeriesVisitsChartProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [currentChartType, setCurrentChartType] = useState<'area' | 'line'>(chartType);
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'visits' | 'appointments' | 'completed'>(
    defaultMetric
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => {
      const appointments = Number(item.appointments_count ?? item.appointments ?? 0);
      const visits = Number(item.visits_count ?? item.visits ?? item.total ?? 0);
      const completed = Number(item.completed_visits ?? item.completed ?? 0);
      const waiting = Number(item.waiting ?? item.in_progress ?? 0);
      const cancelled = Number(item.cancelled ?? 0);

      return {
        ...item,
        date: item.date,
        appointments_count: appointments,
        visits_count: visits,
        completed_visits: completed,
        waiting_count: waiting,
        cancelled_count: cancelled,
      };
    });
  }, [data]);

  const summary = useMemo(() => {
    if (!processedData.length) {
      return { totalVisits: 0, totalCompleted: 0, totalAppointments: 0, completionRate: 0 };
    }
    const totalVisits = processedData.reduce((acc, curr) => acc + curr.visits_count, 0);
    const totalCompleted = processedData.reduce((acc, curr) => acc + curr.completed_visits, 0);
    const totalAppointments = processedData.reduce((acc, curr) => acc + curr.appointments_count, 0);
    const completionRate = totalVisits > 0 ? Math.round((totalCompleted / totalVisits) * 100) : 0;

    return { totalVisits, totalCompleted, totalAppointments, completionRate };
  }, [processedData]);

  const renderSeries = () => {
    const isArea = currentChartType === 'area';
    const showAppointments = selectedMetric === 'all' || selectedMetric === 'appointments';
    const showVisits = selectedMetric === 'all' || selectedMetric === 'visits';
    const showCompleted = selectedMetric === 'all' || selectedMetric === 'completed';

    if (isArea) {
      return (
        <>
          {showAppointments && (
            <Area
              type="monotone"
              dataKey="appointments_count"
              name={VISIT_COLORS.appointments.label}
              stroke={VISIT_COLORS.appointments.stroke}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#visitsApptGrad)"
              activeDot={{ r: 5 }}
            />
          )}
          {showVisits && (
            <Area
              type="monotone"
              dataKey="visits_count"
              name={VISIT_COLORS.visits.label}
              stroke={VISIT_COLORS.visits.stroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#visitsTotalGrad)"
              activeDot={{ r: 5 }}
            />
          )}
          {showCompleted && (
            <Area
              type="monotone"
              dataKey="completed_visits"
              name={VISIT_COLORS.completed.label}
              stroke={VISIT_COLORS.completed.stroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#visitsCompGrad)"
              activeDot={{ r: 5 }}
            />
          )}
        </>
      );
    }

    return (
      <>
        {showAppointments && (
          <Line
            type="monotone"
            dataKey="appointments_count"
            name={VISIT_COLORS.appointments.label}
            stroke={VISIT_COLORS.appointments.stroke}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showVisits && (
          <Line
            type="monotone"
            dataKey="visits_count"
            name={VISIT_COLORS.visits.label}
            stroke={VISIT_COLORS.visits.stroke}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showCompleted && (
          <Line
            type="monotone"
            dataKey="completed_visits"
            name={VISIT_COLORS.completed.label}
            stroke={VISIT_COLORS.completed.stroke}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
      </>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {showControls && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                {title}
              </h3>
            )}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setSelectedMetric('all')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'all'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('visits')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'visits'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Lượt khám
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('appointments')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'appointments'
                    ? 'bg-white text-purple-700 shadow-sm dark:bg-slate-800 dark:text-purple-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Lịch hẹn
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('completed')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'completed'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Đã khám xong
              </button>
            </div>

            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setCurrentChartType('area')}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  currentChartType === 'area'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Vùng
              </button>
              <button
                type="button"
                onClick={() => setCurrentChartType('line')}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  currentChartType === 'line'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Đường
              </button>
            </div>
          </div>
        </div>
      )}

      {showSummaryBar && processedData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1">
          <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-2.5 dark:border-purple-900/30 dark:bg-purple-950/20">
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">Lịch hẹn đã đặt</span>
            <p className="text-sm font-bold text-purple-950 dark:text-purple-200 mt-0.5">
              {summary.totalAppointments} lượt
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-2.5 dark:border-blue-900/30 dark:bg-blue-950/20">
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Tổng ca tiếp nhận</span>
            <p className="text-sm font-bold text-blue-950 dark:text-blue-200 mt-0.5">
              {summary.totalVisits} ca
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Đã hoàn thành khám</span>
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200 mt-0.5">
              {summary.totalCompleted} ca
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Tỷ lệ hoàn thành</span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary.completionRate}%
            </p>
          </div>
        </div>
      )}

      <div style={{ height }} className="w-full relative">
        {isMounted && processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {currentChartType === 'area' ? (
              <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitsApptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={VISIT_COLORS.appointments.gradientStart} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={VISIT_COLORS.appointments.gradientStart} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="visitsTotalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={VISIT_COLORS.visits.gradientStart} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={VISIT_COLORS.visits.gradientStart} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="visitsCompGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={VISIT_COLORS.completed.gradientStart} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={VISIT_COLORS.completed.gradientStart} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  className="text-xs text-slate-500"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  className="text-xs text-slate-500"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 min-w-[200px]">
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            Ngày {formatDate(label)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {payload.map((entry: any, index: number) => (
                            <div key={`entry-${index}`} className="flex items-center justify-between gap-3 py-0.5">
                              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.color || entry.stroke }}
                                />
                                <span>{entry.name}:</span>
                              </span>
                              <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                                {entry.value} lượt
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  formatter={(value) => (
                    <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      {value}
                    </span>
                  )}
                />
                {renderSeries()}
              </AreaChart>
            ) : (
              <LineChart data={processedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  className="text-xs text-slate-500"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  className="text-xs text-slate-500"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 min-w-[200px]">
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            Ngày {formatDate(label)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {payload.map((entry: any, index: number) => (
                            <div key={`entry-${index}`} className="flex items-center justify-between gap-3 py-0.5">
                              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.color || entry.stroke }}
                                />
                                <span>{entry.name}:</span>
                              </span>
                              <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                                {entry.value} lượt
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  formatter={(value) => (
                    <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                      {value}
                    </span>
                  )}
                />
                {renderSeries()}
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-sm text-slate-400">
            Chưa có số liệu khám bệnh trong kỳ đã chọn
          </div>
        )}
      </div>
    </div>
  );
}
