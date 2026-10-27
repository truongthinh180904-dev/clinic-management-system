'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

interface AdminShellProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  permission?: string;
  role?: string;
}

const navItems: NavItem[] = [
  { name: 'Tổng quan', href: '/admin', icon: '📊' },
  { name: 'Bệnh nhân', href: '/patients', icon: '🧑‍🤝‍🧑', permission: 'patients.view' },
  { name: 'Tiếp nhận', href: '/admin/reception', icon: '👥', permission: 'patients.view' },
  { name: 'Lịch hẹn', href: '/admin/appointments', icon: '📅', permission: 'appointments.view' },
  { name: 'Khám bệnh', href: '/admin/consultations', icon: '🩺', permission: 'encounters.view' },
  { name: 'Dịch vụ & Gói', href: '/admin/services', icon: '💊', permission: 'services.view' },
  { name: 'Nhân sự', href: '/employees', icon: '🧑‍⚕️', permission: 'employees.view' },
  { name: 'Tài khoản & Quyền', href: '/users', icon: '🛡️', permission: 'users.view', role: 'ADMIN' },
];

function AdminNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="p-4 space-y-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/admin' && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const { user, isLoading, isAuthenticated, logout, hasPermission, hasRole } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Đang tải phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = user.employee?.full_name || user.username;
  const roleName = user.roles?.[0]?.name || 'Nhân viên';

  const visibleNavItems = navItems.filter((item) => {
    if (item.role && !hasRole(item.role)) return false;
    if (item.permission && !hasPermission(item.permission) && !hasRole('ADMIN')) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col justify-between">
        <div>
          {/* Logo / Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              QLPK Clinic
            </span>
          </div>

          {/* Navigation Links */}
          <Suspense
            fallback={
              <nav className="p-4 space-y-1">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                ))}
              </nav>
            }
          >
            <AdminNavLinks items={visibleNavItems} />
          </Suspense>
        </div>

        {/* Sidebar Footer: Clinic status */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Hệ thống QLPK v1.0</p>
          <p>Phòng khám đa khoa thông minh</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8">
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">
              Hệ Thống Quản Lý Phòng Khám
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* User profile capsule */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {displayName}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {roleName}
                  </span>
                </div>
              </div>
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Đăng xuất"
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default AdminShell;
