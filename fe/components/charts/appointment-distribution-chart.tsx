'use client';

import React, { useMemo } from 'react';
import { DonutChart, DonutChartItem } from './donut-chart';

export interface AppointmentDistributionChartProps {
  data?: {
    total?: number;
    completed?: number;
    cancelled?: number;
    scheduled?: number;
    confirmed?: number;
    pending?: number;
    in_progress?: number;
    waiting?: number;
    no_show?: number;
    attendance_rate?: number;
    by_status?: Record<string, number>;
    [key: string]: any;
  };
  title?: string;
  description?: string;
  height?: number;
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
  className?: string;
}

const APPOINTMENT_STATUS_MAP: Record<
  string,
  { label: string; color: string; order: number }
> = {
  COMPLETED: { label: 'Đã hoàn thành', color: '#10b981', order: 1 }, // Emerald
  CONFIRMED: { label: 'Đã xác nhận', color: '#3b82f6', order: 2 }, // Blue
  SCHEDULED: { label: 'Đã xếp lịch', color: '#6366f1', order: 3 }, // Indigo
  WAITING: { label: 'Chờ tiếp đón', color: '#f59e0b', order: 4 }, // Amber
  PENDING: { label: 'Chờ xác nhận', color: '#f59e0b', order: 5 }, // Amber
  IN_PROGRESS: { label: 'Đang khám', color: '#06b6d4', order: 6 }, // Cyan
  CANCELLED: { label: 'Đã hủy lịch', color: '#ef4444', order: 7 }, // Rose
  NO_SHOW: { label: 'Bỏ khám / Không đến', color: '#64748b', order: 8 }, // Slate
};

export function AppointmentDistributionChart({
  data,
  title = 'Phân Bố Trạng Thái Lịch Hẹn & Khám',
  description = 'Tỷ lệ hoàn thành, hủy lịch và vắng mặt trong kỳ',
  height = 240,
  showLegend = true,
  legendPosition = 'bottom',
  className,
}: AppointmentDistributionChartProps) {
  const chartItems: DonutChartItem[] = useMemo(() => {
    if (!data) return [];

    const rawMap: Record<string, number> = {
      ...(data.by_status || {}),
    };

    if (data.completed !== undefined) rawMap.COMPLETED = data.completed;
    if (data.cancelled !== undefined) rawMap.CANCELLED = data.cancelled;
    if (data.no_show !== undefined) rawMap.NO_SHOW = data.no_show;
    if (data.scheduled !== undefined && rawMap.SCHEDULED === undefined) rawMap.SCHEDULED = data.scheduled;
    if (data.confirmed !== undefined) rawMap.CONFIRMED = data.confirmed;
    if (data.pending !== undefined) rawMap.PENDING = data.pending;
    if (data.in_progress !== undefined) rawMap.IN_PROGRESS = data.in_progress;
    if (data.waiting !== undefined) rawMap.WAITING = data.waiting;

    const items: DonutChartItem[] = [];

    Object.entries(rawMap).forEach(([key, count]) => {
      const val = Number(count) || 0;
      if (val <= 0 && key !== 'TOTAL') return;
      if (key === 'TOTAL' || key === 'total') return;

      const conf = APPOINTMENT_STATUS_MAP[key] || {
        label: key,
        color: '#94a3b8',
        order: 99,
      };

      items.push({
        name: conf.label,
        code: key,
        value: val,
        color: conf.color,
        count: val,
        order: conf.order,
      });
    });

    items.sort((a, b) => (a.order || 99) - (b.order || 99));
    return items;
  }, [data]);

  const totalCount = useMemo(() => {
    if (data?.total && data.total > 0) return data.total;
    return chartItems.reduce((acc, curr) => acc + curr.value, 0);
  }, [data, chartItems]);

  const attendanceRate = useMemo(() => {
    if (data?.attendance_rate !== undefined) return Math.round(data.attendance_rate);
    const completed = chartItems.find((i) => i.code === 'COMPLETED')?.value || 0;
    return totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;
  }, [data, chartItems, totalCount]);

  const centerLabel = totalCount > 0 ? `${attendanceRate}%` : '0';
  const centerSublabel = totalCount > 0 ? 'Tỷ lệ đến khám' : 'Tổng số lịch';

  return (
    <DonutChart
      data={chartItems}
      title={title}
      description={description}
      centerLabel={centerLabel}
      centerSublabel={centerSublabel}
      valueFormatter={(val) => `${val} lịch`}
      height={height}
      showLegend={showLegend}
      legendPosition={legendPosition}
      emptyMessage="Chưa có lịch hẹn trong kỳ"
      emptySubmessage="Số liệu lịch hẹn sẽ hiển thị tại đây"
      className={className}
    />
  );
}
