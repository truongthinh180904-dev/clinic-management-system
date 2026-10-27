import React from 'react';

export default function PatientDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>

      <div className="h-28 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 animate-pulse"></div>

      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải hồ sơ bệnh nhân...</p>
      </div>
    </div>
  );
}
