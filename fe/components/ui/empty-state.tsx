import React from 'react';
import Link from 'next/link';
import { LucideIcon, Inbox, SearchX, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode | EmptyStateAction;
  secondaryAction?: React.ReactNode | EmptyStateAction;
  variant?: 'default' | 'search' | 'error' | 'warning' | 'info';
  className?: string;
}

const variantStyles = {
  default: {
    iconWrapper: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    title: 'text-slate-900 dark:text-white',
    desc: 'text-slate-500 dark:text-slate-400',
  },
  search: {
    iconWrapper: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
    title: 'text-slate-900 dark:text-white',
    desc: 'text-slate-500 dark:text-slate-400',
  },
  error: {
    iconWrapper: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
    title: 'text-slate-900 dark:text-white',
    desc: 'text-slate-500 dark:text-slate-400',
  },
  warning: {
    iconWrapper: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    title: 'text-slate-900 dark:text-white',
    desc: 'text-slate-500 dark:text-slate-400',
  },
  info: {
    iconWrapper: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
    title: 'text-slate-900 dark:text-white',
    desc: 'text-slate-500 dark:text-slate-400',
  },
};

function renderAction(act?: React.ReactNode | EmptyStateAction, defaultVariant: 'default' | 'outline' = 'default') {
  if (!act) return null;
  if (React.isValidElement(act)) return act;

  const actionObj = act as EmptyStateAction;
  const Icon = actionObj.icon;

  if (actionObj.href) {
    return (
      <Button variant={actionObj.variant || defaultVariant} asChild>
        <Link href={actionObj.href} className="inline-flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{actionObj.label}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={actionObj.variant || defaultVariant}
      onClick={actionObj.onClick}
      className="inline-flex items-center gap-2"
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span>{actionObj.label}</span>
    </Button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const styles = variantStyles[variant] || variantStyles.default;

  const renderIcon = () => {
    if (!icon) {
      if (variant === 'search') return <SearchX className="h-8 w-8" />;
      if (variant === 'error') return <AlertCircle className="h-8 w-8" />;
      if (variant === 'warning') return <AlertTriangle className="h-8 w-8" />;
      return <Inbox className="h-8 w-8" />;
    }
    if (React.isValidElement(icon)) return icon;
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className="h-8 w-8" />;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl',
        className
      )}
    >
      <div
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm mb-4 transition-transform hover:scale-105',
          styles.iconWrapper
        )}
      >
        {renderIcon()}
      </div>

      <h3 className={cn('text-base font-semibold tracking-tight', styles.title)}>
        {title}
      </h3>

      {description && (
        <p className={cn('mt-1.5 text-sm max-w-md mx-auto leading-relaxed', styles.desc)}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {renderAction(action, 'default')}
          {renderAction(secondaryAction, 'outline')}
        </div>
      )}
    </div>
  );
}

export interface EmptySearchStateProps {
  query?: string;
  onReset?: () => void;
  className?: string;
}

export function EmptySearchState({
  query,
  onReset,
  className,
}: EmptySearchStateProps) {
  return (
    <EmptyState
      variant="search"
      icon={SearchX}
      title="Không tìm thấy kết quả phù hợp"
      description={
        query
          ? `Không tìm thấy bản ghi nào khớp với từ khóa "${query}" hoặc bộ lọc hiện tại.`
          : 'Không có dữ liệu phù hợp với tiêu chí lọc đã chọn. Vui lòng thử tìm kiếm với điều kiện khác.'
      }
      action={
        onReset
          ? {
              label: 'Xóa bộ lọc',
              onClick: onReset,
              variant: 'outline',
            }
          : undefined
      }
      className={className}
    />
  );
}

export interface EmptyDataStateProps {
  title?: string;
  description?: string;
  createLabel?: string;
  onCreate?: () => void;
  createHref?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  className?: string;
}

export function EmptyDataState({
  title = 'Chưa có dữ liệu nào',
  description = 'Hiện tại hệ thống chưa ghi nhận bản ghi nào trong danh mục này. Hãy bắt đầu bằng cách thêm mới.',
  createLabel = 'Thêm mới ngay',
  onCreate,
  createHref,
  icon = Inbox,
  className,
}: EmptyDataStateProps) {
  return (
    <EmptyState
      variant="default"
      icon={icon}
      title={title}
      description={description}
      action={
        createHref || onCreate
          ? {
              label: createLabel,
              onClick: onCreate,
              href: createHref,
              variant: 'default',
            }
          : undefined
      }
      className={className}
    />
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Không thể tải dữ liệu',
  message = 'Đã có lỗi xảy ra trong quá trình kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      variant="error"
      icon={AlertCircle}
      title={title}
      description={message}
      action={
        onRetry
          ? {
              label: 'Thử lại',
              onClick: onRetry,
              icon: RefreshCw,
              variant: 'default',
            }
          : undefined
      }
      className={className}
    />
  );
}
