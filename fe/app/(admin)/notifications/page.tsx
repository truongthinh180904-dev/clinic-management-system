'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  CalendarClock,
  CreditCard,
  Radar,
  RefreshCw,
  Search,
  CheckCheck,
  Trash2,
  Plus,
  SlidersHorizontal,
  X,
  AlertCircle,
  ExternalLink,
  Edit2,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { formatDateTime, formatCurrency, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  triggerAlertScan,
} from '@/lib/api/notifications';
import {
  Notification,
  AlertRule,
  AlertRuleType,
  AlertRuleStatus,
  StoreAlertRuleInput,
  ScanAlertsResponseData,
} from '@/types/notification';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'rules'>('notifications');

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(true);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Scan state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanAlertsResponseData | null>(null);

  // Alert Rules state
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState<boolean>(false);
  const [ruleModalOpen, setRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState<StoreAlertRuleInput>({
    name: '',
    alert_type: 'LOW_STOCK',
    threshold_value: null,
    threshold_days: null,
    threshold_sessions: null,
    status: 'ACTIVE',
  });
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Global messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Notifications
  const loadNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const response = await getNotifications({
        unread_only: unreadOnly ? 1 : undefined,
        type: typeFilter || undefined,
        per_page: 50,
      });

      if (response.success && Array.isArray(response.data)) {
        setNotifications(response.data);
        if (typeof response.unread_count === 'number') {
          setUnreadCount(response.unread_count);
        }
      } else {
        setNotifications([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải thông báo.';
      setErrorMsg(msg);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [unreadOnly, typeFilter]);

  // Load Alert Rules
  const loadRules = useCallback(async () => {
    setIsLoadingRules(true);
    try {
      const response = await getAlertRules();
      if (response.success && Array.isArray(response.data)) {
        setRules(response.data);
      } else {
        setRules([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải quy tắc cảnh báo.';
      setErrorMsg(msg);
      setRules([]);
    } finally {
      setIsLoadingRules(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (activeTab === 'rules') {
      loadRules();
    }
  }, [activeTab, loadRules]);

  // Trigger automated alerts scan
  const handleTriggerScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanResult(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await triggerAlertScan();
      if (res.success && res.data) {
        setScanResult(res.data);
        setSuccessMsg(
          `Quét cảnh báo thành công: đã kiểm tra ${res.data.scanned_rules_count} quy tắc, phát sinh ${res.data.notifications_created} thông báo mới.`
        );
        loadNotifications();
        if (activeTab === 'rules') {
          loadRules();
        }
      } else {
        setErrorMsg(res.message || 'Không thể thực hiện quét cảnh báo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi quét cảnh báo tự động.';
      setErrorMsg(msg);
    } finally {
      setIsScanning(false);
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (notif: Notification) => {
    try {
      const res = await markNotificationAsRead(notif.id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật thông báo.';
      setErrorMsg(msg);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const res = await markAllNotificationsAsRead();
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
        setSuccessMsg('Đã đánh dấu tất cả thông báo là đã đọc.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi đánh dấu đã đọc.';
      setErrorMsg(msg);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: number) => {
    try {
      const res = await deleteNotification(id);
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setSuccessMsg('Đã xóa thông báo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa thông báo.';
      setErrorMsg(msg);
    }
  };

  // Open modal to create rule
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleFormData({
      name: '',
      alert_type: 'LOW_STOCK',
      threshold_value: null,
      threshold_days: null,
      threshold_sessions: null,
      status: 'ACTIVE',
    });
    setRuleError(null);
    setRuleModalOpen(true);
  };

  // Open modal to edit rule
  const handleOpenEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setRuleFormData({
      name: rule.name,
      alert_type: rule.alert_type,
      threshold_value: rule.threshold_value ?? null,
      threshold_days: rule.threshold_days ?? null,
      threshold_sessions: rule.threshold_sessions ?? null,
      status: rule.status,
    });
    setRuleError(null);
    setRuleModalOpen(true);
  };

  // Save rule (create or update)
  const handleSaveRule = async () => {
    const trimmedName = ruleFormData.name.trim();
    if (!trimmedName) {
      setRuleError('Vui lòng nhập tên quy tắc cảnh báo.');
      return;
    }

    setIsSavingRule(true);
    setRuleError(null);
    try {
      if (editingRule) {
        const res = await updateAlertRule(editingRule.id, {
          ...ruleFormData,
          name: trimmedName,
        });
        if (res.success) {
          setSuccessMsg(`Cập nhật quy tắc "${trimmedName}" thành công.`);
          setRuleModalOpen(false);
          loadRules();
        } else {
          setRuleError(res.message || 'Lỗi khi cập nhật quy tắc.');
        }
      } else {
        const res = await createAlertRule({
          ...ruleFormData,
          name: trimmedName,
        });
        if (res.success) {
          setSuccessMsg(`Thêm quy tắc "${trimmedName}" thành công.`);
          setRuleModalOpen(false);
          loadRules();
        } else {
          setRuleError(res.message || 'Lỗi khi tạo quy tắc.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu quy tắc cảnh báo.';
      setRuleError(msg);
    } finally {
      setIsSavingRule(false);
    }
  };

  // Delete rule
  const handleDeleteRule = async (rule: AlertRule) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa quy tắc cảnh báo "${rule.name}"?`)) return;
    try {
      const res = await deleteAlertRule(rule.id);
      if (res.success) {
        setSuccessMsg(`Đã xóa quy tắc cảnh báo "${rule.name}".`);
        loadRules();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa quy tắc.';
      setErrorMsg(msg);
    }
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    let list = notifications;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [notifications, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = unreadCount;
    const lowStock = notifications.filter((n) => n.type === 'LOW_STOCK').length;
    const otherAlerts = notifications.filter(
      (n) => n.type === 'PACKAGE_EXPIRING' || n.type === 'OVERDUE_INVOICE'
    ).length;
    return { total, unread, lowStock, otherAlerts };
  }, [notifications, unreadCount]);

  // Icon and Color by notification type
  const getNotificationIconInfo = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return {
          icon: Boxes,
          bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
          badgeVariant: 'warning' as const,
          label: 'Tồn kho thấp',
          link: '/inventory',
        };
      case 'PACKAGE_EXPIRING':
        return {
          icon: CalendarClock,
          bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
          badgeVariant: 'secondary' as const,
          label: 'Gói khám sắp hết hạn',
          link: '/packages',
        };
      case 'OVERDUE_INVOICE':
        return {
          icon: CreditCard,
          bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
          badgeVariant: 'destructive' as const,
          label: 'Hóa đơn quá hạn nợ',
          link: '/debts',
        };
      case 'APPROVAL_REQUEST':
      case 'APPROVAL_STATUS':
        return {
          icon: CheckCircle2,
          bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
          badgeVariant: 'info' as const,
          label: 'Phê duyệt',
          link: '/approvals',
        };
      default:
        return {
          icon: Bell,
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          badgeVariant: 'default' as const,
          label: 'Hệ thống',
          link: null,
        };
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Trung tâm Thông báo & Cảnh báo"
        description="Theo dõi biến động vận hành, tồn kho tối thiểu, hạn dùng gói khám và thiết lập quy tắc tự động"
        breadcrumbs={[
          { label: 'Điều hành chung', href: '/admin' },
          { label: 'Thông báo' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleTriggerScan}
              disabled={isScanning}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs"
            >
              <Radar className={cn('h-4 w-4', isScanning && 'animate-spin')} />
              <span>{isScanning ? 'Đang quét dữ liệu...' : 'Quét cảnh báo ngay'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadNotifications();
                if (activeTab === 'rules') loadRules();
              }}
              disabled={isLoadingNotifications}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isLoadingNotifications && 'animate-spin')} />
              <span>Làm mới</span>
            </Button>
          </div>
        }
      />

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 dark:hover:text-rose-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng thông báo"
          value={stats.total}
          icon={Bell}
          variant="default"
          description="Lịch sử thông báo tài khoản"
        />
        <StatCard
          title="Chưa đọc"
          value={stats.unread}
          icon={AlertCircle}
          variant={stats.unread > 0 ? 'warning' : 'success'}
          description="Cần kiểm tra và xử lý"
        />
        <StatCard
          title="Cảnh báo tồn kho"
          value={stats.lowStock}
          icon={Boxes}
          variant="warning"
          description="Dưới ngưỡng định mức tối thiểu"
        />
        <StatCard
          title="Gói khám & Công nợ"
          value={stats.otherAlerts}
          icon={CalendarClock}
          variant="primary"
          description="Sắp hết hạn hoặc chậm thu"
        />
      </div>

      {/* Tabs Switcher */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'notifications' | 'rules')}
      >
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1">
          <TabsTrigger value="notifications" className="gap-2 text-xs">
            <Bell className="h-4 w-4" />
            <span>Thông báo & Cảnh báo</span>
            {unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2 text-xs">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Cấu hình Quy tắc Cảnh báo</span>
            <span className="ml-1 text-[11px] text-slate-400 font-mono">
              ({rules.length})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: NOTIFICATIONS LIST */}
        <TabsContent value="notifications" className="space-y-4 pt-2">
          {/* Controls Bar */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                {/* Unread Switch & Type Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={unreadOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUnreadOnly(!unreadOnly)}
                    className={cn(
                      'text-xs gap-1.5',
                      unreadOnly && 'bg-amber-500 hover:bg-amber-600 text-white'
                    )}
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Chỉ chưa đọc</span>
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-1 bg-white/20 text-white">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Tất cả phân loại</option>
                    <option value="LOW_STOCK">Tồn kho thấp (LOW_STOCK)</option>
                    <option value="PACKAGE_EXPIRING">Gói khám sắp hết hạn</option>
                    <option value="OVERDUE_INVOICE">Hóa đơn nợ quá hạn</option>
                    <option value="APPROVAL_REQUEST">Đề xuất phê duyệt</option>
                    <option value="APPROVAL_STATUS">Kết quả phê duyệt</option>
                  </select>

                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 gap-1.5"
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span>Đánh dấu tất cả đã đọc</span>
                    </Button>
                  )}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Tìm kiếm thông báo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* List of Notification Items */}
          <div className="space-y-3">
            {isLoadingNotifications ? (
              <Card>
                <CardContent className="p-12 flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                  <p className="text-xs font-medium text-slate-500">Đang tải danh sách thông báo...</p>
                </CardContent>
              </Card>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                    <CheckCheck className="h-6 w-6 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Bạn không có thông báo mới nào
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Mọi hoạt động vận hành, tồn kho và công nợ hiện đang trong trạng thái bình thường.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notif) => {
                const info = getNotificationIconInfo(notif.type);
                const IconComponent = info.icon;

                return (
                  <Card
                    key={notif.id}
                    className={cn(
                      'transition-all duration-150',
                      !notif.is_read
                        ? 'border-blue-200 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/10 shadow-xs'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-900/40'
                    )}
                  >
                    <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={cn(
                          'p-2.5 rounded-xl shrink-0 transition-colors',
                          info.bg
                        )}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={info.badgeVariant} className="text-[10px] py-0 px-2">
                            {info.label}
                          </Badge>
                          {!notif.is_read && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                              Chưa đọc
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 font-medium ml-auto flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(notif.created_at)}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {notif.title}
                        </h4>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {notif.message}
                        </p>

                        {/* Actions row */}
                        <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {info.link && (
                            <Link
                              href={info.link}
                              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                            >
                              <span>Xem phân hệ liên quan</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}

                          {!notif.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notif)}
                              className="h-7 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 gap-1 px-2"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Đánh dấu đã đọc</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="h-7 text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 gap-1 px-2 ml-auto"
                            title="Xóa thông báo"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Xóa</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* TAB 2: ALERT RULES CONFIGURATION */}
        <TabsContent value="rules" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">Danh sách Quy tắc Cảnh báo</CardTitle>
                  <CardDescription className="text-xs">
                    Hệ thống tự động rà soát định kỳ và kích hoạt thông báo khi các chỉ số chạm ngưỡng
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadRules}
                    disabled={isLoadingRules}
                    className="gap-2"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isLoadingRules && 'animate-spin')} />
                    <span>Tải lại</span>
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleOpenCreateRule}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Thêm quy tắc mới</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingRules ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                  <p className="text-xs font-medium text-slate-500">Đang tải cấu hình quy tắc...</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <SlidersHorizontal className="h-10 w-10 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-semibold">Chưa có quy tắc cảnh báo nào</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Hãy bấm &quot;Thêm quy tắc mới&quot; để thiết lập ngưỡng cảnh báo tồn kho, gói khám hoặc công nợ.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Tên quy tắc</TableHead>
                      <TableHead>Loại cảnh báo</TableHead>
                      <TableHead>Ngưỡng thiết lập</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="font-mono text-xs font-semibold text-slate-500">
                            #{rule.id}
                          </TableCell>

                          <TableCell>
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {rule.name}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="text-[11px] font-mono">
                              {rule.alert_type}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                            <div className="space-y-0.5">
                              {rule.threshold_value !== null && rule.threshold_value !== undefined && (
                                <div>
                                  Giá trị tiền: <span className="font-bold">{formatCurrency(rule.threshold_value)}</span>
                                </div>
                              )}
                              {rule.threshold_days !== null && rule.threshold_days !== undefined && (
                                <div>
                                  Số ngày: <span className="font-bold">{rule.threshold_days} ngày</span>
                                </div>
                              )}
                              {rule.threshold_sessions !== null && rule.threshold_sessions !== undefined && (
                                <div>
                                  Số buổi còn lại: <span className="font-bold">&le; {rule.threshold_sessions} buổi</span>
                                </div>
                              )}
                              {rule.threshold_value === null &&
                                rule.threshold_days === null &&
                                rule.threshold_sessions === null && (
                                  <span className="text-slate-400">Theo định mức danh mục</span>
                                )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={rule.status === 'ACTIVE' ? 'success' : 'secondary'}
                              className="text-[10px]"
                            >
                              {rule.status === 'ACTIVE' ? 'Đang kích hoạt' : 'Tạm dừng'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditRule(rule)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                title="Chỉnh sửa quy tắc"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteRule(rule)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                title="Xóa quy tắc"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Create / Edit Rule */}
      <Dialog
        open={ruleModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRuleModalOpen(false);
            setRuleError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
              <span>{editingRule ? 'Chỉnh sửa Quy tắc Cảnh báo' : 'Thêm Quy tắc Cảnh báo Mới'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Định nghĩa điều kiện để hệ thống tự động phát hiện và gửi thông báo cảnh báo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {ruleError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                {ruleError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rule_name" className="text-xs font-semibold">
                Tên quy tắc <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="rule_name"
                placeholder="Ví dụ: Cảnh báo tồn kho dưới 5 hộp"
                value={ruleFormData.name}
                onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule_type" className="text-xs font-semibold">
                Loại cảnh báo <span className="text-rose-500">*</span>
              </Label>
              <select
                id="rule_type"
                value={ruleFormData.alert_type}
                onChange={(e) =>
                  setRuleFormData({ ...ruleFormData, alert_type: e.target.value as AlertRuleType })
                }
                className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <option value="LOW_STOCK">Cảnh báo Tồn kho thấp (LOW_STOCK)</option>
                <option value="PACKAGE_EXPIRING">Cảnh báo Gói khám sắp hết hạn (PACKAGE_EXPIRING)</option>
                <option value="OVERDUE_INVOICE">Cảnh báo Hóa đơn nợ quá hạn (OVERDUE_INVOICE)</option>
              </select>
            </div>

            {/* Threshold Fields depending on alert_type */}
            {ruleFormData.alert_type === 'OVERDUE_INVOICE' && (
              <div className="space-y-1.5">
                <Label htmlFor="rule_value" className="text-xs font-semibold">
                  Ngưỡng số tiền nợ tối thiểu (VNĐ)
                </Label>
                <Input
                  id="rule_value"
                  type="number"
                  placeholder="Ví dụ: 500000"
                  value={ruleFormData.threshold_value ?? ''}
                  onChange={(e) =>
                    setRuleFormData({
                      ...ruleFormData,
                      threshold_value: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="text-xs h-9"
                />
              </div>
            )}

            {(ruleFormData.alert_type === 'PACKAGE_EXPIRING' || ruleFormData.alert_type === 'OVERDUE_INVOICE') && (
              <div className="space-y-1.5">
                <Label htmlFor="rule_days" className="text-xs font-semibold">
                  Số ngày trước hạn / ngày quá hạn (Ngày)
                </Label>
                <Input
                  id="rule_days"
                  type="number"
                  placeholder="Ví dụ: 7 hoặc 30"
                  value={ruleFormData.threshold_days ?? ''}
                  onChange={(e) =>
                    setRuleFormData({
                      ...ruleFormData,
                      threshold_days: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="text-xs h-9"
                />
              </div>
            )}

            {ruleFormData.alert_type === 'PACKAGE_EXPIRING' && (
              <div className="space-y-1.5">
                <Label htmlFor="rule_sessions" className="text-xs font-semibold">
                  Ngưỡng số buổi khám còn lại (Buổi)
                </Label>
                <Input
                  id="rule_sessions"
                  type="number"
                  placeholder="Ví dụ: 2"
                  value={ruleFormData.threshold_sessions ?? ''}
                  onChange={(e) =>
                    setRuleFormData({
                      ...ruleFormData,
                      threshold_sessions: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="text-xs h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rule_status" className="text-xs font-semibold">
                Trạng thái áp dụng
              </Label>
              <select
                id="rule_status"
                value={ruleFormData.status}
                onChange={(e) =>
                  setRuleFormData({ ...ruleFormData, status: e.target.value as AlertRuleStatus })
                }
                className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <option value="ACTIVE">Kích hoạt (ACTIVE)</option>
                <option value="INACTIVE">Tạm dừng (INACTIVE)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRuleModalOpen(false)}
              disabled={isSavingRule}
            >
              Hủy
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveRule}
              disabled={isSavingRule}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSavingRule && (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>{editingRule ? 'Lưu thay đổi' : 'Tạo quy tắc'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
