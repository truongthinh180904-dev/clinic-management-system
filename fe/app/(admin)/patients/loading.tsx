import React from 'react';

export default function PatientsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mt-2"></div>
        </div>
        <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
      </div>

      <div className="h-16 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse"></div>

      <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách bệnh nhân...</p>
      </div>
    </div>
  );
}
