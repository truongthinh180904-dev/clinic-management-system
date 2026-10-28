'use client';

import React from 'react';
import { LucideIcon, Search, X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader, BreadcrumbItem } from '@/components/ui/page-header';
import { StatCard, StatCardProps } from '@/components/ui/stat-card';
import { Pagination, PaginationProps } from '@/components/ui/pagination';
import { EmptyState, EmptySearchState, EmptyDataState, ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

// ==========================================
// 1 & 2. HEADER & ACTION BUTTONS
// ==========================================
export interface ListPageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function ListPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: ListPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={actions}
      className={className}
    />
  );
}

// ==========================================
// 3. SUMMARY STATS CARDS GRID
// ==========================================
export interface ListPageStatsProps {
  items?: (StatCardProps & { key?: string | number })[];
  children?: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function ListPageStats({
  items,
  children,
  columns = 4,
  className,
}: ListPageStatsProps) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[columns];

  return (
    <div className={cn('grid gap-4 mb-6', colClass, className)}>
      {items
        ? items.map((item, idx) => (
            <StatCard key={item.key || idx} {...item} />
          ))
        : children}
    </div>
  );
}

// ==========================================
// 4 & 5. SEARCH & MULTI-LEVEL FILTERS BAR
// ==========================================
export interface ListPageFilterBarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onSearchSubmit?: (e?: React.FormEvent) => void;
  searchPlaceholder?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  filters?: React.ReactNode;
  children?: React.ReactNode;
  extraActions?: React.ReactNode;
  className?: string;
}

export function ListPageFilterBar({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Tìm kiếm thông tin...',
  hasActiveFilters,
  onResetFilters,
  filters,
  children,
  extraActions,
  className,
}: ListPageFilterBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) onSearchSubmit(e);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm mb-6',
        className
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-3">
        {/* Instant Search Input */}
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-9 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Xóa từ khóa"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Multi-level Filters Slot */}
        {filters && (
          <div className="flex flex-wrap items-center gap-2.5">
            {filters}
          </div>
        )}

        {children}

        {/* Action Buttons: Submit / Reset */}
        <div className="flex items-center gap-2">
          {onSearchSubmit && (
            <Button type="submit" variant="secondary" size="default" className="text-xs font-semibold">
              <Search className="h-3.5 w-3.5 mr-1" />
              <span>Tìm kiếm</span>
            </Button>
          )}

          {hasActiveFilters && onResetFilters && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onResetFilters}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              title="Đặt lại bộ lọc về mặc định"
            >
              <X className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <span>Xóa bộ lọc</span>
            </Button>
          )}

          {extraActions}
        </div>
      </form>
    </div>
  );
}

// ==========================================
// 6. DATA TABLE CONTAINER
// ==========================================
export interface ListPageTableContainerProps {
  children: React.ReactNode;
  className?: string;
  tableClassName?: string;
}

export function ListPageTableContainer({
  children,
  className,
}: ListPageTableContainerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden mb-6',
        className
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// ==========================================
// 7. PAGINATION BLOCK
// ==========================================
export interface ListPagePaginationProps extends PaginationProps {}

export function ListPagePagination(props: ListPagePaginationProps) {
  return <Pagination {...props} />;
}

// ==========================================
// 8. LOADING / EMPTY / ERROR STATES
// ==========================================
export interface ListPageStateProps {
  isLoading?: boolean;
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  isFiltered?: boolean;
  onResetFilters?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  createLabel?: string;
  onCreate?: () => void;
  createHref?: string;
  emptyIcon?: LucideIcon | React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  className?: string;
}

export function ListPageState({
  isLoading,
  loadingText = 'Đang tải dữ liệu...',
  error,
  onRetry,
  isEmpty,
  isFiltered,
  onResetFilters,
  emptyTitle,
  emptyDescription,
  createLabel,
  onCreate,
  createHref,
  emptyIcon,
  children,
  className,
}: ListPageStateProps) {
  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{loadingText}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-6', className)}>
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty) {
    if (isFiltered) {
      return (
        <div className={cn('p-6', className)}>
          <EmptySearchState onReset={onResetFilters} />
        </div>
      );
    }

    return (
      <div className={cn('p-6', className)}>
        <EmptyDataState
          title={emptyTitle}
          description={emptyDescription}
          createLabel={createLabel}
          onCreate={onCreate}
          createHref={createHref}
          icon={emptyIcon}
        />
      </div>
    );
  }

  return <>{children}</>;
}

// ==========================================
// FULL UNIFIED LIST PAGE LAYOUT COMPONENT
// ==========================================
export interface ListPageLayoutProps {
  // Block 1 & 2: Header & Actions
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;

  // Block 3: Summary Stats
  stats?: (StatCardProps & { key?: string | number })[] | React.ReactNode;
  statsColumns?: 2 | 3 | 4 | 5;

  // Block 4 & 5: Search & Filters
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onSearchSubmit?: (e?: React.FormEvent) => void;
  searchPlaceholder?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  filters?: React.ReactNode;
  extraFilterActions?: React.ReactNode;

  // Notification Banner
  notification?: React.ReactNode;

  // Block 6: Table Content
  children?: React.ReactNode;

  // Block 7: Pagination
  pagination?: PaginationProps;

  // Block 8: States
  isLoading?: boolean;
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  createLabel?: string;
  onCreate?: () => void;
  createHref?: string;
  emptyIcon?: LucideIcon | React.ComponentType<{ className?: string }>;

  className?: string;
}

export function ListPageLayout({
  title,
  description,
  breadcrumbs,
  actions,
  stats,
  statsColumns = 4,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder,
  hasActiveFilters,
  onResetFilters,
  filters,
  extraFilterActions,
  notification,
  children,
  pagination,
  isLoading,
  loadingText,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  createLabel,
  onCreate,
  createHref,
  emptyIcon,
  className,
}: ListPageLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Block 1 & 2: Header and Actions */}
      <ListPageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {/* Notification banner if present */}
      {notification}

      {/* Block 3: Summary Stats Cards */}
      {stats && (
        <>
          {Array.isArray(stats) ? (
            <ListPageStats items={stats} columns={statsColumns} />
          ) : (
            stats
          )}
        </>
      )}

      {/* Block 4 & 5: Search and Multi-level Filters */}
      {(onSearchChange !== undefined || filters !== undefined) && (
        <ListPageFilterBar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
          searchPlaceholder={searchPlaceholder}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={onResetFilters}
          filters={filters}
          extraActions={extraFilterActions}
        />
      )}

      {/* Block 6, 7 & 8: Data Table + Pagination + State Handling */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <ListPageState
          isLoading={isLoading}
          loadingText={loadingText}
          error={error}
          onRetry={onRetry}
          isEmpty={isEmpty}
          isFiltered={hasActiveFilters}
          onResetFilters={onResetFilters}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          createLabel={createLabel}
          onCreate={onCreate}
          createHref={createHref}
          emptyIcon={emptyIcon}
        >
          {/* Block 6: Data Table */}
          <div className="overflow-x-auto">{children}</div>

          {/* Block 7: Pagination */}
          {pagination && <Pagination {...pagination} />}
        </ListPageState>
      </div>
    </div>
  );
}
