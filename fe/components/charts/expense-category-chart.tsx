'use client';

import React, { useMemo } from 'react';
import { DonutChart, DonutChartItem } from './donut-chart';
import { formatCurrency } from '@/lib/utils';
import { ExpenseByCategory } from '@/types/report';

export interface ExpenseCategoryChartProps {
  data: ExpenseByCategory[] | Array<{ category_name?: string; name?: string; total_amount?: number; amount?: number; expense_count?: number; percentage?: number }>;
  title?: string;
  description?: string;
  height?: number;
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
  className?: string;
}

const EXPENSE_PALETTE = [
  '#f59e0b', // Amber
  '#ef4444', // Red / Rose
  '#f97316', // Orange
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#64748b', // Slate
];

export function ExpenseCategoryChart({
  data,
  title = 'Cơ Cấu Chi Phí Vận Hành',
  description = 'Tỷ trọng chi phí theo từng danh mục định khoản',
  height = 240,
  showLegend = true,
  legendPosition = 'bottom',
  className,
}: ExpenseCategoryChartProps) {
  const chartItems: DonutChartItem[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((item, index) => {
        const name = item.category_name || item.name || 'Chi phí khác';
        const val = Number(item.total_amount ?? item.amount ?? 0);
        return {
          name,
          value: val,
          color: EXPENSE_PALETTE[index % EXPENSE_PALETTE.length],
          count: item.expense_count,
          percentage: item.percentage,
        };
      })
      .filter((item) => item.value > 0);
  }, [data]);

  const totalExpense = useMemo(() => {
    return chartItems.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartItems]);

  return (
    <DonutChart
      data={chartItems}
      title={title}
      description={description}
      centerLabel={formatCurrency(totalExpense)}
      centerSublabel="Tổng chi phí"
      valueFormatter={(val) => formatCurrency(val)}
      height={height}
      showLegend={showLegend}
      legendPosition={legendPosition}
      emptyMessage="Chưa có khoản chi nào trong kỳ"
      emptySubmessage="Các khoản chi được duyệt sẽ hiển thị tại đây"
      className={className}
    />
  );
}
