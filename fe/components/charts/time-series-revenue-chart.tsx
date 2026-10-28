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
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  CreditCard,
  Wallet,
  Activity,
  Layers,
  Calendar,
  Eye,
  GitCompare,
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface RevenueDataPoint {
  date: string;
  invoiced_amount?: number;
  total_revenue?: number;
  collected_amount?: number;
  paid_amount?: number;
  expense_amount?: number;
  net_cashflow?: number;
  net_profit?: number;
  [key: string]: any;
}

export interface TimeSeriesRevenueChartProps {
  data: RevenueDataPoint[];
  previousPeriodData?: RevenueDataPoint[];
  title?: string;
  description?: string;
  height?: number;
  chartType?: 'area' | 'line';
  defaultMetric?: 'all' | 'revenue' | 'collected' | 'expense' | 'net_cashflow';
  showControls?: boolean;
  showPeriodComparisonToggle?: boolean;
  showSummaryBar?: boolean;
  className?: string;
}

function formatShortCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}Tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(0)}k`;
  }
  return `${sign}${abs}`;
}

function formatAxisDate(val: string): string {
  if (!val) return '';
  const parts = String(val).split('-');
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return val;
}

const METRIC_COLORS = {
  invoiced: {
    stroke: '#3b82f6', // Medical Blue
    gradientStart: '#3b82f6',
    label: 'Doanh thu phát sinh',
    shortLabel: 'Doanh thu',
  },
  collected: {
    stroke: '#10b981', // Emerald Success
    gradientStart: '#10b981',
    label: 'Thực thu vào sổ quỹ',
    shortLabel: 'Thực thu',
  },
  expense: {
    stroke: '#f43f5e', // Rose Expense
    gradientStart: '#f43f5e',
    label: 'Chi phí đã duyệt',
    shortLabel: 'Chi phí',
  },
  netCashflow: {
    stroke: '#6366f1', // Indigo Net
    gradientStart: '#6366f1',
    label: 'Dòng tiền ròng',
    shortLabel: 'Dòng tiền ròng',
  },
  previousInvoiced: {
    stroke: '#94a3b8', // Slate Dashed Comparison
    label: 'Doanh thu kỳ trước',
    shortLabel: 'Kỳ trước',
  },
};

export function TimeSeriesRevenueChart({
  data = [],
  previousPeriodData,
  title = 'Xu Hướng Doanh Thu & Dòng Tiền Theo Thời Gian',
  description = 'Theo dõi chuỗi thời gian doanh thu phát sinh, thực thu sổ quỹ và chi phí vận hành',
  height = 340,
  chartType = 'area',
  defaultMetric = 'all',
  showControls = true,
  showPeriodComparisonToggle = true,
  showSummaryBar = true,
  className,
}: TimeSeriesRevenueChartProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [currentChartType, setCurrentChartType] = useState<'area' | 'line'>(chartType);
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'revenue' | 'collected' | 'expense' | 'net_cashflow'>(
    defaultMetric
  );
  const [comparePrevious, setComparePrevious] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Merge current and previous data if comparison enabled
  const processedChartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => {
      const invoiced = Number(item.invoiced_amount ?? item.total_revenue ?? 0);
      const collected = Number(item.collected_amount ?? item.paid_amount ?? 0);
      const expense = Number(item.expense_amount ?? 0);
      const netCashflow = Number(item.net_cashflow ?? item.net_profit ?? collected - expense);

      let prevInvoiced = 0;
      let prevCollected = 0;

      if (previousPeriodData && previousPeriodData[index]) {
        prevInvoiced = Number(previousPeriodData[index].invoiced_amount ?? previousPeriodData[index].total_revenue ?? 0);
        prevCollected = Number(previousPeriodData[index].collected_amount ?? previousPeriodData[index].paid_amount ?? 0);
      }

      return {
        ...item,
        date: item.date,
        invoiced_amount: invoiced,
        collected_amount: collected,
        expense_amount: expense,
        net_cashflow: netCashflow,
        prev_invoiced_amount: prevInvoiced,
        prev_collected_amount: prevCollected,
      };
    });
  }, [data, previousPeriodData]);

  // Aggregate totals
  const summaryTotals = useMemo(() => {
    if (!processedChartData.length) {
      return { totalInvoiced: 0, totalCollected: 0, totalExpense: 0, netCashflow: 0, avgDailyRevenue: 0 };
    }
    const totalInvoiced = processedChartData.reduce((acc, curr) => acc + curr.invoiced_amount, 0);
    const totalCollected = processedChartData.reduce((acc, curr) => acc + curr.collected_amount, 0);
    const totalExpense = processedChartData.reduce((acc, curr) => acc + curr.expense_amount, 0);
    const netCashflow = totalCollected - totalExpense;
    const avgDailyRevenue = Math.round(totalInvoiced / processedChartData.length);

    return {
      totalInvoiced,
      totalCollected,
      totalExpense,
      netCashflow,
      avgDailyRevenue,
    };
  }, [processedChartData]);

  // Render chart elements based on selected metric
  const renderChartSeries = () => {
    const isArea = currentChartType === 'area';

    const showInvoiced = selectedMetric === 'all' || selectedMetric === 'revenue';
    const showCollected = selectedMetric === 'all' || selectedMetric === 'collected';
    const showExpense = selectedMetric === 'all' || selectedMetric === 'expense';
    const showNet = selectedMetric === 'all' || selectedMetric === 'net_cashflow';

    if (isArea) {
      return (
        <>
          {comparePrevious && previousPeriodData && previousPeriodData.length > 0 && (
            <Area
              type="monotone"
              dataKey="prev_invoiced_amount"
              name="Doanh thu kỳ trước"
              stroke={METRIC_COLORS.previousInvoiced.stroke}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              fill="transparent"
            />
          )}
          {showInvoiced && (
            <Area
              type="monotone"
              dataKey="invoiced_amount"
              name={METRIC_COLORS.invoiced.label}
              stroke={METRIC_COLORS.invoiced.stroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#revenueInvoicedGrad)"
              activeDot={{ r: 5, strokeWidth: 1 }}
            />
          )}
          {showCollected && (
            <Area
              type="monotone"
              dataKey="collected_amount"
              name={METRIC_COLORS.collected.label}
              stroke={METRIC_COLORS.collected.stroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#revenueCollectedGrad)"
              activeDot={{ r: 5, strokeWidth: 1 }}
            />
          )}
          {showExpense && (
            <Area
              type="monotone"
              dataKey="expense_amount"
              name={METRIC_COLORS.expense.label}
              stroke={METRIC_COLORS.expense.stroke}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#revenueExpenseGrad)"
              activeDot={{ r: 5, strokeWidth: 1 }}
            />
          )}
          {showNet && (
            <Area
              type="monotone"
              dataKey="net_cashflow"
              name={METRIC_COLORS.netCashflow.label}
              stroke={METRIC_COLORS.netCashflow.stroke}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#revenueNetGrad)"
              activeDot={{ r: 5, strokeWidth: 1 }}
            />
          )}
        </>
      );
    }

    // Line Chart mode
    return (
      <>
        {comparePrevious && previousPeriodData && previousPeriodData.length > 0 && (
          <Line
            type="monotone"
            dataKey="prev_invoiced_amount"
            name="Doanh thu kỳ trước"
            stroke={METRIC_COLORS.previousInvoiced.stroke}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
        )}
        {showInvoiced && (
          <Line
            type="monotone"
            dataKey="invoiced_amount"
            name={METRIC_COLORS.invoiced.label}
            stroke={METRIC_COLORS.invoiced.stroke}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showCollected && (
          <Line
            type="monotone"
            dataKey="collected_amount"
            name={METRIC_COLORS.collected.label}
            stroke={METRIC_COLORS.collected.stroke}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showExpense && (
          <Line
            type="monotone"
            dataKey="expense_amount"
            name={METRIC_COLORS.expense.label}
            stroke={METRIC_COLORS.expense.stroke}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
        {showNet && (
          <Line
            type="monotone"
            dataKey="net_cashflow"
            name={METRIC_COLORS.netCashflow.label}
            stroke={METRIC_COLORS.netCashflow.stroke}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        )}
      </>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header and Controls */}
      {showControls && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {title && (
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                {title}
              </h3>
            )}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Metric Selector Buttons */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setSelectedMetric('all')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'all'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('revenue')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'revenue'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                Doanh thu
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('collected')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'collected'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                Thực thu
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('expense')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'expense'
                    ? 'bg-white text-rose-700 shadow-sm dark:bg-slate-800 dark:text-rose-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                Chi phí
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('net_cashflow')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedMetric === 'net_cashflow'
                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                Dòng tiền
              </button>
            </div>

            {/* Area vs Line View Switcher */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setCurrentChartType('area')}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  currentChartType === 'area'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
                title="Dạng Vùng tô chuyển sắc (Area)"
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
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                )}
                title="Dạng Đường thẳng nét mảnh (Line)"
              >
                Đường
              </button>
            </div>

            {/* Toggle Period Comparison */}
            {showPeriodComparisonToggle && previousPeriodData && previousPeriodData.length > 0 && (
              <Button
                variant={comparePrevious ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2 gap-1"
                onClick={() => setComparePrevious(!comparePrevious)}
              >
                <GitCompare className="h-3 w-3" />
                So sánh kỳ trước
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Pills */}
      {showSummaryBar && processedChartData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1">
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-2.5 dark:border-blue-900/30 dark:bg-blue-950/20">
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Tổng doanh thu phát sinh</span>
            <p className="text-sm font-bold text-blue-950 dark:text-blue-200 mt-0.5">
              {formatCurrency(summaryTotals.totalInvoiced)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Thực thu vào quỹ</span>
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200 mt-0.5">
              {formatCurrency(summaryTotals.totalCollected)}
            </p>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-2.5 dark:border-rose-900/30 dark:bg-rose-950/20">
            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Tổng chi phí vận hành</span>
            <p className="text-sm font-bold text-rose-950 dark:text-rose-200 mt-0.5">
              {formatCurrency(summaryTotals.totalExpense)}
            </p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5 dark:border-indigo-900/30 dark:bg-indigo-950/20">
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">Dòng tiền ròng (Net)</span>
            <p
              className={cn(
                'text-sm font-bold mt-0.5',
                summaryTotals.netCashflow >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              )}
            >
              {formatCurrency(summaryTotals.netCashflow)}
            </p>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div style={{ height }} className="w-full relative">
        {isMounted && processedChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {currentChartType === 'area' ? (
              <AreaChart data={processedChartData} margin={{ top: 12, right: 12, left: -4, bottom: 0 }}>
                <defs>
                  {/* Invoiced Revenue Gradient */}
                  <linearGradient id="revenueInvoicedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_COLORS.invoiced.gradientStart} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={METRIC_COLORS.invoiced.gradientStart} stopOpacity={0.0} />
                  </linearGradient>

                  {/* Collected Cash Gradient */}
                  <linearGradient id="revenueCollectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_COLORS.collected.gradientStart} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={METRIC_COLORS.collected.gradientStart} stopOpacity={0.0} />
                  </linearGradient>

                  {/* Expense Gradient */}
                  <linearGradient id="revenueExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_COLORS.expense.gradientStart} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={METRIC_COLORS.expense.gradientStart} stopOpacity={0.0} />
                  </linearGradient>

                  {/* Net Cashflow Gradient */}
                  <linearGradient id="revenueNetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_COLORS.netCashflow.gradientStart} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={METRIC_COLORS.netCashflow.gradientStart} stopOpacity={0.0} />
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
                  tickFormatter={formatShortCurrency}
                  className="text-xs text-slate-500"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 min-w-[210px]">
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            Ngày {formatDate(label)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {payload.map((entry: any, index: number) => {
                            const val = Number(entry.value) || 0;
                            return (
                              <div key={`entry-${index}`} className="flex items-center justify-between gap-3 py-0.5">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: entry.color || entry.stroke }}
                                  />
                                  <span className="truncate max-w-[120px]">{entry.name}:</span>
                                </span>
                                <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                                  {formatCurrency(val)}
                                </span>
                              </div>
                            );
                          })}
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
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="2 2" />
                {renderChartSeries()}
              </AreaChart>
            ) : (
              <LineChart data={processedChartData} margin={{ top: 12, right: 12, left: -4, bottom: 0 }}>
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
                  tickFormatter={formatShortCurrency}
                  className="text-xs text-slate-500"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 min-w-[210px]">
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            Ngày {formatDate(label)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {payload.map((entry: any, index: number) => {
                            const val = Number(entry.value) || 0;
                            return (
                              <div key={`entry-${index}`} className="flex items-center justify-between gap-3 py-0.5">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: entry.color || entry.stroke }}
                                  />
                                  <span className="truncate max-w-[120px]">{entry.name}:</span>
                                </span>
                                <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                                  {formatCurrency(val)}
                                </span>
                              </div>
                            );
                          })}
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
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="2 2" />
                {renderChartSeries()}
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-sm text-slate-400">
            Chưa có số liệu chuỗi thời gian trong kỳ đã chọn
          </div>
        )}
      </div>
    </div>
  );
}
