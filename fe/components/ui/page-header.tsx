import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  action,
  children,
  className,
}: PageHeaderProps) {
  const headerActions = actions ?? action;

  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-5 md:pb-6 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 mb-5 md:mb-6',
        className
      )}
    >
      <div className="space-y-1 sm:space-y-1.5 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Đường dẫn điều hướng (Breadcrumb)"
            className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 overflow-x-auto scrollbar-none py-0.5"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn('whitespace-nowrap', isLast && 'font-medium text-slate-900 dark:text-slate-100')}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      {(headerActions || children) && (
        <div
          role="region"
          aria-label="Thao tác trang"
          className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0"
        >
          {headerActions}
          {children}
        </div>
      )}
    </div>
  );
}
