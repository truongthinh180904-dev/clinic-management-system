'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  FileText,
  User,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Eye,
  Check,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getApprovalRequests,
  approveApprovalRequest,
  rejectApprovalRequest,
} from '@/lib/api/notifications';
import {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalRequestType,
} from '@/types/notification';

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reject dialog state
  const [rejectingItem, setRejectingItem] = useState<ApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Detail dialog state
  const [detailItem, setDetailItem] = useState<ApprovalRequest | null>(null);

  // Approve action loading state
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Fetch approval requests
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await getApprovalRequests({
        status: statusFilter,
        request_type: typeFilter || undefined,
        search: searchQuery.trim() || undefined,
        per_page: 50,
      });

      if (response.success && Array.isArray(response.data)) {
        setRequests(response.data);
      } else {
        setRequests([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách yêu cầu phê duyệt.';
      setErrorMsg(msg);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Handle Approve
  const handleApprove = async (req: ApprovalRequest) => {
    if (approvingId !== null) return;
    setApprovingId(req.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await approveApprovalRequest(req.id);
      if (res.success) {
        setSuccessMsg(`Đã phê duyệt thành công yêu cầu #${req.id}.`);
        loadRequests();
      } else {
        setErrorMsg(res.message || 'Không thể phê duyệt yêu cầu.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi phê duyệt yêu cầu.';
      setErrorMsg(msg);
    } finally {
      setApprovingId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (req: ApprovalRequest) => {
    setRejectingItem(req);
    setRejectionReason('');
    setRejectError(null);
  };

  // Submit Reject
  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setRejectError('Vui lòng nhập lý do từ chối yêu cầu.');
      return;
    }

    setIsSubmittingReject(true);
    setRejectError(null);
    try {
      const res = await rejectApprovalRequest(rejectingItem.id, {
        rejection_reason: trimmed,
      });
      if (res.success) {
        setSuccessMsg(`Đã từ chối yêu cầu #${rejectingItem.id}.`);
        setRejectingItem(null);
        loadRequests();
      } else {
        setRejectError(res.message || 'Không thể từ chối yêu cầu.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi từ chối yêu cầu.';
      setRejectError(msg);
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="gap-1 font-medium">
            <Clock className="h-3 w-3" /> Chờ phê duyệt
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge variant="success" className="gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" /> Đã duyệt
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="gap-1 font-medium">
            <XCircle className="h-3 w-3" /> Đã từ chối
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Request type label
  const getRequestTypeLabel = (type: ApprovalRequestType) => {
    switch (type) {
      case 'EXPENSE_APPROVAL':
        return 'Phiếu chi / Chi phí';
      case 'INVOICE_CANCEL':
        return 'Hủy hóa đơn';
      case 'STOCK_ADJUST':
        return 'Điều chỉnh kho';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Trung tâm Phê duyệt"
        description="Quản lý và xét duyệt các đề xuất chi phí, hủy chứng từ và kiểm kê kho toàn phòng khám"
        breadcrumbs={[
          { label: 'Điều hành chung', href: '/admin' },
          { label: 'Phê duyệt' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Làm mới
          </Button>
        }
      />

      {/* Alert Messages */}
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
          title="Tổng yêu cầu"
          value={stats.total}
          icon={FileText}
          variant="default"
          description="Toàn bộ đề xuất phát sinh"
        />
        <StatCard
          title="Chờ phê duyệt"
          value={stats.pending}
          icon={Clock}
          variant="warning"
          description="Cần cấp quản lý xử lý"
        />
        <StatCard
          title="Đã phê duyệt"
          value={stats.approved}
          icon={CheckCircle2}
          variant="success"
          description="Đã hạch toán sổ quỹ / kho"
        />
        <StatCard
          title="Đã từ chối"
          value={stats.rejected}
          icon={XCircle}
          variant="destructive"
          description="Không đáp ứng quy định"
        />
      </div>

      {/* Filter and Control Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Status Tabs Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === ''
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Tất cả ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-xs font-semibold'
                    : 'text-amber-700 dark:text-amber-400 hover:bg-amber-100/50'
                )}
              >
                <Clock className="h-3 w-3" />
                Chờ duyệt ({stats.pending})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('APPROVED')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  statusFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50'
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                Đã duyệt ({stats.approved})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('REJECTED')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  statusFilter === 'REJECTED'
                    ? 'bg-rose-600 text-white shadow-xs font-semibold'
                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100/50'
                )}
              >
                <XCircle className="h-3 w-3" />
                Đã từ chối ({stats.rejected})
              </button>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Tìm theo lý do, mã đề xuất..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Request Type Selector */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="">Tất cả loại đề xuất</option>
                <option value="EXPENSE_APPROVAL">Phiếu chi / Chi phí</option>
                <option value="INVOICE_CANCEL">Hủy hóa đơn</option>
                <option value="STOCK_ADJUST">Điều chỉnh kho</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table of Requests */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Danh sách Yêu cầu Phê duyệt</CardTitle>
              <CardDescription className="text-xs">
                Hiển thị {requests.length} đề xuất theo bộ lọc hiện tại
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-xs font-medium text-slate-500">Đang tải danh sách yêu cầu phê duyệt...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Không tìm thấy yêu cầu phê duyệt nào
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Không có đề xuất nào phù hợp với bộ lọc hiện tại hoặc tất cả các yêu cầu đã được xử lý.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Loại đề xuất</TableHead>
                  <TableHead>Chứng từ / Đối tượng</TableHead>
                  <TableHead>Người đề xuất</TableHead>
                  <TableHead>Lý do đề xuất</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((item) => {
                  const requesterName =
                    item.requester?.employee?.full_name ||
                    item.requester?.username ||
                    `User #${item.requested_by || '?'}`;

                  const approverName =
                    item.approver?.employee?.full_name ||
                    item.approver?.username ||
                    (item.approved_by ? `User #${item.approved_by}` : null);

                  const expense = item.expense || (item.reference as { expense_code?: string; amount?: number; category?: { name: string } } | undefined);

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                      <TableCell className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                        #{item.id}
                      </TableCell>

                      <TableCell>
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {getRequestTypeLabel(item.request_type)}
                        </span>
                      </TableCell>

                      <TableCell>
                        {expense && expense.expense_code ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                              {expense.expense_code}
                            </span>
                            {expense.amount !== undefined && (
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrency(expense.amount)}
                              </span>
                            )}
                            {expense.category && (
                              <span className="text-[11px] text-slate-500">
                                {expense.category.name}
                              </span>
                            )}
                          </div>
                        ) : item.reference_type ? (
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {item.reference_type} #{item.reference_id}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{requesterName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-xs">
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate" title={item.reason || ''}>
                          {item.reason || '—'}
                        </p>
                        {item.rejection_reason && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium truncate mt-0.5" title={item.rejection_reason}>
                            Lý do từ chối: {item.rejection_reason}
                          </p>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(item.created_at)}
                      </TableCell>

                      <TableCell>
                        {renderStatusBadge(item.status)}
                        {approverName && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Bởi: {approverName}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailItem(item)}
                            className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {item.status === 'PENDING' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(item)}
                                disabled={approvingId === item.id}
                                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                {approvingId === item.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                <span>Duyệt</span>
                              </Button>

                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openRejectModal(item)}
                                disabled={approvingId === item.id}
                                className="h-8 px-2.5 text-xs gap-1"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Từ chối</span>
                              </Button>
                            </>
                          )}
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

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={rejectingItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingItem(null);
            setRejectError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
              Từ chối yêu cầu phê duyệt #{rejectingItem?.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vui lòng nhập lý do cụ thể từ chối đề xuất này. Thông báo sẽ được tự động gửi cho người đề xuất.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {rejectError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {rejectError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rejection_reason" className="text-xs font-semibold">
                Lý do từ chối <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="rejection_reason"
                rows={4}
                placeholder="Ví dụ: Chứng từ hóa đơn không khớp, vượt ngân sách chi nhánh..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingItem(null)}
              disabled={isSubmittingReject}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={isSubmittingReject}
              className="gap-1.5"
            >
              {isSubmittingReject ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={detailItem !== null}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Chi tiết yêu cầu phê duyệt #{detailItem?.id}</span>
              {detailItem && renderStatusBadge(detailItem.status)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mã loại đề xuất: {detailItem && getRequestTypeLabel(detailItem.request_type)}
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Người đề xuất:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {detailItem.requester?.employee?.full_name || detailItem.requester?.username || `User #${detailItem.requested_by}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Thời gian gửi:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatDateTime(detailItem.created_at)}
                  </span>
                </div>
                {detailItem.approved_by && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Người xử lý:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {detailItem.approver?.employee?.full_name || detailItem.approver?.username || `User #${detailItem.approved_by}`}
                    </span>
                  </div>
                )}
                {detailItem.approved_at && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Thời gian xử lý:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDateTime(detailItem.approved_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Underlying Expense details if available */}
              {detailItem.expense && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 dark:text-blue-300">
                      Phiếu chi: {detailItem.expense.expense_code}
                    </span>
                    <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400">
                      {formatCurrency(detailItem.expense.amount)}
                    </span>
                  </div>
                  {detailItem.expense.category && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Danh mục chi: <span className="font-medium">{detailItem.expense.category.name}</span>
                    </div>
                  )}
                  {detailItem.expense.payment_method && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Phương thức: <span className="font-medium">{detailItem.expense.payment_method}</span>
                    </div>
                  )}
                  {detailItem.expense.description && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Mô tả chi: {detailItem.expense.description}
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Lý do đề xuất:</span>
                <p className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                  {detailItem.reason || 'Không có ghi chú thêm.'}
                </p>
              </div>

              {/* Rejection Reason if any */}
              {detailItem.rejection_reason && (
                <div>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold block mb-1">Lý do từ chối:</span>
                  <p className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs leading-relaxed">
                    {detailItem.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detailItem && detailItem.status === 'PENDING' && (
              <div className="flex items-center gap-2 w-full justify-between sm:justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    openRejectModal(item);
                  }}
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Từ chối
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    handleApprove(item);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Phê duyệt ngay
                </Button>
              </div>
            )}
            {(!detailItem || detailItem.status !== 'PENDING') && (
              <Button variant="outline" size="sm" onClick={() => setDetailItem(null)}>
                Đóng
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
