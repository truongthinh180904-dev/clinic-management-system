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
import { Building2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface DepartmentVisitItem {
  department: string;
  total_visits: number;
  completed_visits: number;
  in_progress_visits?: number;
  cancelled_visits?: number;
  revenue?: number;
  completion_rate?: number;
}

export interface DepartmentVisitsBarChartProps {
  data: DepartmentVisitItem[];
  title?: string;
  description?: string;
  height?: number;
  layout?: 'horizontal' | 'vertical';
  showReferenceLine?: boolean;
  referenceValue?: number;
  className?: string;
}

const COLORS = {
  total: '#93c5fd',     // Light Blue
  completed: '#2563eb', // Primary Medical Blue
  revenue: '#10b981',   // Emerald
  reference: '#f59e0b', // Amber Benchmark
};

export function DepartmentVisitsBarChart({
  data,
  title = 'Số Lượt khám Hoàn thành Giữa các Chuyên khoa',
  description = 'So sánh khối lượng tiếp nhận và tỷ lệ hoàn thành ca khám theo từng chuyên khoa phòng khám',
  height = 320,
  layout = 'vertical',
  showReferenceLine = true,
  referenceValue,
  className,
}: DepartmentVisitsBarChartProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [chartLayout, setChartLayout] = useState<'horizontal' | 'vertical'>(layout);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => {
      const total = Number(item.total_visits) || 0;
      const completed = Number(item.completed_visits) || 0;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...item,
        total_visits: total,
        completed_visits: completed,
        completion_rate: item.completion_rate !== undefined ? item.completion_rate : rate,
      };
    }).sort((a, b) => b.total_visits - a.total_visits);
  }, [data]);

  // Compute average volume for ReferenceLine
  const avgCompleted = useMemo(() => {
    if (referenceValue !== undefined) return referenceValue;
    if (processedData.length === 0) return 0;
    const total = processedData.reduce((acc, curr) => acc + curr.completed_visits, 0);
    return Math.round(total / processedData.length);
  }, [processedData, referenceValue]);

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
        <div className="h-44 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div
        style={{ height }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl bg-slate-50/40 p-6 text-center border border-dashed border-slate-200 dark:border-slate-800',
          className
        )}
      >
        <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Chưa có dữ liệu lượt khám chuyên khoa
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Dữ liệu thống kê theo khoa phòng sẽ cập nhật khi có lượt khám mới
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              {title}
            </h3>
            {showReferenceLine && avgCompleted > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40">
                Ngưỡng TB: {avgCompleted} lượt
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Layout toggle */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setChartLayout('vertical')}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-md transition-colors',
                chartLayout === 'vertical'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              )}
            >
              Ngang
            </button>
            <button
              type="button"
              onClick={() => setChartLayout('horizontal')}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-md transition-colors',
                chartLayout === 'horizontal'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              )}
            >
              Dọc
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: height - 40 }} className="w-full pt-3">
        <ResponsiveContainer width="100%" height="100%">
          {chartLayout === 'vertical' ? (
            /* Horizontal Bars with Vertical Y-Axis category */
            <BarChart
              data={processedData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 15, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="department"
                tick={{ fontSize: 11 }}
                width={125}
                tickLine={false}
              />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `${Number(val ?? 0).toLocaleString('vi-VN')} lượt khám`,
                  name === 'total_visits' ? 'Tổng lượt tiếp nhận' : 'Đã khám hoàn tất',
                ]}
                labelFormatter={(label) => `Chuyên khoa: ${label}`}
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
                  val === 'total_visits' ? 'Tổng tiếp nhận' : 'Đã khám xong'
                }
              />
              {showReferenceLine && avgCompleted > 0 && (
                <ReferenceLine
                  x={avgCompleted}
                  stroke={COLORS.reference}
                  strokeDasharray="4 4"
                  label={{
                    value: `TB: ${avgCompleted} lượt`,
                    position: 'top',
                    fill: COLORS.reference,
                    fontSize: 10,
                  }}
                />
              )}
              <Bar
                dataKey="total_visits"
                name="total_visits"
                fill={COLORS.total}
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
              />
              <Bar
                dataKey="completed_visits"
                name="completed_visits"
                fill={COLORS.completed}
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
              />
            </BarChart>
          ) : (
            /* Vertical Bars with Horizontal X-Axis category */
            <BarChart
              data={processedData}
              margin={{ top: 15, right: 20, left: -5, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11 }} width={35} />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `${Number(val ?? 0).toLocaleString('vi-VN')} lượt khám`,
                  name === 'total_visits' ? 'Tổng tiếp nhận' : 'Đã khám xong',
                ]}
                labelFormatter={(label) => `Chuyên khoa: ${label}`}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                formatter={(val) =>
                  val === 'total_visits' ? 'Tổng tiếp nhận' : 'Đã khám xong'
                }
              />
              {showReferenceLine && avgCompleted > 0 && (
                <ReferenceLine
                  y={avgCompleted}
                  stroke={COLORS.reference}
                  strokeDasharray="4 4"
                  label={{
                    value: `TB: ${avgCompleted} lượt`,
                    position: 'right',
                    fill: COLORS.reference,
                    fontSize: 10,
                  }}
                />
              )}
              <Bar
                dataKey="total_visits"
                name="total_visits"
                fill={COLORS.total}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="completed_visits"
                name="completed_visits"
                fill={COLORS.completed}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Completion Rate Overview */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">
          Tổng số chuyên khoa hoạt động: <strong>{processedData.length} khoa</strong>
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Tỷ lệ hoàn thành trung bình:{' '}
            <strong>
              {processedData.length > 0
                ? Math.round(
                    processedData.reduce((acc, c) => acc + (c.completion_rate || 0), 0) /
                      processedData.length
                  )
                : 0}
              %
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
