'use client';

import { useAuth } from '@/lib/auth/auth-context';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold">
          Xin chào, {user?.employee?.full_name || user?.username}!
        </h2>
        <p className="mt-1 text-sm text-blue-100">
          Chào mừng bạn đến với hệ thống quản lý phòng khám QLPK. Phiên làm việc đang hoạt động với vai trò{' '}
          <span className="font-semibold underline">
            {user?.roles?.[0]?.name || 'Nhân viên'}
          </span>.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Trạng thái</span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              {user?.status}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Hoạt động</p>
          <p className="mt-1 text-xs text-slate-400">Đăng nhập thành công</p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Vai trò</span>
            <span className="text-base">🛡️</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {user?.roles?.length || 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {user?.roles?.map((r) => r.name).join(', ') || 'Chưa gán vai trò'}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Quyền hạn</span>
            <span className="text-base">🔑</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {user?.permissions?.length || 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">Quyền trong hệ thống</p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Đăng nhập gần nhất</span>
            <span className="text-base">⏱️</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white truncate">
            {user?.last_login_at
              ? new Date(user.last_login_at).toLocaleString('vi-VN')
              : 'Phiên đầu tiên'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Ghi nhận bởi audit log</p>
        </div>
      </div>

      {/* Permissions and Details Overview */}
      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          Chi tiết tài khoản & Danh sách quyền hạn
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Tên đăng nhập:</p>
            <p className="font-medium text-slate-900 dark:text-white">{user?.username}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Email:</p>
            <p className="font-medium text-slate-900 dark:text-white">{user?.email}</p>
          </div>
          {user?.employee && (
            <>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Mã nhân viên:</p>
                <p className="font-medium text-slate-900 dark:text-white">{user.employee.employee_code}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Chức vụ / Phòng ban:</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {user.employee.position || 'N/A'} - {user.employee.department || 'N/A'}
                </p>
              </div>
            </>
          )}
        </div>

        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Các quyền được cấp (Permissions):
        </h4>
        <div className="flex flex-wrap gap-2">
          {user?.permissions && user.permissions.length > 0 ? (
            user.permissions.map((perm) => (
              <span
                key={perm}
                className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 text-xs font-mono text-slate-700 dark:text-slate-300"
              >
                {perm}
              </span>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">Chưa có quyền hạn chi tiết.</p>
          )}
        </div>
      </div>
    </div>
  );
}
