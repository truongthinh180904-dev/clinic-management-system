'use client';

import React, { useMemo } from 'react';
import { DonutChart, DonutChartItem } from './donut-chart';
import { formatCurrency } from '@/lib/utils';
import { PaymentMethodBreakdown } from '@/types/report';

export interface PaymentMethodChartProps {
  data: PaymentMethodBreakdown[] | Array<{ payment_method: string; collected_amount: number; payment_count?: number }>;
  mode?: 'collected' | 'expense' | 'net';
  title?: string;
  description?: string;
  height?: number;
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
  className?: string;
}

const PAYMENT_METHOD_CONFIG: Record<
  string,
  { label: string; color: string; shortLabel: string }
> = {
  CASH: {
    label: 'Tiền mặt',
    shortLabel: 'Tiền mặt',
    color: '#10b981', // Emerald
  },
  BANK_TRANSFER: {
    label: 'Chuyển khoản',
    shortLabel: 'CK Ngân hàng',
    color: '#3b82f6', // Blue
  },
  CARD: {
    label: 'Thẻ / POS',
    shortLabel: 'Thẻ POS',
    color: '#8b5cf6', // Purple
  },
  INSURANCE: {
    label: 'Bảo hiểm Y tế',
    shortLabel: 'Bảo hiểm',
    color: '#f59e0b', // Amber
  },
  DEBT: {
    label: 'Ghi nợ',
    shortLabel: 'Ghi nợ',
    color: '#ef4444', // Red
  },
  OTHER: {
    label: 'Phương thức khác',
    shortLabel: 'Khác',
    color: '#64748b', // Slate
  },
};

export function PaymentMethodChart({
  data,
  mode = 'collected',
  title = 'Cơ Cấu Phương Thức Thanh Toán',
  description = 'Tỷ trọng thu chi phân bổ theo kênh thanh toán',
  height = 240,
  showLegend = true,
  legendPosition = 'bottom',
  className,
}: PaymentMethodChartProps) {
  const chartItems: DonutChartItem[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((item) => {
        const methodKey = String(item.payment_method || 'OTHER').toUpperCase();
        const conf = PAYMENT_METHOD_CONFIG[methodKey] || {
          label: methodKey,
          shortLabel: methodKey,
          color: '#64748b',
        };

        let val = 0;
        if (mode === 'collected') {
          val = Number(item.collected_amount) || 0;
        } else if (mode === 'expense' && 'expense_amount' in item) {
          val = Number(item.expense_amount) || 0;
        } else if (mode === 'net' && 'net_amount' in item) {
          val = Math.max(0, Number(item.net_amount) || 0);
        } else {
          val = Number(item.collected_amount) || 0;
        }

        return {
          name: conf.label,
          code: methodKey,
          value: val,
          color: conf.color,
          count: 'payment_count' in item ? item.payment_count : undefined,
        };
      })
      .filter((item) => item.value > 0);
  }, [data, mode]);

  const totalAmount = useMemo(() => {
    return chartItems.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartItems]);

  const centerLabel = formatCurrency(totalAmount);
  const centerSublabel =
    mode === 'collected' ? 'Tổng thực thu' : mode === 'expense' ? 'Tổng chi phí' : 'Dòng tiền ròng';

  return (
    <DonutChart
      data={chartItems}
      title={title}
      description={description}
      centerLabel={centerLabel}
      centerSublabel={centerSublabel}
      valueFormatter={(val) => formatCurrency(val)}
      height={height}
      showLegend={showLegend}
      legendPosition={legendPosition}
      emptyMessage="Chưa có dữ liệu thanh toán"
      emptySubmessage="Giao dịch thanh toán sẽ hiển thị tại đây"
      className={className}
    />
  );
}
