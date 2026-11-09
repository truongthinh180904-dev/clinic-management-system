import * as React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  trendLabel?: string;
  badge?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variantIconBg = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  primary: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  destructive: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  trendLabel,
  badge,
  variant = 'primary',
  className,
}: StatCardProps) {
  return (
    <Card
      role="region"
      aria-label={`Thống kê: ${title}`}
      className={cn('overflow-hidden transition-all duration-200 hover:shadow-md', className)}
    >
      <CardContent className="p-4 sm:p-5 lg:p-6">
        <div className="flex items-center justify-between space-x-2">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          <div className="flex items-center space-x-2 shrink-0">
            {badge && <div>{badge}</div>}
            {Icon && (
              <div
                className={cn('p-2 sm:p-2.5 rounded-xl transition-colors', variantIconBg[variant])}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
            {value}
          </div>

          {(trend || trendValue || description) && (
            <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center font-semibold rounded px-1.5 py-0.5 shrink-0',
                    trend === 'up' && 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
                    trend === 'down' && 'text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300',
                    trend === 'neutral' && 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {trend === 'up' && <TrendingUp className="mr-1 h-3 w-3" />}
                  {trend === 'down' && <TrendingDown className="mr-1 h-3 w-3" />}
                  {trend === 'neutral' && <Minus className="mr-1 h-3 w-3" />}
                  {trendValue}
                </span>
              )}
              {trendLabel && <span className="truncate">{trendLabel}</span>}
              {!trend && description && <span className="truncate">{description}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
