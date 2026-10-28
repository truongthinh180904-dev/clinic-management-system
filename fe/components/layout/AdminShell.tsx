'use client';

import React, { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getNotifications } from '@/lib/api/notifications';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Stethoscope,
  Sparkles,
  PackageCheck,
  Receipt,
  CreditCard,
  Wallet,
  Boxes,
  Target,
  BarChart3,
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  UserCog,
  ShieldCheck,
  LogOut,
  Menu,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Hospital,
  Activity,
} from 'lucide-react';

interface AdminShellProps {
  children: React.ReactNode;
}

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  role?: string;
  badge?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    id: 'general',
    title: 'ĐIỀU HÀNH CHUNG',
    items: [
      { name: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
      { name: 'Phê duyệt', href: '/approvals', icon: CheckCircle2, permission: 'approvals.view' },
      { name: 'Thông báo', href: '/notifications', icon: Bell, permission: 'notifications.view' },
    ],
  },
  {
    id: 'clinical',
    title: 'KHÁM CHỮA BỆNH',
    items: [
      { name: 'Bệnh nhân', href: '/patients', icon: Users, permission: 'patients.view' },
      { name: 'Lịch hẹn', href: '/appointments', icon: CalendarClock, permission: 'appointments.view' },
      { name: 'Lượt khám & Bệnh án', href: '/visits', icon: Stethoscope, permission: 'visits.view' },
      { name: 'Dịch vụ', href: '/services', icon: Sparkles, permission: 'services.view' },
      { name: 'Gói dịch vụ', href: '/packages', icon: PackageCheck, permission: 'service_packages.view' },
    ],
  },
  {
    id: 'finance-inventory',
    title: 'TÀI CHÍNH & KHO DƯỢC',
    items: [
      { name: 'Hóa đơn & Thu ngân', href: '/invoices', icon: Receipt, permission: 'invoices.view' },
      { name: 'Công nợ', href: '/debts', icon: CreditCard, permission: 'debts.view' },
      { name: 'Thu chi & Sổ quỹ', href: '/finance/cashbook', icon: Wallet, permission: 'cash_transactions.view' },
      { name: 'Kho Thuốc & Vật tư', href: '/inventory', icon: Boxes, permission: 'inventory.view' },
    ],
  },
  {
    id: 'management-reports',
    title: 'QUẢN TRỊ & BÁO CÁO',
    items: [
      { name: 'KPI Nhân viên', href: '/kpi', icon: Target, permission: 'kpi_targets.view' },
      { name: 'Báo cáo Quản trị', href: '/reports', icon: BarChart3, permission: 'reports.view' },
      { name: 'Import / Export', href: '/data-transfer', icon: ArrowLeftRight, permission: 'exports.view' },
      { name: 'Nhân sự', href: '/employees', icon: UserCog, permission: 'employees.view' },
      { name: 'Tài khoản & Quyền', href: '/users', icon: ShieldCheck, permission: 'users.view', role: 'ADMIN' },
    ],
  },
];

function getRoleBadgeVariant(roleName?: string): 'destructive' | 'info' | 'success' | 'warning' | 'default' | 'secondary' {
  if (!roleName) return 'secondary';
  const upper = roleName.toUpperCase();
  if (upper.includes('ADMIN')) return 'default';
  if (upper.includes('BÁC SĨ') || upper.includes('DOCTOR')) return 'info';
  if (upper.includes('TIẾP ĐÓN') || upper.includes('LỄ TÂN') || upper.includes('RECEPTIONIST')) return 'success';
  if (upper.includes('KẾ TOÁN') || upper.includes('THU NGÂN') || upper.includes('CASHIER') || upper.includes('ACCOUNTANT')) return 'warning';
  if (upper.includes('QUẢN LÝ') || upper.includes('MANAGER')) return 'destructive';
  return 'secondary';
}

function findCurrentModule(pathname: string | null): { groupTitle: string; itemName: string } {
  if (!pathname) return { groupTitle: 'HỆ THỐNG', itemName: 'Tổng quan' };
  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))) {
        return { groupTitle: group.title, itemName: item.name };
      }
    }
  }
  return { groupTitle: 'HỆ THỐNG QLPK', itemName: 'Phân hệ quản trị' };
}

interface NavContentProps {
  groups: NavGroup[];
  onItemClick?: () => void;
  unreadCount?: number;
  isCollapsed?: boolean;
}

function NavContent({
  groups,
  onItemClick,
  unreadCount = 0,
  isCollapsed = false,
}: NavContentProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5" aria-label="Danh mục điều hướng">
      {groups.map((group) => (
        <div key={group.id} className="space-y-1">
          {isCollapsed ? (
            <div className="py-2 flex justify-center" title={group.title}>
              <div className="h-px w-6 bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="px-3 py-1">
              <h2 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500 truncate">
                {group.title}
              </h2>
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && (pathname?.startsWith(item.href) ?? false));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  title={item.name}
                  aria-label={item.name}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between',
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  )}
                >
                  <div className={cn('flex items-center gap-3 min-w-0', isCollapsed && 'justify-center')}>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                      )}
                      aria-hidden="true"
                    />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </div>
                  {item.href === '/notifications' && unreadCount > 0 && (
                    isCollapsed ? (
                      <span
                        className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950"
                        title={`${unreadCount} thông báo chưa đọc`}
                      />
                    ) : (
                      <span className="ml-auto mr-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )
                  )}
                  {!isCollapsed && isActive && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400 opacity-80" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function TopbarBreadcrumb() {
  const pathname = usePathname();
  const currentModule = useMemo(() => findCurrentModule(pathname), [pathname]);

  return (
    <nav aria-label="Đường dẫn phân hệ" className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium truncate max-w-[120px] sm:max-w-none">{currentModule.groupTitle}</span>
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
      <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px] sm:max-w-none">
        {currentModule.itemName}
      </h1>
    </nav>
  );
}

function MobileMenuCloseOnRouteChange({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const prevPathnameRef = React.useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);
  return null;
}

function AdminShellInner({ children }: AdminShellProps) {
  const { user, isLoading, isAuthenticated, logout, hasPermission, hasRole } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Initialize collapse preference from localStorage and auto-collapse for tablet/laptop viewports
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qlpk_sidebar_collapsed');
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      } else if (window.innerWidth >= 1024 && window.innerWidth < 1280) {
        // Auto-collapse on tablet / smaller desktop screens for comfortable table layout
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('qlpk_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard accessibility: Escape to close mobile menu, Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, toggleSidebar]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await getNotifications({ unread_only: 1, per_page: 1 });
      if (typeof res?.unread_count === 'number') {
        setUnreadNotificationsCount(res.unread_count);
      }
    } catch {
      // Graceful degradation when offline or backend unreachable
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(timer);
  }, [fetchUnreadCount]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const filteredItems = group.items.filter((item) => {
          if (hasRole('ADMIN')) return true;
          if (item.role && !hasRole(item.role)) return false;
          if (item.permission && !hasPermission(item.permission)) return false;
          return true;
        });
        return { ...group, items: filteredItems };
      })
      .filter((group) => group.items.length > 0);
  }, [hasRole, hasPermission]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" role="status" aria-label="Đang tải"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Đang tải phiên làm việc phòng khám...
          </p>
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
  const roleBadgeVariant = getRoleBadgeVariant(roleName);

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <Suspense fallback={null}>
        <MobileMenuCloseOnRouteChange onClose={closeMobileMenu} />
      </Suspense>

      {/* Skip to Main Content Link for Keyboard and Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white text-sm font-medium"
      >
        Chuyển đến nội dung chính
      </a>

      {/* Desktop Sidebar (Collapsible: w-64 expanded, w-20 collapsed) */}
      <aside
        aria-label="Thanh điều hướng chính"
        className={cn(
          'hidden lg:flex flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Sidebar Brand Header */}
        <div
          className={cn(
            'h-16 flex items-center border-b border-slate-200 dark:border-slate-800',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          )}
        >
          {isCollapsed ? (
            <Link
              href="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
              title="QLPK Clinic - Medical Smart SaaS"
              aria-label="Trang chủ QLPK Clinic"
            >
              <Hospital className="h-5 w-5" />
            </Link>
          ) : (
            <>
              <Link href="/admin" className="flex items-center gap-2.5 group min-w-0" aria-label="Trang chủ QLPK Clinic">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-colors shrink-0">
                  <Hospital className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                    QLPK Clinic
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    Medical Smart SaaS
                  </span>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Thu gọn thanh điều hướng (Ctrl+B)"
                title="Thu gọn (Ctrl+B)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          <Suspense
            fallback={
              <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
            }
          >
            <NavContent
              groups={filteredGroups}
              unreadCount={unreadNotificationsCount}
              isCollapsed={isCollapsed}
            />
          </Suspense>
        </div>

        {/* Sidebar Footer */}
        <div
          className={cn(
            'p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50',
            isCollapsed ? 'flex justify-center' : 'flex items-center justify-between'
          )}
        >
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Mở rộng thanh điều hướng (Ctrl+B)"
              title="Mở rộng (Ctrl+B)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                <Activity className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">Hệ thống QLPK</span>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                v2.0
              </Badge>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Danh mục điều hướng di động"
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-950 shadow-2xl flex flex-col lg:hidden transform transition-transform duration-200 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <Link
            href="/admin"
            onClick={closeMobileMenu}
            className="flex items-center gap-2.5 min-w-0"
            aria-label="Trang chủ QLPK Clinic"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <Hospital className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                QLPK Clinic
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                Medical Smart SaaS
              </span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobileMenu}
            aria-label="Đóng danh mục điều hướng"
            className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <Suspense
            fallback={
              <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
            }
          >
            <NavContent
              groups={filteredGroups}
              onItemClick={closeMobileMenu}
              unreadCount={unreadNotificationsCount}
            />
          </Suspense>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-slate-300">QLPK SmartClinic</span>
            <Badge variant="outline" className="text-[10px]">v2.0</Badge>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Header */}
        <header
          role="banner"
          className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 lg:px-8 shadow-xs"
        >
          {/* Left section: Mobile menu toggle + Current Module Breadcrumb */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-9 w-9 text-slate-700 dark:text-slate-200 shrink-0"
              aria-label="Mở danh mục điều hướng"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Suspense
              fallback={
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium truncate">HỆ THỐNG QLPK</span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                  </div>
                  <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Phân hệ quản trị
                  </h1>
                </div>
              }
            >
              <TopbarBreadcrumb />
            </Suspense>
          </div>

          {/* Right section: Search trigger + Notifications + User Profile + Logout */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Quick search display */}
            <div
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 w-44 lg:w-60 shadow-xs"
              role="search"
              aria-label="Tìm kiếm nhanh phím tắt ⌘K"
            >
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">Tìm kiếm nhanh...</span>
              <kbd className="rounded bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </div>

            {/* Notifications Shortcut with Real Unread Badge */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={
                unreadNotificationsCount > 0
                  ? `Có ${unreadNotificationsCount} thông báo chưa đọc`
                  : 'Thông báo & Cảnh báo'
              }
              aria-label={
                unreadNotificationsCount > 0
                  ? `Có ${unreadNotificationsCount} thông báo chưa đọc`
                  : 'Thông báo & Cảnh báo'
              }
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60"></span>
                  <span className="relative z-10">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                </span>
              )}
            </Link>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 sm:mx-1" aria-hidden="true" />

            {/* User Profile Capsule */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {displayName}
                </span>
                <div className="flex items-center justify-end mt-0.5">
                  <Badge variant={roleBadgeVariant} className="text-[10px] py-0 px-1.5 font-medium">
                    {roleName}
                  </Badge>
                </div>
              </div>

              <div
                className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm border border-blue-200 dark:border-blue-800 shadow-xs shrink-0"
                aria-label={`Người dùng: ${displayName} (${roleName})`}
                title={`${displayName} (${roleName})`}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Đăng xuất khỏi hệ thống"
              className="ml-0.5 sm:ml-1 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:border-rose-900/50 dark:hover:bg-rose-950/40 gap-1.5 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
              </span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main
          id="main-content"
          tabIndex={-1}
          role="main"
          aria-label="Nội dung trang quản trị"
          className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" role="status" aria-label="Đang tải"></div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Đang tải phiên làm việc phòng khám...
            </p>
          </div>
        </div>
      }
    >
      <AdminShellInner>{children}</AdminShellInner>
    </Suspense>
  );
}

export default AdminShell;
