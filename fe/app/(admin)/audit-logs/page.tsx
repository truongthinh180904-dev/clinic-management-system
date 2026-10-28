'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  FileText,
  UserCheck,
  Eye,
  Download,
  AlertCircle,
  Clock,
  Terminal,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getAuditLogs, getAuditLogMetadata } from '@/lib/api/audit-logs';
import { AuditLog, AuditLogFilterParams, AuditLogMetadata } from '@/types/audit-log';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metadata, setMetadata] = useState<AuditLogMetadata>({ modules: [], actions: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Filters & Pagination
  const [filters, setFilters] = useState<AuditLogFilterParams>({
    module: '',
    action: '',
    search: '',
    page: 1,
    per_page: 20,
    sort_by: 'created_at',
    sort_direction: 'desc',
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs(filters);
      if (res.success && res.data) {
        setLogs(res.data);
        if (res.meta) {
          setPagination({
            currentPage: Number(res.meta.current_page || 1),
            lastPage: Number(res.meta.last_page || 1),
            total: Number(res.meta.total || 0),
          });
        }
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    getAuditLogMetadata()
      .then((res) => {
        if (res.success && res.data) {
          setMetadata(res.data);
        }
      })
      .catch((err) => console.error('Error fetching audit metadata:', err));
  }, []);

  const handleFilterChange = (key: keyof AuditLogFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
  };

  const openDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  // Helper for module badge
  const renderModuleBadge = (moduleName: string) => {
    switch (moduleName) {
      case 'patient_files':
        return <Badge className="bg-blue-600/10 text-blue-700 hover:bg-blue-600/20 border-blue-200">Tệp y tế</Badge>;
      case 'medical_records':
        return <Badge className="bg-purple-600/10 text-purple-700 hover:bg-purple-600/20 border-purple-200">Bệnh án</Badge>;
      case 'invoices':
      case 'finance':
      case 'cash_transactions':
        return <Badge className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 border-emerald-200">Tài chính</Badge>;
      case 'inventory':
        return <Badge className="bg-amber-600/10 text-amber-700 hover:bg-amber-600/20 border-amber-200">Kho dược</Badge>;
      case 'users':
      case 'auth':
        return <Badge className="bg-rose-600/10 text-rose-700 hover:bg-rose-600/20 border-rose-200">Bảo mật & Quyền</Badge>;
      default:
        return <Badge variant="outline">{moduleName}</Badge>;
    }
  };

  // Helper for action badge
  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'preview':
      case 'view':
        return <Badge className="bg-sky-50 text-sky-700 border-sky-300">Xem / Preview</Badge>;
      case 'download':
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-300">Tải xuống</Badge>;
      case 'export_csv':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">Xuất CSV</Badge>;
      case 'create':
        return <Badge className="bg-green-50 text-green-700 border-green-300">Tạo mới</Badge>;
      case 'update':
      case 'status_update':
      case 'update_user_roles':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-300">Cập nhật</Badge>;
      case 'delete':
        return <Badge className="bg-red-50 text-red-700 border-red-300">Xóa</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  // Quick stats calculation
  const sensitiveViewCount = logs.filter((l) => l.module === 'patient_files' || l.module === 'medical_records').length;
  const exportCount = logs.filter((l) => l.action === 'export_csv').length;
  const securityCount = logs.filter((l) => l.module === 'users' || l.module === 'auth').length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Nhật ký Kiểm toán Hệ thống (Audit Logs)
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Ghi nhận tự động, bất biến (Append-only) mọi truy vết xem hồ sơ y tế nhạy cảm, tải tệp, xuất báo cáo tài chính và phân quyền tài khoản.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-slate-50 px-3 py-1 font-mono text-slate-600 border-slate-300">
            <Lock className="w-3.5 h-3.5 mr-1 text-emerald-600 inline" />
            Bảo vệ Append-Only
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* KPI / Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Tổng bản ghi kiểm toán
            </CardTitle>
            <Database className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-slate-900">{pagination.total}</div>
            <p className="text-xs text-slate-500 mt-1">Dữ liệu kiểm toán lưu trữ nguyên trạng</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-blue-600">
              Xem tệp / Bệnh án y tế
            </CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-blue-700">{sensitiveViewCount}</div>
            <p className="text-xs text-slate-500 mt-1">Trong trang hiện tại</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-emerald-600">
              Xuất tệp CSV / Báo cáo
            </CardTitle>
            <Download className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-700">{exportCount}</div>
            <p className="text-xs text-slate-500 mt-1">Thao tác trích xuất dữ liệu ra ngoài</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-rose-600">
              Thay đổi Tài khoản & Quyền
            </CardTitle>
            <UserCheck className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-rose-700">{securityCount}</div>
            <p className="text-xs text-slate-500 mt-1">Cập nhật quyền và trạng thái</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm IP, username, mã bản ghi, bảng..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Module Filter */}
            <div>
              <select
                aria-label="Lọc theo phân hệ"
                value={filters.module || ''}
                onChange={(e) => handleFilterChange('module', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Tất cả phân hệ (Module)</option>
                <option value="patient_files">Tệp y tế (patient_files)</option>
                <option value="medical_records">Bệnh án (medical_records)</option>
                <option value="invoices">Hóa đơn (invoices)</option>
                <option value="cash_transactions">Sổ quỹ (cash_transactions)</option>
                <option value="inventory">Kho dược (inventory)</option>
                <option value="users">Tài khoản (users)</option>
                <option value="auth">Phân quyền (auth)</option>
                <option value="patients">Bệnh nhân (patients)</option>
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <select
                aria-label="Lọc theo hành động"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Tất cả hành động (Action)</option>
                <option value="view">Xem (view)</option>
                <option value="preview">Xem trước tệp (preview)</option>
                <option value="download">Tải xuống (download)</option>
                <option value="export_csv">Xuất CSV (export_csv)</option>
                <option value="create">Tạo mới (create)</option>
                <option value="update">Cập nhật (update)</option>
                <option value="status_update">Đổi trạng thái (status_update)</option>
                <option value="update_user_roles">Cấp quyền (update_user_roles)</option>
                <option value="delete">Xóa (delete)</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({
                    module: '',
                    action: '',
                    search: '',
                    page: 1,
                    per_page: 20,
                    sort_by: 'created_at',
                    sort_direction: 'desc',
                  })
                }
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Đặt lại bộ lọc
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Data Table */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b text-xs font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap w-16">ID</th>
                  <th className="py-3 px-4 whitespace-nowrap w-44">Thời gian</th>
                  <th className="py-3 px-4 whitespace-nowrap w-48">Người thực hiện</th>
                  <th className="py-3 px-4 whitespace-nowrap w-36">Phân hệ (Module)</th>
                  <th className="py-3 px-4 whitespace-nowrap w-36">Hành động</th>
                  <th className="py-3 px-4 whitespace-nowrap w-36">Bảng / ID</th>
                  <th className="py-3 px-4 whitespace-nowrap w-32">Địa chỉ IP</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap w-24">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <span>Đang tải nhật ký kiểm toán...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-slate-300" />
                        <span className="font-medium text-slate-700">Chưa có bản ghi nhật ký phù hợp.</span>
                        <span className="text-xs text-slate-400">Hãy thử nới lỏng điều kiện tìm kiếm hoặc khoảng thời gian.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => openDetail(log)}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        #{log.id}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-mono text-xs">
                        {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.user ? (
                          <div>
                            <div className="font-medium text-slate-900 text-xs">
                              {log.user.full_name || log.user.username}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              @{log.user.username}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Hệ thống / Ẩn danh</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderModuleBadge(log.module)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                        {log.table_name}
                        {log.record_id && (
                          <span className="text-slate-400"> #{log.record_id}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-500">
                        {log.ip_address || '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary group-hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(log);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-slate-50/50 text-xs text-slate-600">
              <div>
                Hiển thị trang <span className="font-semibold text-slate-900">{pagination.currentPage}</span> / <span className="font-semibold text-slate-900">{pagination.lastPage}</span> (Tổng cộng <span className="font-semibold text-slate-900">{pagination.total}</span> bản ghi)
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pagination.currentPage <= 1 || loading}
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-0.5" />
                  Trước
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pagination.currentPage >= pagination.lastPage || loading}
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                >
                  Sau
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Terminal className="w-5 h-5 text-primary" />
              Chi tiết Nhật ký Kiểm toán #{selectedLog?.id}
            </DialogTitle>
            <DialogDescription>
              Toàn bộ dữ liệu ghi nhận tại thời điểm phát sinh thao tác, không thể sửa đổi hoặc xóa bỏ.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2 text-sm">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Thời gian:</span>
                  <p className="font-mono text-slate-800 mt-0.5">
                    {new Date(selectedLog.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Người thực hiện:</span>
                  <p className="font-medium text-slate-800 mt-0.5">
                    {selectedLog.user?.full_name || selectedLog.user?.username || 'Hệ thống'}
                    {selectedLog.user && <span className="text-slate-400 font-mono"> (@{selectedLog.user.username})</span>}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Phân hệ & Hành động:</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {renderModuleBadge(selectedLog.module)}
                    {renderActionBadge(selectedLog.action)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Bảng & Record ID:</span>
                  <p className="font-mono text-slate-800 mt-0.5">
                    {selectedLog.table_name} #{selectedLog.record_id || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Địa chỉ IP:</span>
                  <p className="font-mono text-slate-800 mt-0.5">{selectedLog.ip_address || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">User Agent:</span>
                  <p className="font-mono text-slate-600 truncate mt-0.5" title={selectedLog.user_agent || ''}>
                    {selectedLog.user_agent || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Data Diff */}
              {selectedLog.old_values && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                    Dữ liệu trước thay đổi (Old Values):
                  </h4>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-xs font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    Dữ liệu sau thay đổi / Chi tiết thao tác (New Values):
                  </h4>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-xs font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}

              {!selectedLog.old_values && !selectedLog.new_values && (
                <div className="text-center py-4 text-xs text-slate-400 italic">
                  Thao tác này chỉ truy xuất / đọc dữ liệu, không có thay đổi nội dung trường (payload trống).
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
