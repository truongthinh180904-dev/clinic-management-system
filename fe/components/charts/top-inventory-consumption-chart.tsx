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
  Cell,
} from 'recharts';
import { Boxes, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { InventoryItemReport } from '@/types/report';

export interface TopInventoryConsumptionChartProps {
  items: InventoryItemReport[];
  title?: string;
  description?: string;
  height?: number;
  limit?: number;
  showReferenceLine?: boolean;
  className?: string;
}

const COLORS = {
  consumed: '#f97316',    // Warm Orange for consumption / burn rate
  closingStock: '#3b82f6',// Medical Blue for remaining inventory
  lowStockAlert: '#ef4444',// Red Alert for low stock
  reference: '#8b5cf6',   // Purple Reference Line
};

export function TopInventoryConsumptionChart({
  items,
  title = 'Top 10 Thuốc & Vật tư Tiêu hao Nhiều nhất',
  description = 'Đối chiếu số lượng xuất sử dụng với lượng tồn kho thực tế của các mặt hàng tiêu hao chủ lực',
  height = 360,
  limit = 10,
  showReferenceLine = true,
  className,
}: TopInventoryConsumptionChartProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'both' | 'consumed_only'>('both');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter and sort top consumed items
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items
      .filter((item) => Number(item.out_quantity) > 0 || Number(item.closing_stock) > 0)
      .sort((a, b) => Number(b.out_quantity) - Number(a.out_quantity))
      .slice(0, limit)
      .map((item) => {
        const outQty = Number(item.out_quantity) || 0;
        const closingStock = Number(item.closing_stock) || 0;
        const minStock = Number(item.minimum_stock) || 0;
        const isLow = item.is_low_stock || (minStock > 0 && closingStock <= minStock) || closingStock <= 0;

        // Clean short name for display
        const shortName = item.name.length > 25 ? `${item.name.substring(0, 23)}...` : item.name;

        return {
          id: item.id || item.product_id,
          name: shortName,
          fullName: item.name,
          product_code: item.product_code,
          unit: item.unit || 'Đơn vị',
          out_quantity: outQty,
          closing_stock: closingStock,
          minimum_stock: minStock,
          is_low_stock: isLow,
          status: item.status,
        };
      });
  }, [items, limit]);

  // Compute average consumption for ReferenceLine
  const avgConsumption = useMemo(() => {
    if (chartData.length === 0) return 0;
    const totalOut = chartData.reduce((acc, curr) => acc + curr.out_quantity, 0);
    return Math.round(totalOut / chartData.length);
  }, [chartData]);

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

  if (chartData.length === 0) {
    return (
      <div
        style={{ height }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl bg-slate-50/40 p-6 text-center border border-dashed border-slate-200 dark:border-slate-800',
          className
        )}
      >
        <Boxes className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Chưa có phát sinh tiêu hao thuốc & vật tư
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Số liệu tiêu hao sẽ tự động thống kê khi phát sinh phiếu xuất kho hoặc kê đơn
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
              <Flame className="h-5 w-5 text-orange-500" />
              {title}
            </h3>
            {showReferenceLine && avgConsumption > 0 && (
              <Badge variant="outline" className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/40">
                Tiêu hao TB: {avgConsumption.toLocaleString('vi-VN')}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* View mode toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              viewMode === 'both'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            )}
          >
            Xuất vs Tồn kho
          </button>
          <button
            type="button"
            onClick={() => setViewMode('consumed_only')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              viewMode === 'consumed_only'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            )}
          >
            Chỉ số lượng Xuất
          </button>
        </div>
      </div>

      {/* Horizontal Bar Chart (Category on YAxis) */}
      <div style={{ height: height - 50 }} className="w-full pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 35, left: 20, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={140}
              tickLine={false}
            />
            <Tooltip
              formatter={(val: any, name: any, item: any) => {
                const payload = item.payload;
                const unit = payload?.unit || '';
                const label =
                  name === 'out_quantity'
                    ? 'Lượng xuất tiêu hao'
                    : 'Tồn kho hiện tại';
                return [`${Number(val ?? 0).toLocaleString('vi-VN')} ${unit}`, label];
              }}
              labelFormatter={(_, items: any[]) => {
                const first = items?.[0]?.payload;
                return first ? `${first.fullName} (${first.product_code})` : '';
              }}
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
                val === 'out_quantity' ? 'Xuất tiêu hao (-)' : 'Tồn cuối kỳ'
              }
            />
            {showReferenceLine && avgConsumption > 0 && (
              <ReferenceLine
                x={avgConsumption}
                stroke={COLORS.reference}
                strokeDasharray="4 4"
                label={{
                  value: `TB: ${avgConsumption.toLocaleString('vi-VN')}`,
                  position: 'top',
                  fill: COLORS.reference,
                  fontSize: 10,
                }}
              />
            )}
            <Bar
              dataKey="out_quantity"
              name="out_quantity"
              fill={COLORS.consumed}
              radius={[0, 4, 4, 0]}
              maxBarSize={viewMode === 'both' ? 14 : 20}
            />
            {viewMode === 'both' && (
              <Bar
                dataKey="closing_stock"
                name="closing_stock"
                fill={COLORS.closingStock}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.is_low_stock ? COLORS.lowStockAlert : COLORS.closingStock}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer with warning summary */}
      <div className="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            Lượng xuất tiêu hao
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Tồn kho an toàn
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Cảnh báo thiếu hụt / Chạm định mức
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <span>Tiêu chuẩn kho: GSP / Y tế</span>
        </div>
      </div>
    </div>
  );
}
