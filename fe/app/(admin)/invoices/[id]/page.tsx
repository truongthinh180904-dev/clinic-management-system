'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Receipt,
  ArrowLeft,
  Printer,
  Wallet,
  CreditCard,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building,
  User,
  Calendar,
  Phone,
  MapPin,
  RefreshCw,
  Hash,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils';
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
  Payment,
  PaymentMethod,
  CreatePaymentInput,
} from '@/types/invoice';
import {
  getInvoice,
  createInvoicePayment,
  cancelInvoice,
} from '@/lib/api/invoices';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = useMemo(() => {
    if (!params?.id) return '';
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params]);

  // States
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment dialog
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Cancel dialog
  const [isCancelOpen, setIsCancelOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Fetch single invoice
  const fetchInvoiceDetail = useCallback(async () => {
    if (!invoiceId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getInvoice(invoiceId);
      if (res && res.data) {
        setInvoice(res.data);
      } else {
        setError('Không tìm thấy thông tin hóa đơn.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải thông tin hóa đơn.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoiceDetail();
  }, [fetchInvoiceDetail]);

  // Open payment dialog
  const openPaymentModal = () => {
    if (!invoice) return;
    setPaymentAmount(invoice.remaining_amount > 0 ? invoice.remaining_amount : '');
    setPaymentMethod('CASH');
    setReferenceCode('');
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setPaymentNotes('');
    setPaymentError(null);
    setIsPaymentOpen(true);
  };

  // Quick payment percentages
  const setQuickPayment = (ratio: number) => {
    if (!invoice) return;
    const remaining = Number(invoice.remaining_amount) || 0;
    if (ratio === 1) {
      setPaymentAmount(remaining);
    } else {
      setPaymentAmount(Math.round(remaining * ratio));
    }
  };

  // Submit payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }

    const remaining = Number(invoice.remaining_amount) || 0;
    if (amount > remaining) {
      setPaymentError(
        `Số tiền thanh toán (${formatCurrency(amount)}) không được vượt quá số nợ còn lại (${formatCurrency(remaining)}).`
      );
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

      await createInvoicePayment(invoice.id, payload);
      setIsPaymentOpen(false);
      setSuccessMsg(`Đã thu thành công ${formatCurrency(amount)} cho hóa đơn.`);
      fetchInvoiceDetail();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi ghi nhận thanh toán.';
      setPaymentError(msg);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Submit cancel invoice
  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    try {
      setCancelSubmitting(true);
      setCancelError(null);

      await cancelInvoice(invoice.id, {
        reason: cancelReason.trim() || undefined,
      });

      setIsCancelOpen(false);
      setSuccessMsg('Hủy hóa đơn thành công.');
      fetchInvoiceDetail();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể hủy hóa đơn.';
      setCancelError(msg);
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Helper badge
  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="success" className="gap-1.5 px-3 py-1 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            ĐÃ TẤT TOÁN
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge variant="warning" className="gap-1.5 px-3 py-1 text-sm font-semibold">
            <Clock className="h-4 w-4" />
            THANH TOÁN MỘT PHẦN
          </Badge>
        );
      case 'UNPAID':
        return (
          <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-sm font-semibold">
            <AlertCircle className="h-4 w-4" />
            CHƯA THANH TOÁN
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Ban className="h-4 w-4" />
            ĐÃ HỦY HÓA ĐƠN
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Print helper
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Đang tải thông tin chi tiết hóa đơn...
        </p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/invoices')}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Button>
        <Card className="border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-rose-600 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-rose-800 dark:text-rose-200">
            {error || 'Không tìm thấy hóa đơn'}
          </h2>
          <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">
            Vui lòng kiểm tra lại đường dẫn hoặc mã hóa đơn.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={fetchInvoiceDetail}
          >
            Thử tải lại
          </Button>
        </Card>
      </div>
    );
  }

  const total = Number(invoice.total_amount) || 0;
  const paid = Number(invoice.paid_amount) || 0;
  const remaining = Number(invoice.remaining_amount) || 0;
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
  const paymentsList = invoice.payments || [];

  return (
    <div className="space-y-6">
      {/* Top Header - hidden in print */}
      <div className="print:hidden">
        <PageHeader
          title={`Hóa đơn ${invoice.invoice_code}`}
          description={`Chi tiết công nợ và lịch sử thanh toán của bệnh nhân ${invoice.patient?.full_name || 'Khách vãng lai'}`}
          breadcrumbs={[
            { label: 'Tổng quan', href: '/admin' },
            { label: 'Hóa đơn & Thu ngân', href: '/invoices' },
            { label: invoice.invoice_code },
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/invoices')}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Danh sách
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchInvoiceDetail}
                className="gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Làm mới
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                In hóa đơn
              </Button>

              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && remaining > 0 && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={openPaymentModal}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Wallet className="h-4 w-4" />
                  Thu tiền đợt mới
                </Button>
              )}

              {invoice.status !== 'CANCELLED' && paid === 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setCancelReason('');
                    setCancelError(null);
                    setIsCancelOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <Ban className="h-4 w-4" />
                  Hủy hóa đơn
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="print:hidden rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
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

      {/* 4 Summary StatCards - hidden in print */}
      <div className="print:hidden grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng tiền thanh toán"
          value={formatCurrency(total)}
          icon={Receipt}
          variant="primary"
          description="Đã tính trừ giảm giá"
        />
        <StatCard
          title="Đã thực thu"
          value={formatCurrency(paid)}
          icon={CheckCircle2}
          variant="success"
          description={`Tiến độ thu: ${percent}%`}
        />
        <StatCard
          title="Số tiền còn nợ"
          value={formatCurrency(remaining)}
          icon={CreditCard}
          variant={remaining > 0 ? 'warning' : 'default'}
          description={remaining > 0 ? 'Cần thu thêm các đợt tiếp theo' : 'Đã thu trọn vẹn'}
        />
        <StatCard
          title="Số đợt thanh toán"
          value={paymentsList.length}
          icon={Clock}
          variant="default"
          description="Lịch sử phiếu thu đã lưu"
        />
      </div>

      {/* INVOICE / RECEIPT OFFICIAL DOCUMENT CONTAINER */}
      <Card className="shadow-md border-slate-200 dark:border-slate-800 print:shadow-none print:border-none">
        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Header of Receipt */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              {/* Clinic Branding */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-600 text-white print:border print:border-blue-600">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-slate-50">
                      HỆ THỐNG PHÒNG KHÁM ĐA KHOA QLPK
                    </h2>
                    <p className="text-xs text-slate-500">
                      Chuẩn Y tế Quốc tế • Chăm sóc Tận tâm
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                  <div>Địa chỉ: 123 Đường Nguyễn Tri Phương, Quận 5, TP. Hồ Chí Minh</div>
                  <div>Hotline: 1900 6868 • Email: contact@qlpk.vn • Website: qlpk.vn</div>
                </div>
              </div>

              {/* Invoice Meta and Badge */}
              <div className="md:text-right space-y-2">
                <div className="inline-block">
                  {renderStatusBadge(invoice.status)}
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                    {invoice.invoice_code}
                  </div>
                  <div>
                    Ngày xuất: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(invoice.issued_at)}</span>
                  </div>
                  <div>
                    Thu ngân / Lập bởi: <span className="font-medium text-slate-700 dark:text-slate-300">{invoice.creator?.employee?.full_name || invoice.creator?.username || 'Thu ngân'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Receipt Title Center */}
            <div className="mt-6 text-center">
              <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wide text-slate-900 dark:text-slate-50">
                PHIẾU THU TIỀN VÀ HÓA ĐƠN DỊCH VỤ
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                (Lưu hành nội bộ và cung cấp cho khách hàng đối soát thanh toán)
              </p>
            </div>
          </div>

          {/* Patient Details & Context Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <User className="h-4 w-4 text-blue-600" />
                Thông tin Khách hàng / Bệnh nhân
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1">
                <span className="text-slate-500">Họ và tên:</span>
                <span className="col-span-2 font-bold text-slate-900 dark:text-slate-100 uppercase">
                  {invoice.patient?.full_name || 'Khách vãng lai'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Mã bệnh nhân:</span>
                <span className="col-span-2 font-mono font-medium text-blue-600 dark:text-blue-400">
                  {invoice.patient?.patient_code || 'Chưa cấp'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200">
                  {invoice.patient?.phone || 'Chưa cung cấp'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Ngày sinh / Giới:</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200">
                  {invoice.patient?.date_of_birth ? formatDate(invoice.patient.date_of_birth) : '---'} • {invoice.patient?.gender === 'MALE' ? 'Nam' : invoice.patient?.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Địa chỉ:</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200">
                  {invoice.patient?.address || '---'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 md:border-l md:border-slate-200 md:dark:border-slate-800 md:pl-4">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-purple-600" />
                Hồ sơ Nghiệp vụ liên quan
              </div>
              {invoice.visit ? (
                <>
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <span className="text-slate-500">Lượt khám bệnh:</span>
                    <span className="col-span-2 font-mono font-medium text-slate-900 dark:text-slate-100">
                      Mã #{invoice.visit.visit_code || invoice.visit.id}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Trạng thái khám:</span>
                    <span className="col-span-2 font-medium">
                      {invoice.visit.status || 'Hoàn thành'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Giờ vào khám:</span>
                    <span className="col-span-2 text-slate-700 dark:text-slate-300">
                      {invoice.visit.check_in_time ? formatDateTime(invoice.visit.check_in_time) : '---'}
                    </span>
                  </div>
                </>
              ) : invoice.patient_package ? (
                <>
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <span className="text-slate-500">Gói khám dịch vụ:</span>
                    <span className="col-span-2 font-medium text-purple-600 dark:text-purple-400">
                      {invoice.patient_package.package?.name || invoice.patient_package.package_name || 'Gói dịch vụ'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Mã gói:</span>
                    <span className="col-span-2 font-mono">
                      {invoice.patient_package.package?.package_code || invoice.patient_package.package_code}
                    </span>
                  </div>
                </>
              ) : (
                <div className="pt-2 text-slate-500 italic">
                  Hóa đơn lập trực tiếp theo dịch vụ lẻ tại quầy thu ngân.
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-blue-600" />
              Chi tiết các khoản mục thanh toán
            </h3>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="font-semibold">Nội dung chi phí</TableHead>
                    <TableHead className="text-right font-semibold">Thành tiền (VNĐ)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                      Tổng tiền dịch vụ / khám chữa bệnh / thuốc phát sinh
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(invoice.subtotal_amount)}
                    </TableCell>
                  </TableRow>
                  {Number(invoice.discount_amount) > 0 && (
                    <TableRow>
                      <TableCell className="text-emerald-700 dark:text-emerald-400">
                        Chiết khấu / Giảm giá ưu đãi theo chính sách
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                        - {formatCurrency(invoice.discount_amount)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/30 font-bold border-t border-slate-300 dark:border-slate-700">
                    <TableCell className="text-slate-900 dark:text-slate-100 text-sm">
                      TỔNG TIỀN PHẢI THANH TOÁN
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-blue-600 dark:text-blue-400">
                      {formatCurrency(total)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-slate-700 dark:text-slate-300">
                      Đã thanh toán (Các đợt thu thực tế)
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatCurrency(paid)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-amber-50/30 dark:bg-amber-950/20 font-bold">
                    <TableCell className="text-amber-800 dark:text-amber-300">
                      CÒN LẠI CẦN THU (CÔNG NỢ)
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-amber-600 dark:text-amber-400">
                      {formatCurrency(remaining)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Payment Progress visual bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Tiến độ thu tiền hóa đơn:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {percent}% ({paid >= total ? 'Đã thu đầy đủ 100%' : `Còn thiếu ${formatCurrency(remaining)}`})
                </span>
              </div>
              <Progress
                value={percent}
                indicatorClassName={
                  invoice.status === 'CANCELLED'
                    ? 'bg-slate-400'
                    : percent >= 100
                    ? 'bg-emerald-600'
                    : percent > 0
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }
                className="h-2.5"
              />
            </div>
          </div>

          {/* Payment History Section (Multi-payments) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
                Lịch sử các đợt thanh toán ({paymentsList.length} đợt)
              </h3>
              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && remaining > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openPaymentModal}
                  className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 print:hidden"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  + Thu tiền đợt mới
                </Button>
              )}
            </div>

            {paymentsList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-slate-500 text-xs">
                <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                Chưa có đợt thu tiền nào cho hóa đơn này.
                {invoice.status !== 'CANCELLED' && (
                  <div className="mt-3 print:hidden">
                    <Button
                      size="sm"
                      onClick={openPaymentModal}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Thu tiền đợt đầu tiên ngay
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50 text-xs">
                      <TableHead className="w-12 text-center font-semibold">Đợt</TableHead>
                      <TableHead className="font-semibold">Mã phiếu thu</TableHead>
                      <TableHead className="font-semibold">Thời gian thu</TableHead>
                      <TableHead className="font-semibold">Phương thức</TableHead>
                      <TableHead className="font-semibold">Mã tham chiếu</TableHead>
                      <TableHead className="font-semibold">Người thu</TableHead>
                      <TableHead className="font-semibold">Bút toán quỹ</TableHead>
                      <TableHead className="text-right font-semibold">Số tiền thu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsList.map((pm, index) => {
                      const methodLabel =
                        pm.payment_method === 'CASH'
                          ? 'Tiền mặt'
                          : pm.payment_method === 'BANK_TRANSFER'
                          ? 'Chuyển khoản'
                          : pm.payment_method === 'CARD'
                          ? 'Thẻ POS'
                          : pm.payment_method;

                      const txCode =
                        pm.cash_transactions && pm.cash_transactions.length > 0
                          ? pm.cash_transactions[0].transaction_code
                          : null;

                      return (
                        <TableRow key={pm.id} className="text-xs">
                          <TableCell className="text-center font-bold text-slate-500">
                            #{index + 1}
                          </TableCell>
                          <TableCell className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                            {pm.payment_code}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-300">
                            {formatDateTime(pm.payment_date)}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                              {pm.payment_method === 'CASH' && <Wallet className="h-3 w-3 text-amber-600" />}
                              {pm.payment_method === 'BANK_TRANSFER' && <Receipt className="h-3 w-3 text-blue-600" />}
                              {pm.payment_method === 'CARD' && <CreditCard className="h-3 w-3 text-purple-600" />}
                              {methodLabel}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-slate-600 dark:text-slate-400">
                            {pm.reference_code || '-'}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-300">
                            {pm.receiver?.employee?.full_name || pm.receiver?.username || 'Thu ngân'}
                          </TableCell>
                          <TableCell>
                            {txCode ? (
                              <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600">
                                {txCode}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(pm.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Signature / Stamp Block for Receipt */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 text-center text-xs">
            <div className="space-y-12">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                KHÁCH HÀNG / BỆNH NHÂN
                <div className="text-[11px] font-normal text-slate-400">(Ký và ghi rõ họ tên)</div>
              </div>
              <div className="text-slate-400 italic">
                {invoice.patient?.full_name || ''}
              </div>
            </div>

            <div className="space-y-12">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                NGƯỜI THU TIỀN / THỦ QUỸ
                <div className="text-[11px] font-normal text-slate-400">(Ký, đóng dấu và ghi rõ họ tên)</div>
              </div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {invoice.creator?.employee?.full_name || invoice.creator?.username || 'Thu ngân phòng khám'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG THU TIỀN ĐỢT MỚI */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
              Thu tiền Hóa đơn (Đợt mới)
            </DialogTitle>
            <DialogDescription>
              Ghi nhận thanh toán đợt tiếp theo cho hóa đơn {invoice.invoice_code}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Snapshot */}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-slate-400">Tổng hóa đơn</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(total)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Đã thu</div>
                <div className="font-semibold text-emerald-600">
                  {formatCurrency(paid)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Còn nợ lại</div>
                <div className="font-bold text-amber-600">
                  {formatCurrency(remaining)}
                </div>
              </div>
            </div>

            {/* Payment Amount & Quick buttons */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="detailPaymentAmount">
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
                id="detailPaymentAmount"
                type="number"
                min="1"
                max={remaining}
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

            {/* Reference Code */}
            <div className="space-y-1.5">
              <Label htmlFor="detailReferenceCode">Mã tham chiếu / Mã chuẩn chi ngân hàng</Label>
              <Input
                id="detailReferenceCode"
                placeholder="Ví dụ: VCB-20261027-0199, POS-8827..."
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label htmlFor="detailPaymentDate">Thời gian thu tiền</Label>
              <Input
                id="detailPaymentDate"
                type="datetime-local"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="detailPaymentNotes">Ghi chú thu tiền</Label>
              <Textarea
                id="detailPaymentNotes"
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
                <CheckCircle2 className="h-4 w-4" />
                {paymentSubmitting ? 'Đang xử lý...' : 'Xác nhận thu tiền'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG HỦY HÓA ĐƠN */}
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

          <form onSubmit={handleCancelInvoice} className="space-y-4 pt-2">
            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="detailCancelReason">Lý do hủy hóa đơn</Label>
              <Textarea
                id="detailCancelReason"
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
                disabled={cancelSubmitting}
                className="font-medium"
              >
                {cancelSubmitting ? 'Đang hủy...' : 'Đồng ý hủy hóa đơn'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
