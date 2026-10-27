'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  AlertCircle,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Search,
  RefreshCw,
  FileText,
  User,
  Phone,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Percent,
  Receipt,
  UserCheck,
  CalendarDays,
  Send,
  Building,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import {
  getDebtSummary,
  getDebtorPatients,
  getPatientDebts,
  collectDebtPayment,
} from '@/lib/api/debts';
import {
  DebtSummary,
  DebtorPatient,
  PatientDebtDetail,
} from '@/types/debt';
import { Invoice, PaymentMethod } from '@/types/invoice';

const AGING_COLORS = {
  '0_to_7': '#10b981', // Emerald-500
  '8_to_30': '#f59e0b', // Amber-500
  'over_30': '#ef4444', // Rose-500
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
  { value: 'CARD', label: 'Thẻ ngân hàng / POS' },
];

export default function DebtManagementPage() {
  // Chart hydration flag for SSR
  const [isMounted, setIsMounted] = useState(false);

  // Summary State
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Debtor Patients State
  const [patients, setPatients] = useState<DebtorPatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 15,
  });

  // Filters State
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<
    'total_remaining_debt' | 'total_invoiced' | 'latest_debt_date' | 'full_name'
  >('total_remaining_debt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: '',
  });

  // Patient Debt Ledger Dialog State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientDetail, setPatientDetail] = useState<PatientDebtDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<'invoices' | 'payments'>('invoices');

  // Quick Debt Collection Modal State
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [collectPatientName, setCollectPatientName] = useState<string>('');
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('CASH');
  const [collectReferenceCode, setCollectReferenceCode] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [collectSubmitting, setCollectSubmitting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectSuccessMessage, setCollectSuccessMessage] = useState<string | null>(null);

  // Mark client hydration complete
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch summary data
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await getDebtSummary({
        start_date: dateRange.start_date || undefined,
        end_date: dateRange.end_date || undefined,
      });
      if (res.data) {
        setSummary(res.data);
      }
    } catch (err: unknown) {
      console.error('Lỗi khi tải tổng hợp công nợ:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [dateRange]);

  // Fetch debtor patients list
  const fetchDebtorPatients = useCallback(
    async (pageNumber = 1) => {
      setLoadingPatients(true);
      try {
        const res = await getDebtorPatients({
          page: pageNumber,
          per_page: pagination.per_page,
          search: search.trim() || undefined,
          sort_by: sortBy,
          sort_direction: sortDirection,
        });

        if (res.data) {
          setPatients(res.data);
        }
        if (res.meta) {
          setPagination({
            current_page: res.meta.current_page,
            last_page: res.meta.last_page,
            total: res.meta.total,
            per_page: res.meta.per_page,
          });
        }
      } catch (err: unknown) {
        console.error('Lỗi khi tải danh sách bệnh nhân có công nợ:', err);
      } finally {
        setLoadingPatients(false);
      }
    },
    [search, sortBy, sortDirection, pagination.per_page]
  );

  // Initial load and filter change trigger
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchDebtorPatients(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchDebtorPatients]);

  // Open Patient Debt Ledger
  const handleOpenPatientDetail = async (patientId: number) => {
    setSelectedPatientId(patientId);
    setIsDetailOpen(true);
    setLoadingDetail(true);
    setDetailTab('invoices');
    try {
      const res = await getPatientDebts(patientId);
      if (res.data) {
        setPatientDetail(res.data);
      }
    } catch (err: unknown) {
      console.error('Lỗi khi tải sổ công nợ bệnh nhân:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Quick Debt Collection Modal for specific invoice
  const handleOpenQuickCollect = (invoice: Invoice, patientName?: string) => {
    setCollectInvoice(invoice);
    setCollectPatientName(patientName || patientDetail?.patient.full_name || 'Bệnh nhân');
    setCollectAmount(String(invoice.remaining_amount || 0));
    setCollectMethod('CASH');
    setCollectReferenceCode('');
    setCollectNotes(`Thu hồi công nợ hóa đơn ${invoice.invoice_code}`);
    setCollectError(null);
    setCollectSuccessMessage(null);
    setIsCollectOpen(true);
  };

  // Quick Amount Set Helper
  const handleSetQuickAmount = (percentage: number) => {
    if (!collectInvoice) return;
    const remaining = Number(collectInvoice.remaining_amount) || 0;
    const calculated = Math.round(remaining * (percentage / 100));
    setCollectAmount(String(calculated));
  };

  // Submit Quick Debt Collection
  const handleSubmitCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectInvoice) return;

    const amountNum = parseFloat(collectAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCollectError('Vui lòng nhập số tiền thu nợ hợp lệ lớn hơn 0.');
      return;
    }

    if (amountNum > Number(collectInvoice.remaining_amount)) {
      setCollectError(
        `Số tiền thu (${formatCurrency(amountNum)}) không được vượt quá số tiền còn nợ (${formatCurrency(
          collectInvoice.remaining_amount
        )}).`
      );
      return;
    }

    setCollectSubmitting(true);
    setCollectError(null);

    try {
      const res = await collectDebtPayment(collectInvoice.id, {
        amount: amountNum,
        payment_method: collectMethod,
        reference_code: collectReferenceCode.trim() || null,
        notes: collectNotes.trim() || null,
      });

      if (res.data) {
        setCollectSuccessMessage('Thu nợ thành công! Dữ liệu công nợ đã được cập nhật.');

        // Refresh Summary & Patients list
        fetchSummary();
        fetchDebtorPatients(pagination.current_page);

        // If patient detail dialog is open, refresh detail as well
        if (selectedPatientId) {
          const detailRes = await getPatientDebts(selectedPatientId);
          if (detailRes.data) {
            setPatientDetail(detailRes.data);
          }
        }

        setTimeout(() => {
          setIsCollectOpen(false);
          setCollectSuccessMessage(null);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Có lỗi xảy ra khi thực hiện thu nợ. Vui lòng thử lại.';
      setCollectError(msg);
    } finally {
      setCollectSubmitting(false);
    }
  };

  // Recharts Data for Aging Analysis
  const agingChartData = useMemo(() => {
    if (!summary?.aging) return [];
    return [
      {
        name: '0 - 7 ngày',
        label: '0 - 7 ngày (Mới phát sinh)',
        amount: Number(summary.aging['0_to_7_days']?.amount || 0),
        count: Number(summary.aging['0_to_7_days']?.count || 0),
        color: AGING_COLORS['0_to_7'],
      },
      {
        name: '8 - 30 ngày',
        label: '8 - 30 ngày (Cần theo dõi)',
        amount: Number(summary.aging['8_to_30_days']?.amount || 0),
        count: Number(summary.aging['8_to_30_days']?.count || 0),
        color: AGING_COLORS['8_to_30'],
      },
      {
        name: '> 30 ngày',
        label: '> 30 ngày (Quá hạn rủi ro)',
        amount: Number(summary.aging['over_30_days']?.amount || 0),
        count: Number(summary.aging['over_30_days']?.count || 0),
        color: AGING_COLORS['over_30'],
      },
    ];
  }, [summary]);

  // Ratio comparison data
  const ratioPieData = useMemo(() => {
    if (!summary) return [];
    const collected = Number(summary.total_collected || 0);
    const remaining = Number(summary.total_remaining_debt || 0);
    return [
      { name: 'Đã thu hồi', value: collected, color: '#10b981' },
      { name: 'Còn nợ đọng', value: remaining, color: '#ef4444' },
    ];
  }, [summary]);

  // Overall collection rate percentage
  const collectionRate = useMemo(() => {
    if (!summary || !summary.total_invoiced || summary.total_invoiced <= 0) return 0;
    return Math.min(100, Math.round((summary.total_collected / summary.total_invoiced) * 100));
  }, [summary]);

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <PageHeader
        title="Quản lý công nợ"
        description="Theo dõi nợ phải thu của bệnh nhân, phân tích tuổi nợ quá hạn và thu hồi nợ nhanh"
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Tài chính & Kho dược', href: '/debts' },
          { label: 'Công nợ' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSummary();
                fetchDebtorPatients(pagination.current_page);
              }}
              disabled={loadingSummary || loadingPatients}
              className="gap-2"
            >
              <RefreshCw
                className={cn('h-4 w-4', (loadingSummary || loadingPatients) && 'animate-spin')}
              />
              Làm mới
            </Button>
            <Link href="/invoices">
              <Button size="sm" variant="secondary" className="gap-2">
                <Receipt className="h-4 w-4" />
                Sổ hóa đơn
              </Button>
            </Link>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng phát sinh hóa đơn"
          value={formatCurrency(summary?.total_invoiced ?? 0)}
          icon={Receipt}
          variant="default"
          description="Toàn bộ hóa đơn hợp lệ đã xuất"
        />
        <StatCard
          title="Đã thực thu"
          value={formatCurrency(summary?.total_collected ?? 0)}
          icon={Wallet}
          variant="success"
          trend="up"
          trendValue={`${collectionRate}%`}
          trendLabel="tỷ lệ thu hồi"
          description="Đã nhận tiền từ bệnh nhân"
        />
        <StatCard
          title="Tổng nợ còn phải thu"
          value={formatCurrency(summary?.total_remaining_debt ?? 0)}
          icon={AlertCircle}
          variant="destructive"
          trend="down"
          trendValue={`${100 - collectionRate}%`}
          trendLabel="cần thu hồi"
          description="Công nợ tồn đọng chưa thanh toán"
        />
        <StatCard
          title="Bệnh nhân đang nợ"
          value={`${summary?.debtor_patients_count ?? 0} người`}
          icon={UserCheck}
          variant="warning"
          description={`${summary?.unpaid_invoices_count ?? 0} HĐ chưa trả, ${
            summary?.partial_invoices_count ?? 0
          } HĐ trả một phần`}
        />
      </div>

      {/* Aging Analysis Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Phân tích tuổi nợ (Aging Receivable Analysis)
              </CardTitle>
              <CardDescription>
                Phân loại công nợ theo thời gian phát sinh giúp đánh giá rủi ro và ưu tiên đôn đốc thu nợ
              </CardDescription>
            </div>
            {/* Date filter */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.start_date}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start_date: e.target.value }))
                }
                className="h-8 text-xs w-36"
                placeholder="Từ ngày"
              />
              <span className="text-slate-400 text-xs">đến</span>
              <Input
                type="date"
                value={dateRange.end_date}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end_date: e.target.value }))
                }
                className="h-8 text-xs w-36"
                placeholder="Đến ngày"
              />
              {(dateRange.start_date || dateRange.end_date) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ start_date: '', end_date: '' })}
                  className="h-8 px-2 text-xs text-rose-600"
                >
                  Xóa lọc
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 3 Visual Aging Buckets Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 0-7 days */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 transition-all hover:shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  0 - 7 Ngày (Nợ mới)
                </span>
                <Badge variant="outline" className="border-emerald-300 text-emerald-800 text-xs">
                  {summary?.aging?.['0_to_7_days']?.count ?? 0} hóa đơn
                </Badge>
              </div>
              <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-100">
                {formatCurrency(summary?.aging?.['0_to_7_days']?.amount ?? 0)}
              </div>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Trong hạn quy định, ưu tiên nhắc lịch hẹn hoặc gửi tin nhắn cảm ơn kết hợp đối soát.
              </p>
            </div>

            {/* 8-30 days */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 transition-all hover:shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  8 - 30 Ngày (Cần nhắc nhở)
                </span>
                <Badge variant="outline" className="border-amber-300 text-amber-800 text-xs">
                  {summary?.aging?.['8_to_30_days']?.count ?? 0} hóa đơn
                </Badge>
              </div>
              <div className="text-2xl font-bold text-amber-950 dark:text-amber-100">
                {formatCurrency(summary?.aging?.['8_to_30_days']?.amount ?? 0)}
              </div>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Đã kéo dài hơn 1 tuần, kế toán cần gọi điện đôn đốc hoặc gửi thông báo thanh toán đợt kế tiếp.
              </p>
            </div>

            {/* >30 days */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 transition-all hover:shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                  &gt; 30 Ngày (Quá hạn rủi ro cao)
                </span>
                <Badge variant="destructive" className="text-xs">
                  {summary?.aging?.['over_30_days']?.count ?? 0} hóa đơn
                </Badge>
              </div>
              <div className="text-2xl font-bold text-rose-950 dark:text-rose-100">
                {formatCurrency(summary?.aging?.['over_30_days']?.amount ?? 0)}
              </div>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                Cảnh báo nợ khó đòi! Đề nghị lãnh đạo phòng khám phê duyệt phương án thu nợ đặc biệt.
              </p>
            </div>
          </div>

          {/* Recharts Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            {/* Bar Chart: Aging Buckets */}
            <div className="lg:col-span-2 rounded-xl border p-4 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Biểu đồ phân bổ giá trị công nợ theo tuổi nợ
                </span>
                <span className="text-xs text-slate-500">Đơn vị: VNĐ</span>
              </div>
              {isMounted ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingChartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) =>
                          val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${val / 1000}k`
                        }
                      />
                      <Tooltip
                        formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Số tiền nợ']}
                        labelFormatter={(lbl) => `Kỳ hạn: ${lbl}`}
                      />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {agingChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">
                  Đang chuẩn bị biểu đồ...
                </div>
              )}
            </div>

            {/* Donut Chart: Collected vs Remaining */}
            <div className="rounded-xl border p-4 bg-white dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Tỷ lệ thu hồi toàn viện
                </span>
                <p className="text-xs text-slate-500 mt-0.5">Đối chiếu Đã thu hồi vs Nợ còn lại</p>
              </div>

              {isMounted ? (
                <div className="h-[180px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ratioPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {ratioPieData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">
                  Đang chuẩn bị biểu đồ...
                </div>
              )}

              <div className="space-y-2 pt-2 border-t text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    Đã thu hồi ({collectionRate}%)
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(summary?.total_collected ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                    Còn nợ đọng ({100 - collectionRate}%)
                  </span>
                  <span className="font-semibold text-rose-600">
                    {formatCurrency(summary?.total_remaining_debt ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debtor Patients List Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Danh sách bệnh nhân đang có công nợ
              </CardTitle>
              <CardDescription>
                Theo dõi chi tiết số tiền nợ, tỷ lệ đã thanh toán và lịch sử từng hóa đơn
              </CardDescription>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Tìm theo tên, mã BN, SĐT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as
                        | 'total_remaining_debt'
                        | 'total_invoiced'
                        | 'latest_debt_date'
                        | 'full_name'
                    )
                  }
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="total_remaining_debt">Nợ giảm dần</option>
                  <option value="latest_debt_date">Nợ gần đây nhất</option>
                  <option value="total_invoiced">Tổng viện phí giảm dần</option>
                  <option value="full_name">Tên bệnh nhân A-Z</option>
                </select>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  title={`Sắp xếp: ${sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}`}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="w-[240px]">Bệnh nhân</TableHead>
                  <TableHead className="text-right">Tổng phát sinh</TableHead>
                  <TableHead className="text-right">Đã thanh toán</TableHead>
                  <TableHead className="text-right">Còn nợ</TableHead>
                  <TableHead className="w-[180px]">Tiến độ thu hồi</TableHead>
                  <TableHead className="text-center">Số HĐ nợ</TableHead>
                  <TableHead>Ngày nợ gần nhất</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPatients ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                        Đang tải danh sách công nợ bệnh nhân...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Tuyệt vời! Không có bệnh nhân nào còn công nợ
                        </span>
                        <span className="text-xs text-slate-400">
                          Tất cả các hóa đơn điều trị và khám bệnh đều đã được quyết toán đầy đủ.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((patient) => {
                    const totalInvoiced = Number(patient.total_invoiced || 0);
                    const totalPaid = Number(patient.total_paid || 0);
                    const remainingDebt = Number(patient.total_remaining_debt || 0);
                    const paidPercentage =
                      totalInvoiced > 0 ? Math.min(100, Math.round((totalPaid / totalInvoiced) * 100)) : 0;

                    return (
                      <TableRow key={patient.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        {/* Patient info */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {patient.full_name}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                {patient.patient_code}
                              </Badge>
                              {patient.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="h-3 w-3" />
                                  {patient.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Total invoiced */}
                        <TableCell className="text-right font-medium text-slate-800 dark:text-slate-200">
                          {formatCurrency(totalInvoiced)}
                        </TableCell>

                        {/* Total paid */}
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatCurrency(totalPaid)}
                        </TableCell>

                        {/* Remaining debt */}
                        <TableCell className="text-right font-bold text-rose-600">
                          {formatCurrency(remainingDebt)}
                        </TableCell>

                        {/* Progress Bar */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Đã thu</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {paidPercentage}%
                              </span>
                            </div>
                            <Progress
                              value={paidPercentage}
                              className="h-2"
                              indicatorClassName={cn(
                                paidPercentage >= 75
                                  ? 'bg-emerald-500'
                                  : paidPercentage >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              )}
                            />
                          </div>
                        </TableCell>

                        {/* Debt invoices count */}
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-semibold">
                            {patient.debt_invoices_count} HĐ
                          </Badge>
                        </TableCell>

                        {/* Latest debt date */}
                        <TableCell className="text-xs text-slate-500">
                          {patient.latest_debt_date ? formatDate(patient.latest_debt_date) : '-'}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleOpenPatientDetail(patient.id)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Sổ nợ
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 gap-1 text-xs bg-rose-600 hover:bg-rose-700"
                              onClick={() => handleOpenPatientDetail(patient.id)}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              Thu nợ
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t text-sm text-slate-500">
              <div>
                Hiển thị{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {Math.min(
                    (pagination.current_page - 1) * pagination.per_page + 1,
                    pagination.total
                  )}
                </span>{' '}
                -{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {Math.min(pagination.current_page * pagination.per_page, pagination.total)}
                </span>{' '}
                trong tổng số{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {pagination.total}
                </span>{' '}
                bệnh nhân
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page <= 1 || loadingPatients}
                  onClick={() => fetchDebtorPatients(pagination.current_page - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </Button>
                <span className="text-xs font-semibold px-2">
                  Trang {pagination.current_page} / {pagination.last_page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page || loadingPatients}
                  onClick={() => fetchDebtorPatients(pagination.current_page + 1)}
                  className="gap-1"
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Debt Ledger Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FileText className="h-5 w-5 text-blue-600" />
              Sổ công nợ bệnh nhân
            </DialogTitle>
            <DialogDescription>
              Xem chi tiết toàn bộ hóa đơn phát sinh, các đợt trả tiền và thu nợ trực tiếp
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              Đang tải sổ chi tiết công nợ...
            </div>
          ) : patientDetail ? (
            <div className="space-y-6 pt-2">
              {/* Patient Profile Card */}
              <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-800/40">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-slate-400">Bệnh nhân</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {patientDetail.patient.full_name}
                    </p>
                    <Badge variant="outline" className="font-mono text-xs mt-1">
                      {patientDetail.patient.patient_code}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Số điện thoại</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 mt-1">
                      {patientDetail.patient.phone || 'Chưa cập nhật'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Giới tính / Ngày sinh</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 mt-1">
                      {patientDetail.patient.gender === 'MALE'
                        ? 'Nam'
                        : patientDetail.patient.gender === 'FEMALE'
                        ? 'Nữ'
                        : '-'}{' '}
                      {patientDetail.patient.date_of_birth
                        ? `(${formatDate(patientDetail.patient.date_of_birth)})`
                        : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Địa chỉ</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate mt-1">
                      {patientDetail.patient.address || '-'}
                    </p>
                  </div>
                </div>

                {/* Patient Debt Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-xs text-slate-500">Tổng viện phí:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(patientDetail.summary.total_invoiced)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Đã thanh toán:</span>
                    <p className="font-bold text-emerald-600">
                      {formatCurrency(patientDetail.summary.total_paid)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Còn nợ lại:</span>
                    <p className="font-bold text-rose-600 text-lg">
                      {formatCurrency(patientDetail.summary.total_remaining_debt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Số HĐ đang nợ:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {patientDetail.summary.debt_invoices_count} /{' '}
                      {patientDetail.summary.total_invoices_count} hóa đơn
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs: Invoices vs Payments */}
              <Tabs
                value={detailTab}
                onValueChange={(val) => setDetailTab(val as 'invoices' | 'payments')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invoices" className="gap-2">
                    <Receipt className="h-4 w-4" />
                    Danh sách hóa đơn ({patientDetail.invoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Lịch sử các đợt thanh toán ({patientDetail.payments.length})
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Invoices */}
                <TabsContent value="invoices" className="pt-3">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800">
                          <TableHead>Mã HĐ</TableHead>
                          <TableHead>Ngày lập</TableHead>
                          <TableHead className="text-right">Tổng tiền</TableHead>
                          <TableHead className="text-right">Đã trả</TableHead>
                          <TableHead className="text-right">Còn nợ</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientDetail.invoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-slate-400">
                              Chưa có hóa đơn nào
                            </TableCell>
                          </TableRow>
                        ) : (
                          patientDetail.invoices.map((inv) => {
                            const isDebt = Number(inv.remaining_amount) > 0;
                            return (
                              <TableRow key={inv.id} className="hover:bg-slate-50/50">
                                <TableCell className="font-mono font-medium">
                                  {inv.invoice_code}
                                </TableCell>
                                <TableCell className="text-xs text-slate-500">
                                  {formatDate(inv.issued_at)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(inv.total_amount)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-600">
                                  {formatCurrency(inv.paid_amount)}
                                </TableCell>
                                <TableCell className="text-right font-bold text-rose-600">
                                  {formatCurrency(inv.remaining_amount)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {inv.status === 'PAID' && (
                                    <Badge variant="success">Đã tất toán</Badge>
                                  )}
                                  {inv.status === 'PARTIAL' && (
                                    <Badge variant="warning">Trả 1 phần</Badge>
                                  )}
                                  {inv.status === 'UNPAID' && (
                                    <Badge variant="destructive">Chưa trả</Badge>
                                  )}
                                  {inv.status === 'CANCELLED' && (
                                    <Badge variant="secondary">Đã hủy</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {isDebt && inv.status !== 'CANCELLED' && (
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs bg-rose-600 hover:bg-rose-700 gap-1"
                                        onClick={() =>
                                          handleOpenQuickCollect(
                                            inv,
                                            patientDetail.patient.full_name
                                          )
                                        }
                                      >
                                        <DollarSign className="h-3 w-3" />
                                        Thu nợ
                                      </Button>
                                    )}
                                    <Link href={`/invoices/${inv.id}`}>
                                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                        <ArrowUpRight className="h-3 w-3" />
                                        Chi tiết
                                      </Button>
                                    </Link>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Tab 2: Payments History */}
                <TabsContent value="payments" className="pt-3">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800">
                          <TableHead>Mã phiếu thu</TableHead>
                          <TableHead>Hóa đơn</TableHead>
                          <TableHead>Thời gian</TableHead>
                          <TableHead className="text-right">Số tiền thu</TableHead>
                          <TableHead>Hình thức</TableHead>
                          <TableHead>Người nhận</TableHead>
                          <TableHead>Mã tham chiếu / Ghi chú</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientDetail.payments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-slate-400">
                              Chưa có lịch sử thanh toán nào
                            </TableCell>
                          </TableRow>
                        ) : (
                          patientDetail.payments.map((pm) => (
                            <TableRow key={pm.id} className="hover:bg-slate-50/50">
                              <TableCell className="font-mono font-medium text-xs">
                                {pm.payment_code}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-blue-600">
                                {pm.invoice?.invoice_code || `#${pm.invoice_id}`}
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {formatDateTime(pm.payment_date)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">
                                {formatCurrency(pm.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {pm.payment_method === 'CASH'
                                    ? 'Tiền mặt'
                                    : pm.payment_method === 'BANK_TRANSFER'
                                    ? 'Chuyển khoản'
                                    : 'Thẻ POS'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                                {pm.receiver?.username || '-'}
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">
                                <div>{pm.reference_code || '-'}</div>
                                {pm.notes && (
                                  <div className="text-[11px] text-slate-400 italic">
                                    {pm.notes}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Debt Collection Modal */}
      <Dialog open={isCollectOpen} onOpenChange={setIsCollectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Thu nợ nhanh hóa đơn
            </DialogTitle>
            <DialogDescription>
              Ghi nhận đợt thanh toán mới cho hóa đơn{' '}
              <span className="font-semibold text-blue-600">{collectInvoice?.invoice_code}</span>
            </DialogDescription>
          </DialogHeader>

          {collectSuccessMessage ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-bounce" />
              <p className="font-semibold text-emerald-800 text-base">{collectSuccessMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitCollect} className="space-y-4 pt-1">
              {/* Debt Info Card */}
              <div className="rounded-lg bg-slate-50 border p-3 dark:bg-slate-800/50 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bệnh nhân:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {collectPatientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổng hóa đơn:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatCurrency(collectInvoice?.total_amount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Đã thanh toán trước đó:</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(collectInvoice?.paid_amount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t text-base">
                  <span className="font-semibold text-rose-700 dark:text-rose-400">
                    Số nợ còn lại:
                  </span>
                  <span className="font-bold text-rose-600">
                    {formatCurrency(collectInvoice?.remaining_amount ?? 0)}
                  </span>
                </div>
              </div>

              {/* Amount Input with Quick Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="collect-amount" className="text-sm font-semibold">
                    Số tiền thu đợt này (VNĐ) <span className="text-rose-500">*</span>
                  </Label>
                  {/* Quick percentage buttons */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2 font-medium"
                      onClick={() => handleSetQuickAmount(50)}
                    >
                      50% nợ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2 font-medium border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950"
                      onClick={() => handleSetQuickAmount(100)}
                    >
                      Tất toán 100%
                    </Button>
                  </div>
                </div>
                <Input
                  id="collect-amount"
                  type="number"
                  min="1"
                  max={collectInvoice?.remaining_amount ?? undefined}
                  step="1000"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="Nhập số tiền thu..."
                  className="font-semibold text-base text-blue-600"
                  required
                />
                {collectAmount && !isNaN(Number(collectAmount)) && (
                  <p className="text-xs text-slate-500 italic">
                    Bằng chữ / Quy đổi: {formatCurrency(Number(collectAmount))}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="collect-method" className="text-sm font-semibold">
                  Phương thức thanh toán <span className="text-rose-500">*</span>
                </Label>
                <select
                  id="collect-method"
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value as PaymentMethod)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reference Code (if transfer or card) */}
              {collectMethod !== 'CASH' && (
                <div className="space-y-1.5">
                  <Label htmlFor="collect-reference" className="text-sm font-medium">
                    Mã chuẩn chi / Giao dịch ngân hàng
                  </Label>
                  <Input
                    id="collect-reference"
                    type="text"
                    value={collectReferenceCode}
                    onChange={(e) => setCollectReferenceCode(e.target.value)}
                    placeholder="VD: FT241027889312..."
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="collect-notes" className="text-sm font-medium">
                  Ghi chú thu tiền
                </Label>
                <Textarea
                  id="collect-notes"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú thêm về đợt thanh toán..."
                />
              </div>

              {/* Error Alert */}
              {collectError && (
                <div className="rounded-md bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{collectError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCollectOpen(false)}
                  disabled={collectSubmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={collectSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {collectSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang ghi nhận...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận thu nợ
                    </>
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
