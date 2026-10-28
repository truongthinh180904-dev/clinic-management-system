'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CreditCard,
  Wallet,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Printer,
  Ban,
  ArrowRight,
  TrendingUp,
  FileText,
  Percent,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
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
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
  CreateInvoiceInput,
  CreatePaymentInput,
} from '@/types/invoice';
import { Patient } from '@/types/patient';
import {
  getInvoices,
  createInvoice,
  createInvoicePayment,
  cancelInvoice,
} from '@/lib/api/invoices';
import { getPatients } from '@/lib/api/patients';

export default function InvoicesPage() {
  const { hasPermission } = useAuth();

  // Data states
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination & meta
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [isCancelOpen, setIsCancelOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Create form state
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(false);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('');
  const [subtotalAmount, setSubtotalAmount] = useState<number | ''>('');
  const [discountAmount, setDiscountAmount] = useState<number | ''>(0);
  const [issuedAt, setIssuedAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Cancel form state
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        page,
        per_page: perPage,
        sort_by: 'issued_at',
        order: 'desc',
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (selectedStatus && selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (startDate) {
        params.start_date = startDate;
      }
      if (endDate) {
        params.end_date = endDate;
      }

      const res = await getInvoices(params);
      if (res && res.data) {
        setInvoices(res.data);
        if (res.meta) {
          setTotalPages(res.meta.last_page || 1);
          setTotalCount(res.meta.total || 0);
        }
      } else {
        setInvoices([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách hóa đơn.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, searchTerm, selectedStatus, startDate, endDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Load patients for create dialog
  const loadPatients = useCallback(async (query: string = '') => {
    try {
      setLoadingPatients(true);
      const res = await getPatients({ search: query, per_page: 20 });
      if (res && res.data) {
        setPatientsList(res.data);
      }
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const openCreateDialog = () => {
    setSelectedPatientId('');
    setSubtotalAmount('');
    setDiscountAmount(0);
    setIssuedAt(new Date().toISOString().slice(0, 10));
    setCreateError(null);
    setIsCreateOpen(true);
    loadPatients('');
  };

  const openPaymentDialog = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.remaining_amount > 0 ? inv.remaining_amount : '');
    setPaymentMethod('CASH');
    setReferenceCode('');
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setPaymentNotes('');
    setPaymentError(null);
    setIsPaymentOpen(true);
  };

  const openCancelDialog = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setCancelReason('');
    setCancelError(null);
    setIsCancelOpen(true);
  };

  // Quick amount calculators for payment
  const setQuickPayment = (ratio: number) => {
    if (!selectedInvoice) return;
    const remaining = Number(selectedInvoice.remaining_amount) || 0;
    if (ratio === 1) {
      setPaymentAmount(remaining);
    } else {
      setPaymentAmount(Math.round(remaining * ratio));
    }
  };

  // Submit create invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setCreateError('Vui lòng chọn bệnh nhân.');
      return;
    }
    const subtotal = Number(subtotalAmount);
    const discount = Number(discountAmount) || 0;

    if (isNaN(subtotal) || subtotal < 0) {
      setCreateError('Tổng tiền hàng phải là số không âm.');
      return;
    }
    if (discount < 0) {
      setCreateError('Số tiền giảm giá không được âm.');
      return;
    }
    if (discount > subtotal) {
      setCreateError('Số tiền giảm giá không được lớn hơn tổng tiền hàng.');
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError(null);

      const payload: CreateInvoiceInput = {
        patient_id: Number(selectedPatientId),
        subtotal_amount: subtotal,
        discount_amount: discount,
        issued_at: issuedAt,
      };

      await createInvoice(payload);
      setIsCreateOpen(false);
      const msg = 'Lập hóa đơn mới thành công.';
      setSuccessMsg(msg);
      toast.success(msg, 'Thành công');
      fetchInvoices();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi lập hóa đơn.';
      setCreateError(msg);
      toast.error(msg, 'Lỗi lập hóa đơn');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Submit payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }

    const remaining = Number(selectedInvoice.remaining_amount) || 0;
    if (amount > remaining) {
      setPaymentError(`Số tiền thanh toán (${formatCurrency(amount)}) không được vượt quá số nợ còn lại (${formatCurrency(remaining)}).`);
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      const payload: Omit<CreatePaymentInput, 'invoice_id'> = {
        amount,
        payment_method: paymentMethod,
        reference_code: referenceCode.trim() || null,
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
        notes: paymentNotes.trim() || null,
      };

      await createInvoicePayment(selectedInvoice.id, payload);
      setIsPaymentOpen(false);
      const msg = `Đã thu thành công ${formatCurrency(amount)} cho hóa đơn ${selectedInvoice.invoice_code}.`;
      setSuccessMsg(msg);
      toast.success(msg, 'Ghi nhận thanh toán');
      fetchInvoices();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi ghi nhận thanh toán.';
      setPaymentError(msg);
      toast.error(msg, 'Lỗi thanh toán');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Submit cancel invoice
  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      setCancelSubmitting(true);
      setCancelError(null);

      await cancelInvoice(selectedInvoice.id, {
        reason: cancelReason.trim() || undefined,
      });

      setIsCancelOpen(false);
      const msg = `Đã hủy hóa đơn ${selectedInvoice.invoice_code} thành công.`;
      setSuccessMsg(msg);
      toast.success(msg, 'Đã hủy hóa đơn');
      fetchInvoices();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể hủy hóa đơn.';
      setCancelError(msg);
      toast.error(msg, 'Lỗi hủy hóa đơn');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Calculate StatCard metrics across current loaded/total data
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let pendingCount = 0;

    invoices.forEach((inv) => {
      totalInvoiced += Number(inv.total_amount) || 0;
      totalCollected += Number(inv.paid_amount) || 0;
      totalRemaining += Number(inv.remaining_amount) || 0;
      if (inv.status === 'UNPAID' || inv.status === 'PARTIAL') {
        pendingCount += 1;
      }
    });

    return {
      totalInvoiced,
      totalCollected,
      totalRemaining,
      pendingCount,
    };
  }, [invoices]);

  // Helper badge for invoice status
  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="success" className="gap-1 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Đã tất toán
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge variant="warning" className="gap-1 font-semibold">
            <Clock className="h-3.5 w-3.5" />
            Thanh toán một phần
          </Badge>
        );
      case 'UNPAID':
        return (
          <Badge variant="destructive" className="gap-1 font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            Chưa thanh toán
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="secondary" className="gap-1 text-slate-500 font-medium">
            <Ban className="h-3.5 w-3.5" />
            Đã hủy
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Quản lý Hóa đơn & Thu ngân"
        description="Theo dõi vòng đời hóa đơn, tiến độ thu tiền nhiều đợt và quản lý thu chi an toàn dòng tiền."
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Tài chính & Thu ngân', href: '/invoices' },
          { label: 'Hóa đơn' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoices}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Làm mới
            </Button>
            <Button
              onClick={openCreateDialog}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow"
            >
              <Plus className="h-4 w-4" />
              Lập hóa đơn mới
            </Button>
          </div>
        }
      />

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMsg(null)}
            className="h-7 px-2 text-emerald-700 hover:bg-emerald-100"
          >
            Đóng
          </Button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-7 px-2 text-rose-700 hover:bg-rose-100"
          >
            Đóng
          </Button>
        </div>
      )}

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng giá trị hóa đơn"
          value={formatCurrency(stats.totalInvoiced)}
          icon={Receipt}
          variant="primary"
          description={`Tổng tiền của ${invoices.length} hóa đơn hiển thị`}
        />
        <StatCard
          title="Đã thực thu"
          value={formatCurrency(stats.totalCollected)}
          icon={CheckCircle2}
          variant="success"
          description={
            stats.totalInvoiced > 0
              ? `Đạt ${Math.round((stats.totalCollected / stats.totalInvoiced) * 100)}% tổng hóa đơn`
              : 'Đã nhập vào quỹ'
          }
        />
        <StatCard
          title="Còn nợ chưa thu"
          value={formatCurrency(stats.totalRemaining)}
          icon={CreditCard}
          variant={stats.totalRemaining > 0 ? 'warning' : 'default'}
          description="Công nợ cần tiếp tục đôn đốc"
        />
        <StatCard
          title="Số hóa đơn chờ thu"
          value={stats.pendingCount}
          icon={Clock}
          variant="destructive"
          description="Chưa thanh toán hoặc thu dở dang"
        />
      </div>

      {/* Search & Filters Card */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Filter Tabs/Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'UNPAID', label: 'Chưa thanh toán' },
                { id: 'PARTIAL', label: 'Một phần' },
                { id: 'PAID', label: 'Đã tất toán' },
                { id: 'CANCELLED', label: 'Đã hủy' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(tab.id);
                    setPage(1);
                  }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                    selectedStatus === tab.id
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date range pickers */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Từ:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Đến:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs w-36"
                />
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="h-8 text-xs px-2 text-slate-500 hover:text-slate-900"
                >
                  Xóa lọc
                </Button>
              )}
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm theo mã hóa đơn, tên bệnh nhân, số điện thoại, mã bệnh nhân..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-10 bg-slate-50/50 dark:bg-slate-900/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                <TableHead className="w-36 font-semibold whitespace-nowrap">Mã hóa đơn</TableHead>
                <TableHead className="font-semibold min-w-[180px] whitespace-nowrap">Bệnh nhân</TableHead>
                <TableHead className="font-semibold whitespace-nowrap min-w-[130px]">Nghiệp vụ</TableHead>
                <TableHead className="text-right font-semibold whitespace-nowrap min-w-[120px]">Tổng tiền</TableHead>
                <TableHead className="text-right font-semibold whitespace-nowrap min-w-[110px]">Đã thu</TableHead>
                <TableHead className="text-right font-semibold whitespace-nowrap min-w-[110px]">Còn nợ</TableHead>
                <TableHead className="w-44 font-semibold text-center whitespace-nowrap min-w-[160px]">Tiến độ thanh toán</TableHead>
                <TableHead className="font-semibold text-center whitespace-nowrap min-w-[120px]">Trạng thái</TableHead>
                <TableHead className="font-semibold whitespace-nowrap min-w-[110px]">Ngày xuất</TableHead>
                <TableHead className="text-right font-semibold whitespace-nowrap min-w-[170px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                      <p className="text-sm">Đang tải danh sách hóa đơn...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">Không tìm thấy hóa đơn nào phù hợp.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openCreateDialog}
                        className="mt-2 text-xs"
                      >
                        Lập hóa đơn mới ngay
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => {
                  const total = Number(inv.total_amount) || 0;
                  const paid = Number(inv.paid_amount) || 0;
                  const remaining = Number(inv.remaining_amount) || 0;
                  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;

                  return (
                    <TableRow
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {/* Invoice Code */}
                      <TableCell className="font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {inv.invoice_code}
                        </Link>
                      </TableCell>

                      {/* Patient */}
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {inv.patient?.full_name || 'Khách vãng lai'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 whitespace-nowrap">
                          {inv.patient?.patient_code && (
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                              {inv.patient.patient_code}
                            </span>
                          )}
                          {inv.patient?.phone && <span>{inv.patient.phone}</span>}
                        </div>
                      </TableCell>

                      {/* Reference Scope */}
                      <TableCell className="whitespace-nowrap">
                        {inv.visit ? (
                          <div className="text-xs">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
                              Khám bệnh #{inv.visit.visit_code || inv.visit.id}
                            </span>
                          </div>
                        ) : inv.patient_package ? (
                          <div className="text-xs">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-medium">
                              Gói #{inv.patient_package.package_code || inv.patient_package.package_name || 'Khám'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Dịch vụ trực tiếp</span>
                        )}
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="text-right font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(total)}
                        {Number(inv.discount_amount) > 0 && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            - {formatCurrency(inv.discount_amount)}
                          </div>
                        )}
                      </TableCell>

                      {/* Paid Amount */}
                      <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(paid)}
                      </TableCell>

                      {/* Remaining Amount */}
                      <TableCell className="text-right font-mono font-medium whitespace-nowrap">
                        {remaining > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {formatCurrency(remaining)}
                          </span>
                        ) : (
                          <span className="text-slate-400">0 ₫</span>
                        )}
                      </TableCell>

                      {/* Progress bar */}
                      <TableCell className="whitespace-nowrap">
                        <div className="space-y-1 w-36">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{percent}%</span>
                            <span>{paid >= total ? 'Đủ 100%' : `Còn nợ`}</span>
                          </div>
                          <Progress
                            value={percent}
                            indicatorClassName={
                              inv.status === 'CANCELLED'
                                ? 'bg-slate-400'
                                : percent >= 100
                                ? 'bg-emerald-600'
                                : percent > 0
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }
                            className="h-2"
                          />
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center whitespace-nowrap">
                        {renderStatusBadge(inv.status)}
                      </TableCell>

                      {/* Issued Date */}
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                        {formatDate(inv.issued_at)}
                      </TableCell>

                      {/* Action buttons */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* Quick pay button */}
                          {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && remaining > 0 && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => openPaymentDialog(inv)}
                              className="h-7 px-2.5 text-xs gap-1"
                              title="Thu tiền đợt mới"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Thu tiền
                            </Button>
                          )}

                          {/* View details */}
                          <Link href={`/invoices/${inv.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              title="Xem chi tiết hóa đơn"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem
                            </Button>
                          </Link>

                          {/* Cancel button if no payments */}
                          {inv.status !== 'CANCELLED' && paid === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCancelDialog(inv)}
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              title="Hủy hóa đơn"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Hiển thị <span className="font-semibold text-slate-900 dark:text-slate-200">{invoices.length}</span> / Tổng số <span className="font-semibold text-slate-900 dark:text-slate-200">{totalCount}</span> hóa đơn
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                Trang trước
              </Button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* DIALOG 1: LẬP HÓA ĐƠN MỚI */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              Lập Hóa đơn Bán hàng / Thu ngân mới
            </DialogTitle>
            <DialogDescription>
              Tạo hóa đơn dịch vụ hoặc khám bệnh cho bệnh nhân. Hóa đơn mới sẽ sẵn sàng cho việc thu tiền một lần hoặc nhiều đợt.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-4 pt-2">
            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* Select Patient */}
            <div className="space-y-1.5">
              <Label htmlFor="patientSelect">
                Bệnh nhân <span className="text-rose-500">*</span>
              </Label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Tìm tên hoặc SĐT bệnh nhân..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      loadPatients(e.target.value);
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadPatients(patientSearch)}
                    disabled={loadingPatients}
                    className="h-8 text-xs"
                  >
                    Tìm
                  </Button>
                </div>
                <select
                  id="patientSelect"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900"
                  required
                >
                  <option value="">-- Chọn bệnh nhân từ danh sách --</option>
                  {patientsList.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.full_name} ({pt.patient_code || `BN#${pt.id}`}) - {pt.phone || 'Không có SĐT'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Money Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="subtotalAmount">
                  Tổng tiền dịch vụ / hàng hóa (VNĐ) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="subtotalAmount"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Ví dụ: 500000"
                  value={subtotalAmount}
                  onChange={(e) => setSubtotalAmount(e.target.value ? Number(e.target.value) : '')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="discountAmount">
                  Giảm giá / Ưu đãi (VNĐ)
                </Label>
                <Input
                  id="discountAmount"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
            </div>

            {/* Calculated Final Total Preview */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Thành tiền cần thanh toán:</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
                {formatCurrency(
                  Math.max(
                    0,
                    (Number(subtotalAmount) || 0) - (Number(discountAmount) || 0)
                  )
                )}
              </span>
            </div>

            {/* Issued Date */}
            <div className="space-y-1.5">
              <Label htmlFor="issuedAt">
                Ngày lập hóa đơn <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="issuedAt"
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={createSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {createSubmitting ? 'Đang lập...' : 'Xác nhận lập hóa đơn'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: THU TIỀN NHANH / THANH TOÁN NHIỀU ĐỢT */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
              Thu tiền Hóa đơn (Thanh toán đợt mới)
            </DialogTitle>
            <DialogDescription>
              Ghi nhận thanh toán cho hóa đơn. Hệ thống sẽ tự động cập nhật công nợ và ghi phiếu thu vào sổ quỹ (`cash_transactions`).
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Invoice snapshot header */}
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã hóa đơn:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                    {selectedInvoice.invoice_code}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Bệnh nhân:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedInvoice.patient?.full_name || 'Khách vãng lai'}
                  </span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-slate-400">Tổng hóa đơn</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(selectedInvoice.total_amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Đã trả</div>
                    <div className="font-semibold text-emerald-600">
                      {formatCurrency(selectedInvoice.paid_amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Còn nợ lại</div>
                    <div className="font-bold text-amber-600">
                      {formatCurrency(selectedInvoice.remaining_amount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount input & Quick buttons */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="paymentAmount">
                    Số tiền thu đợt này (VNĐ) <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickPayment(0.5)}
                      className="h-6 px-2 text-[11px] text-blue-600 hover:bg-blue-50"
                    >
                      50% Còn nợ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickPayment(1.0)}
                      className="h-6 px-2 text-[11px] text-emerald-600 hover:bg-emerald-50 font-semibold"
                    >
                      100% Tất toán
                    </Button>
                  </div>
                </div>
                <Input
                  id="paymentAmount"
                  type="number"
                  min="1"
                  max={selectedInvoice.remaining_amount}
                  step="1000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="font-mono text-base font-semibold"
                  placeholder="Nhập số tiền..."
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label>Phương thức thanh toán <span className="text-rose-500">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CASH', label: 'Tiền mặt', icon: Wallet },
                    { id: 'BANK_TRANSFER', label: 'Chuyển khoản', icon: Receipt },
                    { id: 'CARD', label: 'Thẻ POS', icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all',
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-xs dark:bg-blue-950 dark:text-blue-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reference Code (Transaction ID) */}
              <div className="space-y-1.5">
                <Label htmlFor="referenceCode">Mã tham chiếu / Mã chuẩn chi ngân hàng</Label>
                <Input
                  id="referenceCode"
                  placeholder="Ví dụ: VCB-20261027-0199, POS-8827..."
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                />
              </div>

              {/* Payment Date & Time */}
              <div className="space-y-1.5">
                <Label htmlFor="paymentDate">
                  Thời gian thu tiền <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="paymentDate"
                  type="datetime-local"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="paymentNotes">Ghi chú thu tiền</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Ghi chú thêm về đợt thanh toán (không bắt buộc)..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentOpen(false)}
                  disabled={paymentSubmitting}
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                >
                  {paymentSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận thu tiền
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: HỦY HÓA ĐƠN */}
      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" />
              Xác nhận Hủy Hóa đơn
            </DialogTitle>
            <DialogDescription>
              Chỉ được phép hủy hóa đơn khi chưa thu tiền (`paid_amount == 0`). Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <form onSubmit={handleCancelInvoice} className="space-y-4 pt-2">
              {cancelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div>
                  Mã hóa đơn: <span className="font-mono font-bold">{selectedInvoice.invoice_code}</span>
                </div>
                <div>
                  Bệnh nhân: <span className="font-semibold">{selectedInvoice.patient?.full_name}</span>
                </div>
                <div>
                  Tổng tiền: <span className="font-semibold text-rose-600">{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cancelReason">
                  Lý do hủy hóa đơn <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="cancelReason"
                  required
                  placeholder="Nhập lý do hủy bỏ hóa đơn này..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCancelOpen(false)}
                  disabled={cancelSubmitting}
                >
                  Quay lại
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={cancelSubmitting || !cancelReason.trim()}
                  className="font-medium gap-1.5"
                >
                  {cancelSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang hủy...
                    </>
                  ) : (
                    'Đồng ý hủy hóa đơn'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
