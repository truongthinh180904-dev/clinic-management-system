'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface DonutChartItem {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
  code?: string;
  count?: number;
  [key: string]: any;
}

export interface DonutChartProps {
  data: DonutChartItem[];
  title?: string;
  description?: string;
  centerLabel?: string;
  centerSublabel?: string;
  valueFormatter?: (value: number) => string;
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
  emptyMessage?: string;
  emptySubmessage?: string;
  colors?: string[];
  className?: string;
  onSliceClick?: (item: DonutChartItem) => void;
}

export const DEFAULT_CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#64748b', // slate
];

export function DonutChart({
  data,
  title,
  description,
  centerLabel,
  centerSublabel,
  valueFormatter = (val: number) => String(val),
  innerRadius = 60,
  outerRadius = 85,
  height = 240,
  showLegend = true,
  legendPosition = 'bottom',
  emptyMessage = 'Chưa có dữ liệu ghi nhận',
  emptySubmessage = 'Số liệu sẽ hiển thị khi có phát sinh',
  colors = DEFAULT_CHART_COLORS,
  className,
  onSliceClick,
}: DonutChartProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalValue = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => {
      const val = Number(item.value) || 0;
      const pct = totalValue > 0 ? Math.round((val / totalValue) * 100) : 0;
      return {
        ...item,
        value: val,
        percentage: item.percentage !== undefined ? item.percentage : pct,
        color: item.color || colors[index % colors.length],
      };
    });
  }, [data, totalValue, colors]);

  const isEmpty = totalValue === 0 || chartData.length === 0;

  const activeItem = activeIndex !== null && chartData[activeIndex] ? chartData[activeIndex] : null;

  const displayCenterLabel = activeItem
    ? valueFormatter(activeItem.value)
    : centerLabel !== undefined
    ? centerLabel
    : valueFormatter(totalValue);

  const displayCenterSublabel = activeItem
    ? `${activeItem.name} (${activeItem.percentage}%)`
    : centerSublabel !== undefined
    ? centerSublabel
    : 'Tổng cộng';

  if (!isMounted) {
    return (
      <div
        style={{ height }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl bg-slate-50/50 p-4 dark:bg-slate-900/20 animate-pulse',
          className
        )}
      >
        <div className="h-28 w-28 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin dark:border-slate-800" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {title && (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
      )}

      <div
        className={cn(
          'flex items-center justify-center',
          legendPosition === 'right' ? 'flex-col sm:flex-row gap-6' : 'flex-col gap-4'
        )}
      >
        {/* Donut Chart with Center Text */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: '100%', height }}>
          {isEmpty ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-center p-4">
              <div
                className="relative flex items-center justify-center rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 mb-2"
                style={{ width: outerRadius * 2, height: outerRadius * 2 }}
              >
                <div
                  className="rounded-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-2 text-center"
                  style={{ width: innerRadius * 2, height: innerRadius * 2 }}
                >
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">0%</span>
                </div>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{emptyMessage}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{emptySubmessage}</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={chartData.filter((d) => d.value > 0).length > 1 ? 3 : 0}
                    cornerRadius={4}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={(entry) => onSliceClick && onSliceClick(entry as DonutChartItem)}
                    className="cursor-pointer transition-all duration-300 outline-none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={activeIndex === index ? '#ffffff' : 'transparent'}
                        strokeWidth={activeIndex === index ? 2 : 0}
                        style={{
                          filter: activeIndex === index ? 'drop-shadow(0px 4px 8px rgba(0,0,0,0.25))' : 'none',
                          transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
                          transformOrigin: 'center center',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as DonutChartItem;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-4 font-mono">
                            <span className="text-slate-500 dark:text-slate-400">Giá trị:</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {valueFormatter(item.value)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-4 font-mono mt-0.5">
                            <span className="text-slate-500 dark:text-slate-400">Tỷ trọng:</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {item.percentage}%
                            </span>
                          </div>
                          {item.count !== undefined && (
                            <div className="flex items-baseline justify-between gap-4 font-mono mt-0.5">
                              <span className="text-slate-500 dark:text-slate-400">Số lượng:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {item.count} lượt
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Dynamic Center Label */}
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-2"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  maxWidth: innerRadius * 1.8,
                }}
              >
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-full">
                  {displayCenterLabel}
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-full mt-0.5">
                  {displayCenterSublabel}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Rich Legend with Values and Percentages */}
        {showLegend && chartData.length > 0 && !isEmpty && (
          <div
            className={cn(
              'w-full space-y-1.5 overflow-y-auto pr-1',
              legendPosition === 'right' ? 'max-w-xs max-h-[220px]' : 'max-h-[160px]'
            )}
          >
            {chartData.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSliceClick && onSliceClick(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-colors text-left',
                  activeIndex === idx
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                )}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className={cn(
                      'truncate font-medium text-slate-700 dark:text-slate-300',
                      activeIndex === idx && 'text-slate-900 dark:text-slate-100 font-semibold'
                    )}
                  >
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono text-right">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {valueFormatter(item.value)}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      activeIndex === idx
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {item.percentage}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
