'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  from?: number | null;
  to?: number | null;
  perPage?: number;
  perPageOptions?: number[];
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  itemLabel?: string;
  disabled?: boolean;
  showPerPage?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  from,
  to,
  perPage,
  perPageOptions = [10, 15, 25, 50],
  onPageChange,
  onPerPageChange,
  itemLabel = 'bản ghi',
  disabled = false,
  showPerPage = false,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && (!totalItems || totalItems <= 0)) {
    return null;
  }

  // Calculate items range if not provided
  const computedFrom =
    from !== undefined && from !== null
      ? from
      : (currentPage - 1) * (perPage || 10) + 1;
  const computedTo =
    to !== undefined && to !== null
      ? to
      : totalItems !== undefined
      ? Math.min(currentPage * (perPage || 10), totalItems)
      : currentPage * (perPage || 10);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Always include page 1
    pages.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push('ellipsis-start');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push('ellipsis-end');
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 select-none',
        className
      )}
    >
      {/* Information text & Per-page selector */}
      <div className="flex flex-wrap items-center gap-3">
        {totalItems !== undefined ? (
          <div>
            Hiển thị{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {totalItems > 0 ? computedFrom : 0}
            </span>
            {' - '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {computedTo}
            </span>{' '}
            trong tổng số{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {totalItems}
            </span>{' '}
            {itemLabel}
          </div>
        ) : (
          <div>
            Trang{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {currentPage}
            </span>{' '}
            / {totalPages}
          </div>
        )}

        {showPerPage && onPerPageChange && perPage && (
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
            <span>Hiển thị</span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              disabled={disabled}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 px-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>dòng/trang</span>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={disabled || currentPage <= 1}
            aria-label="Trang đầu"
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={disabled || currentPage <= 1}
            aria-label="Trang trước"
            className="inline-flex h-8 items-center gap-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Trước</span>
          </button>

          {/* Numeric Page Buttons */}
          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((p, idx) => {
              if (typeof p === 'string') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex h-8 w-6 items-center justify-center text-slate-400 select-none text-xs"
                  >
                    ...
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  disabled={disabled}
                  aria-label={`Trang ${p}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 min-w-[32px] px-2 items-center justify-center rounded-lg text-xs font-medium transition-colors',
                    isCurrent
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={disabled || currentPage >= totalPages}
            aria-label="Trang tiếp"
            className="inline-flex h-8 items-center gap-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
          >
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || currentPage >= totalPages}
            aria-label="Trang cuối"
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
