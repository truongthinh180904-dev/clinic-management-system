'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  CreditCard,
  Wallet,
  Calendar,
  Activity,
  Stethoscope,
  Sparkles,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Clock,
  PackagePlus,
  PackageMinus,
  PieChart as PieChartIcon,
  ShieldAlert,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

import { useAuth } from '@/lib/auth/auth-context';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
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
import { Progress } from '@/components/ui/progress';

import {
  FinancialReportData,
  ClinicalReportData,
  InventoryReportData,
  InventoryItemReport,
} from '@/types/report';
import {
  getFinancialReport,
  getClinicalReport,
  getInventoryReport,
} from '@/lib/api/reports';

// Helper to format ISO date string (YYYY-MM-DD)
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Quick presets for date ranges
type PresetKey = '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'thisYear';

function getPresetRange(preset: PresetKey): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = toISODate(today);

  switch (preset) {
    case '7days': {
      const start = new Date();
      start.setDate(today.getDate() - 6);
      return { startDate: toISODate(start), endDate };
    }
    case '30days': {
      const start = new Date();
      start.setDate(today.getDate() - 29);
      return { startDate: toISODate(start), endDate };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: toISODate(start), endDate };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    case 'thisYear': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { startDate: toISODate(start), endDate };
    }
  }
}

// Colors for recharts palettes
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const canViewReports = hasPermission('reports.view');

  // Active tab state
  const [activeTab, setActiveTab] = useState<'financial' | 'clinical' | 'inventory'>('financial');

  // Date range filter state
  const [activePreset, setActivePreset] = useState<PresetKey>('thisMonth');
  const initialRange = useMemo(() => getPresetRange('thisMonth'), []);
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);

  // Financial report state
  const [financialData, setFinancialData] = useState<FinancialReportData | null>(null);
  const [loadingFinancial, setLoadingFinancial] = useState<boolean>(true);
  const [financialError, setFinancialError] = useState<string | null>(null);

  // Clinical report state
  const [clinicalData, setClinicalData] = useState<ClinicalReportData | null>(null);
  const [loadingClinical, setLoadingClinical] = useState<boolean>(false);
  const [clinicalError, setClinicalError] = useState<string | null>(null);

  // Inventory report state
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryLowStockOnly, setInventoryLowStockOnly] = useState<boolean>(false);

  // Fetch Financial Report
  const fetchFinancial = useCallback(async () => {
    setLoadingFinancial(true);
    setFinancialError(null);
    try {
      const res = await getFinancialReport({ start_date: startDate, end_date: endDate });
      if (res.success && res.data) {
        setFinancialData(res.data);
      } else {
        setFinancialError(res.message || 'Không thể tải báo cáo tài chính.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.';
      setFinancialError(message);
    } finally {
      setLoadingFinancial(false);
    }
  }, [startDate, endDate]);

  // Fetch Clinical Report
  const fetchClinical = useCallback(async () => {
    setLoadingClinical(true);
    setClinicalError(null);
    try {
      const res = await getClinicalReport({ start_date: startDate, end_date: endDate });
      if (res.success && res.data) {
        setClinicalData(res.data);
      } else {
        setClinicalError(res.message || 'Không thể tải báo cáo khám bệnh.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.';
      setClinicalError(message);
    } finally {
      setLoadingClinical(false);
    }
  }, [startDate, endDate]);

  // Fetch Inventory Report
  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    setInventoryError(null);
    try {
      const res = await getInventoryReport({
        start_date: startDate,
        end_date: endDate,
        search: inventorySearch || undefined,
        low_stock_only: inventoryLowStockOnly,
      });
      if (res.success && res.data) {
        setInventoryData(res.data);
      } else {
        setInventoryError(res.message || 'Không thể tải báo cáo kho dược.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.';
      setInventoryError(message);
    } finally {
      setLoadingInventory(false);
    }
  }, [startDate, endDate, inventorySearch, inventoryLowStockOnly]);

  // Load report based on active tab
  useEffect(() => {
    if (activeTab === 'financial') {
      fetchFinancial();
    } else if (activeTab === 'clinical') {
      fetchClinical();
    } else if (activeTab === 'inventory') {
      fetchInventory();
    }
  }, [activeTab, fetchFinancial, fetchClinical, fetchInventory]);

  // Handle Preset Change
  const applyPreset = (preset: PresetKey) => {
    setActivePreset(preset);
    const range = getPresetRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // Reload current tab
  const handleRefresh = () => {
    if (activeTab === 'financial') fetchFinancial();
    else if (activeTab === 'clinical') fetchClinical();
    else if (activeTab === 'inventory') fetchInventory();
  };

  // Filtered Inventory items
  const filteredInventoryItems = useMemo(() => {
    if (!inventoryData?.items) return [];
    return inventoryData.items.filter((item: InventoryItemReport) => {
      const matchSearch =
        !inventorySearch ||
        item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.product_code.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchLowStock = !inventoryLowStockOnly || item.is_low_stock;
      return matchSearch && matchLowStock;
    });
  }, [inventoryData, inventorySearch, inventoryLowStockOnly]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            <span>Trung tâm Báo cáo Quản trị</span>
          </div>
        }
        description="Báo cáo phân tích tổng hợp tài chính, vận hành khám chữa bệnh và biến động nhập - xuất - tồn kho dược theo thời gian thực"
        breadcrumbs={[
          { label: 'Trang chủ', href: '/admin' },
          { label: 'Báo cáo Quản trị' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center space-x-1.5"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  (loadingFinancial || loadingClinical || loadingInventory) && 'animate-spin'
                )}
              />
              <span>Làm mới</span>
            </Button>
          </div>
        }
      />

      {/* Date Range Selector Toolbar */}
      <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Quick preset buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Kỳ báo cáo:
              </span>
              <Button
                variant={activePreset === '7days' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset('7days')}
              >
                7 ngày qua
              </Button>
              <Button
                variant={activePreset === '30days' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset('30days')}
              >
                30 ngày qua
              </Button>
              <Button
                variant={activePreset === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset('thisMonth')}
              >
                Tháng này
              </Button>
              <Button
                variant={activePreset === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset('lastMonth')}
              >
                Tháng trước
              </Button>
              <Button
                variant={activePreset === 'thisYear' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset('thisYear')}
              >
                Năm nay
              </Button>
            </div>

            {/* Custom date range inputs */}
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="rep_start_date" className="text-xs text-slate-500 whitespace-nowrap">
                  Từ ngày:
                </Label>
                <Input
                  id="rep_start_date"
                  type="date"
                  className="h-8 w-36 text-xs bg-white dark:bg-slate-950"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('' as PresetKey);
                  }}
                />
              </div>
              <span className="text-slate-400">-</span>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="rep_end_date" className="text-xs text-slate-500 whitespace-nowrap">
                  Đến ngày:
                </Label>
                <Input
                  id="rep_end_date"
                  type="date"
                  className="h-8 w-36 text-xs bg-white dark:bg-slate-950"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('' as PresetKey);
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Container */}
      <Tabs
        defaultValue="financial"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'financial' | 'clinical' | 'inventory')}
        className="w-full space-y-6"
      >
        <TabsList className="grid grid-cols-3 w-full max-w-xl bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger
            value="financial"
            className="flex items-center justify-center space-x-2 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
          >
            <DollarSign className="h-4 w-4" />
            <span>Báo cáo Tài chính</span>
          </TabsTrigger>
          <TabsTrigger
            value="clinical"
            className="flex items-center justify-center space-x-2 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
          >
            <Stethoscope className="h-4 w-4" />
            <span>Báo cáo Khám bệnh</span>
          </TabsTrigger>
          <TabsTrigger
            value="inventory"
            className="flex items-center justify-center space-x-2 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
          >
            <Boxes className="h-4 w-4" />
            <span>Báo cáo Kho Dược</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* TAB 1: BÁO CÁO TÀI CHÍNH                                 */}
        {/* ========================================================= */}
        <TabsContent value="financial" className="space-y-6">
          {loadingFinancial ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Đang tổng hợp số liệu tài chính & dòng tiền...</p>
            </div>
          ) : financialError ? (
            <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-rose-800">Không thể tải dữ liệu báo cáo</h3>
              <p className="text-sm text-rose-600 mt-1">{financialError}</p>
              <Button variant="outline" size="sm" onClick={fetchFinancial} className="mt-4">
                Thử lại
              </Button>
            </Card>
          ) : financialData ? (
            <>
              {/* StatCards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Tổng Doanh thu Hóa đơn"
                  value={formatCurrency(financialData.summary.invoiced_amount)}
                  icon={Receipt}
                  variant="primary"
                  description={`${financialData.summary.invoices_count} hóa đơn đã phát sinh`}
                  trend="up"
                  trendLabel="Phát sinh kỳ này"
                />
                <StatCard
                  title="Thực thu Tiền mặt & CK"
                  value={formatCurrency(financialData.summary.collected_amount)}
                  icon={CheckCircle2}
                  variant="success"
                  description={`${financialData.summary.payments_count} phiếu thu thực tế`}
                  trend="up"
                  trendLabel="Vào sổ quỹ"
                />
                <StatCard
                  title="Tổng Chi phí Đã duyệt"
                  value={formatCurrency(financialData.summary.expense_amount)}
                  icon={CreditCard}
                  variant="warning"
                  description={`${financialData.summary.expenses_count} khoản chi vận hành`}
                  trend="down"
                  trendLabel="Chi ra sổ quỹ"
                />
                <StatCard
                  title="Lợi nhuận Ròng Kỳ này"
                  value={formatCurrency(financialData.summary.net_profit)}
                  icon={TrendingUp}
                  variant={financialData.summary.net_profit >= 0 ? 'success' : 'destructive'}
                  description={`Dòng tiền ròng: ${formatCurrency(financialData.summary.net_cashflow)}`}
                  trend={financialData.summary.net_profit >= 0 ? 'up' : 'down'}
                  trendLabel="Doanh thu - Chi phí"
                />
              </div>

              {/* Bonus KPI cards: Debt & Discount */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Công nợ mới phát sinh</p>
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-200 mt-1">
                        {formatCurrency(financialData.summary.debt_amount)}
                      </p>
                    </div>
                    <Badge variant="warning">Chưa thu hồi</Badge>
                  </div>
                </Card>
                <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Tiền giảm giá / Khuyến mãi</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-200 mt-1">
                        {formatCurrency(financialData.summary.discount_amount)}
                      </p>
                    </div>
                    <Badge variant="secondary">Ưu đãi</Badge>
                  </div>
                </Card>
                <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Tỷ lệ Thu tiền trên Doanh thu</p>
                      <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                        {financialData.summary.invoiced_amount > 0
                          ? `${Math.round((financialData.summary.collected_amount / financialData.summary.invoiced_amount) * 100)}%`
                          : '100%'}
                      </p>
                    </div>
                    <Badge variant="success">Tỷ lệ thu</Badge>
                  </div>
                </Card>
              </div>

              {/* Recharts: Revenue & Cashflow Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Timeline AreaChart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <span>Diễn biến Doanh thu, Thực thu & Chi phí theo Ngày</span>
                    </CardTitle>
                    <CardDescription>
                      So sánh tổng giá trị hóa đơn xuất, số tiền thực thu vào sổ quỹ và chi phí đã phê duyệt
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px] w-full">
                      {financialData.daily_series.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={financialData.daily_series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              tickFormatter={(str: string) => {
                                const parts = str.split('-');
                                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : str;
                              }}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(val: number) =>
                                val >= 1000000 ? `${(val / 1000000).toFixed(0)}Tr` : `${(val / 1000).toFixed(0)}k`
                              }
                            />
                            <Tooltip
                              formatter={(value: any, name: any) => {
                                const valNum = typeof value === 'number' ? value : 0;
                                const labels: Record<string, string> = {
                                  invoiced_amount: 'Doanh thu hóa đơn',
                                  collected_amount: 'Thực thu quỹ',
                                  expense_amount: 'Chi phí duyệt',
                                  net_profit: 'Lợi nhuận ròng',
                                };
                                return [formatCurrency(valNum), labels[name] || name];
                              }}
                              labelFormatter={(label: any) => `Ngày: ${formatDate(String(label))}`}
                            />
                            <Legend
                              formatter={(value) => {
                                const labels: Record<string, string> = {
                                  invoiced_amount: 'Doanh thu',
                                  collected_amount: 'Thực thu',
                                  expense_amount: 'Chi phí',
                                };
                                return labels[value] || value;
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="invoiced_amount"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorInvoiced)"
                            />
                            <Area
                              type="monotone"
                              dataKey="collected_amount"
                              stroke="#10b981"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorCollected)"
                            />
                            <Area
                              type="monotone"
                              dataKey="expense_amount"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorExpense)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          Chưa có dữ liệu giao dịch trong kỳ này
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Expenses by Category Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <PieChartIcon className="h-5 w-5 text-amber-600" />
                      <span>Cơ cấu Chi phí Vận hành</span>
                    </CardTitle>
                    <CardDescription>Phân bổ chi phí theo danh mục khoản chi</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {financialData.expenses_by_category && financialData.expenses_by_category.length > 0 ? (
                      <div className="space-y-4">
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={financialData.expenses_by_category}
                                dataKey="total_amount"
                                nameKey="category_name"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={80}
                                paddingAngle={3}
                              >
                                {financialData.expenses_by_category.map((_, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(val: any) => formatCurrency(Number(val))}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                          {financialData.expenses_by_category.map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2 truncate">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                />
                                <span className="font-medium truncate">{cat.category_name}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-semibold">{formatCurrency(cat.total_amount)}</span>
                                <span className="text-slate-400 ml-1.5">({cat.percentage}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
                        Chưa có khoản chi nào trong kỳ này
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* By Payment Method & Daily Detail Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Methods Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                      <span>Thu - Chi theo Phương thức Thanh toán</span>
                    </CardTitle>
                    <CardDescription>Chi tiết luồng tiền qua Tiền mặt, Chuyển khoản và Thẻ</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Phương thức</TableHead>
                          <TableHead className="text-right">Thực thu (IN)</TableHead>
                          <TableHead className="text-right">Chi phí (OUT)</TableHead>
                          <TableHead className="text-right">Dòng tiền ròng</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialData.by_payment_method.map((item, idx) => {
                          const methodName =
                            item.payment_method === 'CASH'
                              ? 'Tiền mặt'
                              : item.payment_method === 'BANK_TRANSFER'
                              ? 'Chuyển khoản'
                              : item.payment_method === 'CARD'
                              ? 'Thẻ / POS'
                              : item.payment_method;

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {methodName}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-emerald-600 font-semibold">
                                {formatCurrency(item.collected_amount)}
                              </TableCell>
                              <TableCell className="text-right text-amber-600 font-semibold">
                                {formatCurrency(item.expense_amount)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-bold',
                                  item.net_amount >= 0 ? 'text-blue-600' : 'text-rose-600'
                                )}
                              >
                                {formatCurrency(item.net_amount)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Daily Timeline Detail Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-indigo-600" />
                      <span>Bảng tổng hợp Tài chính theo Ngày</span>
                    </CardTitle>
                    <CardDescription>Chi tiết phát sinh doanh thu và dòng tiền từng ngày</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                        <TableRow>
                          <TableHead>Ngày</TableHead>
                          <TableHead className="text-right">Doanh thu</TableHead>
                          <TableHead className="text-right">Thực thu</TableHead>
                          <TableHead className="text-right">Chi phí</TableHead>
                          <TableHead className="text-right">Lợi nhuận</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialData.daily_series.slice().reverse().map((day, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-xs">
                              {formatDate(day.date)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatCurrency(day.invoiced_amount)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-emerald-600 font-medium">
                              {formatCurrency(day.collected_amount)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-amber-600 font-medium">
                              {formatCurrency(day.expense_amount)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right text-xs font-semibold',
                                day.net_profit >= 0 ? 'text-blue-600' : 'text-rose-600'
                              )}
                            >
                              {formatCurrency(day.net_profit)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 2: BÁO CÁO KHÁM BỆNH                                 */}
        {/* ========================================================= */}
        <TabsContent value="clinical" className="space-y-6">
          {loadingClinical ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Đang tải số liệu lượt khám & hoạt động y tế...</p>
            </div>
          ) : clinicalError ? (
            <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-rose-800">Không thể tải dữ liệu báo cáo</h3>
              <p className="text-sm text-rose-600 mt-1">{clinicalError}</p>
              <Button variant="outline" size="sm" onClick={fetchClinical} className="mt-4">
                Thử lại
              </Button>
            </Card>
          ) : clinicalData ? (
            <>
              {/* StatCards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Tổng Lịch hẹn & Tỷ lệ Đến"
                  value={clinicalData.summary.total_appointments}
                  icon={Calendar}
                  variant="primary"
                  description={`Tỷ lệ đến khám: ${clinicalData.summary.attendance_rate}% (${clinicalData.summary.attended_appointments} lượt)`}
                  trend="up"
                  trendLabel="Tỷ lệ chuyển đổi"
                />
                <StatCard
                  title="Tổng Lượt khám bệnh"
                  value={clinicalData.summary.total_visits}
                  icon={Stethoscope}
                  variant="success"
                  description={`Đã khám xong: ${clinicalData.summary.completed_visits} | Đang khám: ${clinicalData.summary.in_progress_visits}`}
                  trend="up"
                  trendLabel="Khám lâm sàng"
                />
                <StatCard
                  title="Gói khám Đã sử dụng"
                  value={clinicalData.summary.used_package_sessions}
                  icon={Sparkles}
                  variant="warning"
                  description={`${clinicalData.summary.active_packages_count} gói bệnh nhân đang kích hoạt`}
                  trend="neutral"
                  trendLabel="Buổi liệu trình"
                />
                <StatCard
                  title="Doanh thu Lượt khám"
                  value={formatCurrency(clinicalData.summary.total_revenue)}
                  icon={Activity}
                  variant="primary"
                  description="Tổng tiền phát sinh từ các buổi khám"
                  trend="up"
                  trendLabel="Doanh thu y tế"
                />
              </div>

              {/* Status Breakdown Bar */}
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Phân bổ Trạng thái Lượt khám trong kỳ
                    </p>
                    <p className="text-xs text-slate-500">
                      Tổng số: {clinicalData.summary.total_visits} lượt tiếp nhận
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">
                      Khám xong: {clinicalData.summary.completed_visits}
                    </Badge>
                    <Badge variant="info">
                      Đang khám: {clinicalData.summary.in_progress_visits}
                    </Badge>
                    <Badge variant="warning">
                      Chờ khám: {clinicalData.summary.scheduled_visits}
                    </Badge>
                    <Badge variant="destructive">
                      Đã hủy: {clinicalData.summary.cancelled_visits}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Recharts: Clinical Trends & Doctor Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Timeline Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      <span>Xu hướng Lịch hẹn & Lượt khám theo Ngày</span>
                    </CardTitle>
                    <CardDescription>Số lượng lịch hẹn đã đặt và số lượt khám thực tế diễn ra</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px] w-full">
                      {clinicalData.daily_series.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={clinicalData.daily_series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              tickFormatter={(str: string) => {
                                const parts = str.split('-');
                                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : str;
                              }}
                            />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                              formatter={(value: any, name: any) => {
                                const labels: Record<string, string> = {
                                  appointments_count: 'Số lịch hẹn',
                                  visits_count: 'Tổng lượt khám',
                                  completed_visits: 'Đã hoàn tất',
                                };
                                return [value, labels[name] || name];
                              }}
                              labelFormatter={(label: any) => `Ngày: ${formatDate(String(label))}`}
                            />
                            <Legend
                              formatter={(value) => {
                                const labels: Record<string, string> = {
                                  appointments_count: 'Lịch hẹn',
                                  visits_count: 'Lượt khám',
                                  completed_visits: 'Đã khám xong',
                                };
                                return labels[value] || value;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="appointments_count"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="visits_count"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="completed_visits"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          Chưa có lịch khám trong kỳ này
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Doctor Performance BarChart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                      <span>Hiệu suất Khám theo Bác sĩ</span>
                    </CardTitle>
                    <CardDescription>Top bác sĩ có lượt khám và hoàn thành cao nhất</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px] w-full">
                      {clinicalData.visits_by_doctor && clinicalData.visits_by_doctor.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={clinicalData.visits_by_doctor.slice(0, 6)}
                            layout="vertical"
                            margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                            <YAxis
                              type="category"
                              dataKey="doctor_name"
                              stroke="#64748b"
                              fontSize={12}
                              tickLine={false}
                              width={110}
                            />
                            <Tooltip
                              formatter={(val: any, name: any) => {
                                const labels: Record<string, string> = {
                                  total_visits: 'Tổng lượt khám',
                                  completed_visits: 'Hoàn thành',
                                };
                                return [val, labels[name] || name];
                              }}
                            />
                            <Legend
                              formatter={(value) => {
                                const labels: Record<string, string> = {
                                  total_visits: 'Lượt khám',
                                  completed_visits: 'Hoàn thành',
                                };
                                return labels[value] || value;
                              }}
                            />
                            <Bar dataKey="total_visits" fill="#93c5fd" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="completed_visits" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          Chưa có dữ liệu bác sĩ trong kỳ
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Tables: Doctors & Services */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Doctors Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <Stethoscope className="h-5 w-5 text-blue-600" />
                      <span>Bảng chi tiết Hiệu suất Bác sĩ</span>
                    </CardTitle>
                    <CardDescription>Số lượt khám, tỷ lệ hoàn tất và doanh thu đóng góp</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                        <TableRow>
                          <TableHead>Bác sĩ</TableHead>
                          <TableHead>Chức vụ</TableHead>
                          <TableHead className="text-center">Số lượt</TableHead>
                          <TableHead className="text-center">Tỷ lệ xong</TableHead>
                          <TableHead className="text-right">Doanh thu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clinicalData.visits_by_doctor.length > 0 ? (
                          clinicalData.visits_by_doctor.map((doc, idx) => {
                            const completionRate =
                              doc.total_visits > 0
                                ? Math.round((doc.completed_visits / doc.total_visits) * 100)
                                : 0;
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-medium text-xs">
                                  <div>{doc.doctor_name}</div>
                                  <div className="text-[10px] text-slate-400">{doc.employee_code}</div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-500">{doc.position || '-'}</TableCell>
                                <TableCell className="text-center text-xs font-semibold">
                                  {doc.completed_visits}/{doc.total_visits}
                                </TableCell>
                                <TableCell className="text-center text-xs">
                                  <div className="w-16 mx-auto">
                                    <Progress value={completionRate} className="h-2" />
                                    <span className="text-[10px] text-slate-500 mt-0.5 block">{completionRate}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-xs font-bold text-blue-600">
                                  {formatCurrency(doc.total_revenue)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-sm text-slate-400">
                              Chưa có dữ liệu bác sĩ
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Services Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center space-x-2">
                      <Sparkles className="h-5 w-5 text-indigo-600" />
                      <span>Thống kê Sử dụng Dịch vụ Y tế</span>
                    </CardTitle>
                    <CardDescription>Các dịch vụ được chỉ định và thực hiện nhiều nhất</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                        <TableRow>
                          <TableHead>Dịch vụ</TableHead>
                          <TableHead className="text-right">Đơn giá</TableHead>
                          <TableHead className="text-center">Số lượt</TableHead>
                          <TableHead className="text-right">Doanh thu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clinicalData.visits_by_service.length > 0 ? (
                          clinicalData.visits_by_service.map((srv, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-xs">
                                <div>{srv.service_name}</div>
                                <div className="text-[10px] text-slate-400">{srv.service_code}</div>
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-500">
                                {formatCurrency(srv.price)}
                              </TableCell>
                              <TableCell className="text-center text-xs font-semibold">
                                {srv.total_visits}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-emerald-600">
                                {formatCurrency(srv.total_revenue)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-400">
                              Chưa có dữ liệu dịch vụ
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 3: BÁO CÁO KHO DƯỢC                                  */}
        {/* ========================================================= */}
        <TabsContent value="inventory" className="space-y-6">
          {loadingInventory ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Đang đối soát Nhập - Xuất - Tồn kho thuốc & vật tư...</p>
            </div>
          ) : inventoryError ? (
            <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-rose-800">Không thể tải dữ liệu báo cáo kho</h3>
              <p className="text-sm text-rose-600 mt-1">{inventoryError}</p>
              <Button variant="outline" size="sm" onClick={fetchInventory} className="mt-4">
                Thử lại
              </Button>
            </Card>
          ) : inventoryData ? (
            <>
              {/* StatCards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Tổng Danh mục Mặt hàng"
                  value={inventoryData.summary.total_products}
                  icon={Boxes}
                  variant="primary"
                  description={`${inventoryData.summary.in_stock_count} mặt hàng đủ tồn kho`}
                  trend="neutral"
                  trendLabel="Danh mục quản lý"
                />
                <StatCard
                  title="Tổng Số lượng Nhập (IN)"
                  value={inventoryData.summary.total_in_quantity.toLocaleString('vi-VN')}
                  icon={PackagePlus}
                  variant="success"
                  description="Tổng số lượng nhập thêm trong kỳ"
                  trend="up"
                  trendLabel="Bổ sung kho"
                />
                <StatCard
                  title="Tổng Số lượng Xuất (OUT)"
                  value={inventoryData.summary.total_out_quantity.toLocaleString('vi-VN')}
                  icon={PackageMinus}
                  variant="warning"
                  description="Xuất sử dụng & kê đơn thuốc"
                  trend="down"
                  trendLabel="Tiêu hao kho"
                />
                <StatCard
                  title="Cảnh báo Tồn kho Y tế"
                  value={inventoryData.summary.low_stock_count + inventoryData.summary.out_of_stock_count}
                  icon={AlertTriangle}
                  variant={
                    inventoryData.summary.out_of_stock_count > 0 || inventoryData.summary.low_stock_count > 0
                      ? 'destructive'
                      : 'success'
                  }
                  description={`${inventoryData.summary.out_of_stock_count} hết hàng | ${inventoryData.summary.low_stock_count} chạm định mức`}
                  trend={
                    inventoryData.summary.out_of_stock_count > 0 || inventoryData.summary.low_stock_count > 0
                      ? 'down'
                      : 'neutral'
                  }
                  trendLabel="Cần nhập ngay"
                />
              </div>

              {/* Inventory Search & Filters Toolbar */}
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Tìm theo tên thuốc hoặc mã vật tư..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="pl-9 text-xs h-9 bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inventoryLowStockOnly}
                        onChange={(e) => setInventoryLowStockOnly(e.target.checked)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                      />
                      <span>Chỉ xem mặt hàng sắp hết / hết hàng</span>
                    </label>

                    <Badge variant="outline" className="text-xs">
                      Hiển thị {filteredInventoryItems.length} / {inventoryData.items.length} mặt hàng
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Detailed Inventory Report Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center space-x-2">
                    <Boxes className="h-5 w-5 text-blue-600" />
                    <span>Báo cáo Chi tiết Nhập - Xuất - Tồn Kho Dược</span>
                  </CardTitle>
                  <CardDescription>
                    Kỳ báo cáo từ {formatDate(startDate)} đến {formatDate(endDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Mã</TableHead>
                        <TableHead>Tên thuốc / Vật tư y tế</TableHead>
                        <TableHead>ĐVT</TableHead>
                        <TableHead className="text-right">Định mức</TableHead>
                        <TableHead className="text-right">Tồn đầu kỳ</TableHead>
                        <TableHead className="text-right text-emerald-600">Nhập (+)</TableHead>
                        <TableHead className="text-right text-amber-600">Xuất (-)</TableHead>
                        <TableHead className="text-right">Kiểm kê</TableHead>
                        <TableHead className="text-right font-bold">Tồn cuối kỳ</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventoryItems.length > 0 ? (
                        filteredInventoryItems.map((item, idx) => {
                          const statusBadge =
                            item.status === 'OUT_OF_STOCK' ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Hết hàng
                              </Badge>
                            ) : item.status === 'LOW_STOCK' ? (
                              <Badge variant="warning" className="text-[10px]">
                                Sắp hết
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                Đủ tồn
                              </Badge>
                            );

                          return (
                            <TableRow key={item.id || idx} className="hover:bg-slate-50/50">
                              <TableCell className="text-center text-xs text-slate-400">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                                {item.product_code}
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {item.name}
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {item.unit}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-500">
                                {Number(item.minimum_stock).toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-600">
                                {Number(item.opening_stock).toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium text-emerald-600">
                                {item.in_quantity > 0 ? `+${Number(item.in_quantity).toLocaleString('vi-VN')}` : '0'}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium text-amber-600">
                                {item.out_quantity > 0 ? `-${Number(item.out_quantity).toLocaleString('vi-VN')}` : '0'}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-500">
                                {item.adjust_quantity !== 0 ? (
                                  <span className={item.adjust_quantity > 0 ? 'text-blue-600' : 'text-rose-600'}>
                                    {item.adjust_quantity > 0 ? `+${item.adjust_quantity}` : item.adjust_quantity}
                                  </span>
                                ) : (
                                  '0'
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-slate-900 dark:text-slate-100">
                                {Number(item.closing_stock).toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {statusBadge}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-sm text-slate-400">
                            Không tìm thấy mặt hàng nào phù hợp với bộ lọc
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
