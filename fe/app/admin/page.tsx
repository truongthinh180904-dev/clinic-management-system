'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  Activity,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  FileText,
  Package,
  Stethoscope,
  Layers,
  RefreshCw,
  Wallet,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';
import {
  DonutChart,
  AppointmentDistributionChart,
  TimeSeriesRevenueChart,
  TimeSeriesVisitsChart,
} from '@/components/charts';
import { formatCurrency, formatDate } from '@/lib/utils';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';

import {
  getDashboardSummary,
  getRevenueChart,
  getVisitTrends,
  getTopPerformers,
} from '@/lib/api/dashboard';
import {
  DashboardSummary,
  RevenueChartPoint,
  VisitTrendsData,
  TopPerformersData,
} from '@/types/dashboard';

type DatePreset = '7d' | '30d' | 'month' | 'quarter' | 'year' | 'custom';

function formatDateForApi(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortAmount(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${(val / 1_000).toFixed(0)}k`;
  }
  return String(val);
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badgeVariant: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' }
> = {
  WAITING: { label: 'Chờ khám', color: '#f59e0b', badgeVariant: 'warning' },
  SCHEDULED: { label: 'Đặt lịch', color: '#8b5cf6', badgeVariant: 'secondary' },
  IN_PROGRESS: { label: 'Đang khám', color: '#3b82f6', badgeVariant: 'info' },
  COMPLETED: { label: 'Hoàn thành', color: '#10b981', badgeVariant: 'success' },
  CANCELLED: { label: 'Đã hủy', color: '#f43f5e', badgeVariant: 'destructive' },
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Date filters
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatDateForApi(d);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return formatDateForApi(new Date());
  });

  // Data states
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueChartPoint[]>([]);
  const [visitTrends, setVisitTrends] = useState<VisitTrendsData | null>(null);
  const [performers, setPerformers] = useState<TopPerformersData | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleApplyPreset = (newPreset: DatePreset) => {
    setPreset(newPreset);
    const now = new Date();
    let start = new Date();

    if (newPreset === '7d') {
      start.setDate(now.getDate() - 6);
      setStartDate(formatDateForApi(start));
      setEndDate(formatDateForApi(now));
    } else if (newPreset === '30d') {
      start.setDate(now.getDate() - 29);
      setStartDate(formatDateForApi(start));
      setEndDate(formatDateForApi(now));
    } else if (newPreset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateForApi(start));
      setEndDate(formatDateForApi(now));
    } else if (newPreset === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      setStartDate(formatDateForApi(start));
      setEndDate(formatDateForApi(now));
    } else if (newPreset === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      setStartDate(formatDateForApi(start));
      setEndDate(formatDateForApi(now));
    }
  };

  const fetchDashboardData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const queryParams = {
          start_date: startDate,
          end_date: endDate,
        };

        const [sumRes, revRes, visRes, perfRes] = await Promise.allSettled([
          getDashboardSummary(queryParams),
          getRevenueChart({ ...queryParams, days: 30 }),
          getVisitTrends({ ...queryParams, days: 14 }),
          getTopPerformers({ ...queryParams, limit: 5 }),
        ]);

        if (sumRes.status === 'fulfilled' && sumRes.value.success && sumRes.value.data) {
          setSummary(sumRes.value.data);
        }
        if (revRes.status === 'fulfilled' && revRes.value.success && revRes.value.data) {
          setRevenueData(revRes.value.data);
        }
        if (visRes.status === 'fulfilled' && visRes.value.success && visRes.value.data) {
          setVisitTrends(visRes.value.data);
        }
        if (perfRes.status === 'fulfilled' && perfRes.value.success && perfRes.value.data) {
          setPerformers(perfRes.value.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Pie chart data for visit status distribution
  const visitStatusPieData = useMemo(() => {
    if (!visitTrends?.by_status) return [];
    const statusMap = visitTrends.by_status;
    const rawItems = [
      { key: 'COMPLETED', count: statusMap.COMPLETED || 0 },
      { key: 'IN_PROGRESS', count: statusMap.IN_PROGRESS || 0 },
      { key: 'WAITING', count: statusMap.WAITING || 0 },
      { key: 'CANCELLED', count: statusMap.CANCELLED || 0 },
    ];

    const total = rawItems.reduce((acc, curr) => acc + curr.count, 0);

    return rawItems
      .filter((item) => item.count > 0 || total === 0)
      .map((item) => {
        const conf = STATUS_CONFIG[item.key] || {
          label: item.key,
          color: '#94a3b8',
          badgeVariant: 'secondary' as const,
        };
        const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return {
          name: conf.label,
          value: item.count,
          color: conf.color,
          key: item.key,
          percentage,
        };
      });
  }, [visitTrends]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Bảng Điều Hành Trung Tâm
            </span>
            <Badge variant="outline" className="border-blue-300/40 text-blue-100 text-xs">
              {user?.roles?.[0]?.name || 'Quản trị viên'}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
            Xin chào, {user?.employee?.full_name || user?.username || 'Bác sĩ'}!
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            Theo dõi tổng quan tài chính, dòng tiền, lượt khám và hiệu suất vận hành toàn hệ thống.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/10 p-2 backdrop-blur-md">
          <div className="flex flex-wrap items-center rounded-lg bg-black/20 p-1">
            <button
              type="button"
              onClick={() => handleApplyPreset('7d')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                preset === '7d'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              7 ngày
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('30d')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                preset === '30d'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              30 ngày
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('month')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                preset === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('quarter')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                preset === 'quarter'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              Quý này
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('year')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                preset === 'year'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              Năm nay
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset('custom');
              }}
              className="h-8 rounded-md border border-white/20 bg-white/20 px-2 text-xs text-white placeholder-blue-200 outline-none focus:border-white focus:bg-white/30"
            />
            <span className="text-blue-200">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset('custom');
              }}
              className="h-8 rounded-md border border-white/20 bg-white/20 px-2 text-xs text-white placeholder-blue-200 outline-none focus:border-white focus:bg-white/30"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing || loading}
            className="border-white/30 bg-white/20 text-white hover:bg-white/30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Row 1: Executive KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Doanh thu & Thực thu */}
        <StatCard
          title="Doanh thu phát sinh"
          value={formatCurrency(summary?.total_revenue ?? 0)}
          icon={DollarSign}
          variant="primary"
          trend="up"
          trendValue={`Thực thu: ${formatCurrency(summary?.collected_amount ?? 0)}`}
          trendLabel={
            summary?.total_revenue
              ? `(${Math.min(
                  100,
                  Math.round(((summary.collected_amount || 0) / summary.total_revenue) * 100)
                )}% đã thu)`
              : undefined
          }
          badge={<Badge variant="default">Kỳ này</Badge>}
        />

        {/* Card 2: Công nợ phải thu */}
        <StatCard
          title="Công nợ phải thu"
          value={formatCurrency(summary?.debt_amount ?? 0)}
          icon={CreditCard}
          variant="warning"
          trend="neutral"
          trendValue="Còn nợ chưa thu"
          description="Hóa đơn chưa hoặc chỉ trả 1 phần"
          badge={
            (summary?.debt_amount ?? 0) > 0 ? (
              <Badge variant="warning">Cần thu</Badge>
            ) : (
              <Badge variant="success">Tốt</Badge>
            )
          }
        />

        {/* Card 3: Chi phí & Quỹ ròng */}
        <StatCard
          title="Dòng tiền ròng (Net Cashflow)"
          value={formatCurrency(summary?.net_cashflow ?? 0)}
          icon={TrendingUp}
          variant={(summary?.net_cashflow ?? 0) >= 0 ? 'success' : 'destructive'}
          trend={(summary?.net_cashflow ?? 0) >= 0 ? 'up' : 'down'}
          trendValue={`Chi phí: ${formatCurrency(summary?.expense_amount ?? 0)}`}
          trendLabel="đã duyệt"
          badge={
            (summary?.net_cashflow ?? 0) >= 0 ? (
              <Badge variant="success">Dương</Badge>
            ) : (
              <Badge variant="destructive">Âm quỹ</Badge>
            )
          }
        />

        {/* Card 4: Lượt khám & Lịch hẹn */}
        <StatCard
          title="Lượt khám hôm nay"
          value={`${summary?.visits_today ?? 0} lượt`}
          icon={Activity}
          variant="default"
          trend="up"
          trendValue={`${summary?.appointments_today ?? 0} lịch hẹn`}
          trendLabel={`• ${summary?.new_patients ?? 0} BN mới`}
          badge={<Badge variant="info">Hôm nay</Badge>}
        />
      </div>

      {/* Row 2: Interactive Recharts Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Chart (8 cols): Revenue/Cashflow & Daily Visit trends */}
        <Card className="lg:col-span-8 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Xu Hướng Tài Chính & Khám Chữa Bệnh
                </CardTitle>
                <CardDescription className="text-xs">
                  Biểu đồ trực quan hóa dữ liệu theo ngày trong khoảng thời gian đã chọn
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Tabs defaultValue="finance" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="finance">Doanh thu & Sổ quỹ</TabsTrigger>
                <TabsTrigger value="visits">Lượt khám theo ngày</TabsTrigger>
              </TabsList>

              {/* Tab 1: Financial Chart */}
              <TabsContent value="finance" className="mt-0">
                <TimeSeriesRevenueChart
                  data={revenueData}
                  title=""
                  description=""
                  height={320}
                  chartType="area"
                  defaultMetric="all"
                  showControls={true}
                  showSummaryBar={false}
                />
              </TabsContent>

              {/* Tab 2: Visits Chart */}
              <TabsContent value="visits" className="mt-0">
                <TimeSeriesVisitsChart
                  data={visitTrends?.daily || []}
                  title=""
                  description=""
                  height={320}
                  chartType="area"
                  defaultMetric="all"
                  showControls={true}
                  showSummaryBar={false}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Side Chart (4 cols): Visit Status Distribution Donut */}
        <Card className="lg:col-span-4 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Phân Bổ Lượt Khám
            </CardTitle>
            <CardDescription className="text-xs">
              Trạng thái toàn bộ {visitTrends?.total_visits ?? 0} lượt khám trong kỳ
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <DonutChart
              data={visitStatusPieData}
              title=""
              description=""
              centerLabel={String(visitTrends?.total_visits ?? 0)}
              centerSublabel="Lượt khám"
              valueFormatter={(val) => `${val} lượt`}
              height={200}
              legendPosition="bottom"
              emptyMessage={loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Performers Table & Quick Operational Shortcuts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Top Performers Table (8 cols) */}
        <Card className="lg:col-span-8 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Hiệu Suất Dịch Vụ & Bác Sĩ
            </CardTitle>
            <CardDescription className="text-xs">
              Thống kê danh sách bác sĩ, dịch vụ và gói khám dẫn đầu về số lượt & doanh thu
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Tabs defaultValue="doctors" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="doctors">Bác sĩ tiêu biểu</TabsTrigger>
                <TabsTrigger value="services">Top Dịch vụ</TabsTrigger>
                <TabsTrigger value="packages">Top Gói khám</TabsTrigger>
              </TabsList>

              {/* Tab 1: Doctors */}
              <TabsContent value="doctors" className="mt-0">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Bác sĩ</TableHead>
                        <TableHead>Khoa / Vị trí</TableHead>
                        <TableHead className="text-center">Lượt khám</TableHead>
                        <TableHead className="text-center">Hoàn thành</TableHead>
                        <TableHead className="text-right">Doanh thu mang lại</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performers?.top_doctors && performers.top_doctors.length > 0 ? (
                        performers.top_doctors.map((doc) => (
                          <TableRow key={doc.id} className="hover:bg-slate-50/70">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs dark:bg-blue-950 dark:text-blue-300">
                                  {doc.full_name?.charAt(0) || 'BS'}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {doc.full_name}
                                  </p>
                                  <p className="text-xs text-slate-400">{doc.employee_code}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {doc.department || 'Đa khoa'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {doc.total_visits}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-emerald-600">
                              {doc.completed_visits}
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(doc.total_revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-slate-400">
                            {loading ? 'Đang tải danh sách...' : 'Chưa có dữ liệu hiệu suất bác sĩ.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Tab 2: Top Services */}
              <TabsContent value="services" className="mt-0">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">Dịch vụ</TableHead>
                        <TableHead className="text-right">Đơn giá</TableHead>
                        <TableHead className="text-center">Lượt chỉ định</TableHead>
                        <TableHead className="text-right">Tổng doanh thu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performers?.top_services && performers.top_services.length > 0 ? (
                        performers.top_services.map((srv) => (
                          <TableRow key={srv.id} className="hover:bg-slate-50/70">
                            <TableCell className="font-medium">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {srv.name}
                                </p>
                                <p className="text-xs text-slate-400">{srv.service_code}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-slate-600 dark:text-slate-400">
                              {formatCurrency(srv.price)}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-blue-600">
                              {srv.visit_count}
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(srv.total_revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-slate-400">
                            {loading ? 'Đang tải danh sách...' : 'Chưa có số liệu dịch vụ.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Tab 3: Top Packages */}
              <TabsContent value="packages" className="mt-0">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">Gói dịch vụ khám</TableHead>
                        <TableHead className="text-right">Giá niêm yết</TableHead>
                        <TableHead className="text-center">Số lượng bán</TableHead>
                        <TableHead className="text-right">Tổng doanh thu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performers?.top_packages && performers.top_packages.length > 0 ? (
                        performers.top_packages.map((pkg) => (
                          <TableRow key={pkg.id} className="hover:bg-slate-50/70">
                            <TableCell className="font-medium">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {pkg.name}
                                </p>
                                <p className="text-xs text-slate-400">{pkg.package_code}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-slate-600 dark:text-slate-400">
                              {formatCurrency(pkg.price)}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-indigo-600">
                              {pkg.sold_count}
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(pkg.total_revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-slate-400">
                            {loading ? 'Đang tải danh sách...' : 'Chưa có số liệu gói khám.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Operational Shortcuts & System Alerts (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Lối Tắt Nghiệp Vụ Nhanh
              </CardTitle>
              <CardDescription className="text-xs">
                Truy cập các phân hệ tác vụ hàng ngày chỉ với 1 chạm
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2.5">
              <Link
                href="/patients"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center transition-all hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Tiếp nhận Bệnh nhân
                </span>
              </Link>

              <Link
                href="/invoices"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Hóa đơn & Thu tiền
                </span>
              </Link>

              <Link
                href="/inventory"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center transition-all hover:border-amber-300 hover:bg-amber-50/60 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <Package className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Kho Thuốc & Vật tư
                </span>
              </Link>

              <Link
                href="/finance/cashbook"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center transition-all hover:border-purple-300 hover:bg-purple-50/60 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-purple-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Sổ quỹ & Thu chi
                </span>
              </Link>
            </CardContent>
          </Card>

          {/* Operational Alerts Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Cảnh Báo Vận Hành</span>
                <ShieldAlert className="h-4 w-4 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Alert 1: Low stock */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    (summary?.low_stock_count ?? 0) > 0
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                  }`}
                >
                  {(summary?.low_stock_count ?? 0) > 0 ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Cảnh báo Tồn kho
                    </p>
                    {(summary?.low_stock_count ?? 0) > 0 && (
                      <Badge variant="warning">
                        {summary?.low_stock_count} mục
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    {(summary?.low_stock_count ?? 0) > 0
                      ? `Có ${summary?.low_stock_count} sản phẩm chạm hoặc dưới mức tối thiểu.`
                      : 'Toàn bộ danh mục thuốc & vật tư đang đủ tồn kho an toàn.'}
                  </p>
                  {(summary?.low_stock_count ?? 0) > 0 && (
                    <Link
                      href="/inventory"
                      className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Kiểm tra kho ngay <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Alert 2: Approvals pending */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    (summary?.pending_approvals_count ?? 0) > 0
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Yêu cầu Phê duyệt
                    </p>
                    {(summary?.pending_approvals_count ?? 0) > 0 && (
                      <Badge variant="info">
                        {summary?.pending_approvals_count} chờ
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    {(summary?.pending_approvals_count ?? 0) > 0
                      ? `Có ${summary?.pending_approvals_count} phiếu chi / đề xuất đang đợi bạn xét duyệt.`
                      : 'Không có yêu cầu phê duyệt nào đang tồn đọng.'}
                  </p>
                  {(summary?.pending_approvals_count ?? 0) > 0 && (
                    <Link
                      href="/approvals"
                      className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Mở danh sách duyệt <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
