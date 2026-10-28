'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Sparkles,
  Edit,
  Trash2,
  DollarSign,
  Activity,
  Award,
  ChevronRight,
  UserCheck,
  Check,
  X,
  BarChart2,
  PieChart as PieIcon,
  HelpCircle,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';
import { DoctorKpiBarChart, DepartmentVisitsBarChart } from '@/components/charts';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  KpiTarget,
  KpiSummary,
  KpiEvaluationStatus,
  CreateKpiTargetInput,
  UpdateKpiTargetInput,
} from '@/types/kpi';
import { Employee } from '@/types/employee';
import {
  getKpiTargets,
  getKpiSummary,
  createKpiTarget,
  updateKpiTarget,
  deleteKpiTarget,
} from '@/lib/api/kpi';
import { getEmployees } from '@/lib/api/employees';

// Helper to format short currency for chart axes (e.g., 50M, 150M)
function formatShortCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}Tr`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

// Fallback employees if API is empty or loading
const fallbackEmployees: Employee[] = [
  {
    id: 1,
    employee_code: 'EMP-0001',
    full_name: 'BS. CKII. Nguyễn Văn An',
    position: 'Trưởng khoa Khám bệnh',
    department: 'Khoa Khám bệnh',
    status: 'ACTIVE',
    phone: '0901234567',
    email: 'nguyenvanan@qlpk.vn',
    date_of_birth: null,
    gender: 'MALE',
    hire_date: null,
    notes: null,
  },
  {
    id: 2,
    employee_code: 'EMP-0002',
    full_name: 'ThS. BS. Trần Thị Mai',
    position: 'Bác sĩ Tim mạch',
    department: 'Khoa Nội',
    status: 'ACTIVE',
    phone: '0912345678',
    email: 'tranthimai@qlpk.vn',
    date_of_birth: null,
    gender: 'FEMALE',
    hire_date: null,
    notes: null,
  },
  {
    id: 3,
    employee_code: 'EMP-0003',
    full_name: 'BS. Lê Hoàng Nam',
    position: 'Bác sĩ Nhi khoa',
    department: 'Khoa Nhi',
    status: 'ACTIVE',
    phone: '0933456789',
    email: 'lehoangnam@qlpk.vn',
    date_of_birth: null,
    gender: 'MALE',
    hire_date: null,
    notes: null,
  },
  {
    id: 4,
    employee_code: 'EMP-0004',
    full_name: 'CN. Phạm Thu Trang',
    position: 'Kỹ thuật viên Trưởng',
    department: 'Khoa Cận lâm sàng',
    status: 'ACTIVE',
    phone: '0944567890',
    email: 'phamthutrang@qlpk.vn',
    date_of_birth: null,
    gender: 'FEMALE',
    hire_date: null,
    notes: null,
  },
  {
    id: 5,
    employee_code: 'EMP-0005',
    full_name: 'BS. Vũ Đức Minh',
    position: 'Bác sĩ Tai Mũi Họng',
    department: 'Khoa Chuyên khoa',
    status: 'ACTIVE',
    phone: '0955678901',
    email: 'vuducminh@qlpk.vn',
    date_of_birth: null,
    gender: 'MALE',
    hire_date: null,
    notes: null,
  },
];

export default function KpiManagementPage() {
  const { user, hasPermission } = useAuth();
  const canManage =
    hasPermission('kpi_targets.manage') ||
    user?.roles?.some((r) => r.name === 'ADMIN' || r.name === 'MANAGER');

  // Page states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [targets, setTargets] = useState<KpiTarget[]>([]);
  const [summary, setSummary] = useState<KpiSummary>({
    total_targets: 0,
    total_employees_assigned: 0,
    exceeded_count: 0,
    on_track_count: 0,
    behind_count: 0,
    total_target_revenue: 0,
    total_actual_revenue: 0,
    total_target_visits: 0,
    total_actual_visits: 0,
    average_completion_rate: 0,
  });
  const [employees, setEmployees] = useState<Employee[]>(fallbackEmployees);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [periodPreset, setPeriodPreset] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [chartMetricTab, setChartMetricTab] = useState<'both' | 'revenue' | 'visits'>('both');

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<KpiTarget | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    employee_id: '',
    period_start: '',
    period_end: '',
    target_revenue: '',
    target_visits: '',
  });

  // Calculate default month range
  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
    return { start, end };
  }, []);

  // Fetch KPI data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      if (periodPreset === 'THIS_MONTH') {
        startDate = currentMonthRange.start;
        endDate = currentMonthRange.end;
      } else if (periodPreset === 'CUSTOM') {
        if (customStartDate) startDate = customStartDate;
        if (customEndDate) endDate = customEndDate;
      }

      const params: Record<string, unknown> = {};
      if (startDate) params.period_start = startDate;
      if (endDate) params.period_end = endDate;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const [targetsRes, summaryRes, empRes] = await Promise.allSettled([
        getKpiTargets(params),
        getKpiSummary({
          start_date: startDate,
          end_date: endDate,
        }),
        getEmployees({ per_page: 100 }),
      ]);

      if (targetsRes.status === 'fulfilled' && targetsRes.value.success) {
        setTargets(targetsRes.value.data || []);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value.success) {
        setSummary(summaryRes.value.data);
      }
      if (empRes.status === 'fulfilled' && empRes.value.success) {
        const rawData = empRes.value.data;
        const empList: Employee[] = Array.isArray(rawData)
          ? rawData
          : ((rawData as unknown as { data?: Employee[] })?.data ?? []);
        if (empList.length > 0) {
          setEmployees(empList);
        }
      }
    } catch (err) {
      console.error('Error fetching KPI data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodPreset, currentMonthRange, customStartDate, customEndDate, searchQuery, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart data prepared from targets
  const chartData = useMemo(() => {
    return targets.map((t) => {
      const empName = t.employee?.full_name || `Nhân viên #${t.employee_id}`;
      // Clean short name for chart display
      const shortName = empName.replace(/^(BS\.|ThS\.|CKII\.|CN\.)\s*/gi, '');
      return {
        id: t.id,
        name: shortName,
        fullName: empName,
        code: t.employee?.employee_code || `EMP-${t.employee_id}`,
        department: t.employee?.department || 'Khác',
        target_revenue: Number(t.target_revenue),
        actual_revenue: Number(t.actual_revenue),
        target_visits: Number(t.target_visits),
        actual_visits: Number(t.actual_visits),
        revenue_completion_rate: Number(t.revenue_completion_rate),
        visits_completion_rate: Number(t.visits_completion_rate),
        completion_rate: Number(t.completion_rate),
        evaluation_status: t.evaluation_status,
      };
    });
  }, [targets]);

  // Aggregated department visit volumes and revenue
  const departmentChartData = useMemo(() => {
    const deptMap: Record<string, { total_visits: number; completed_visits: number; revenue: number }> = {};
    targets.forEach((t) => {
      const dept = t.employee?.department || 'Khoa Khám bệnh';
      if (!deptMap[dept]) {
        deptMap[dept] = { total_visits: 0, completed_visits: 0, revenue: 0 };
      }
      deptMap[dept].total_visits += Number(t.target_visits) || 0;
      deptMap[dept].completed_visits += Number(t.actual_visits) || 0;
      deptMap[dept].revenue += Number(t.actual_revenue) || 0;
    });
    return Object.entries(deptMap).map(([department, d]) => ({
      department,
      total_visits: d.total_visits,
      completed_visits: d.completed_visits,
      revenue: d.revenue,
    }));
  }, [targets]);

  // Quick preset handlers for form
  const setFormPeriodMonth = (offsetMonths: number = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonths);
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
    setFormData((prev) => ({
      ...prev,
      period_start: start,
      period_end: end,
    }));
  };

  // Open dialog to create
  const handleOpenCreate = () => {
    setEditingTarget(null);
    setDialogError(null);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
    setFormData({
      employee_id: employees.length > 0 ? String(employees[0].id) : '',
      period_start: start,
      period_end: end,
      target_revenue: '100000000',
      target_visits: '150',
    });
    setIsDialogOpen(true);
  };

  // Open dialog to edit
  const handleOpenEdit = (target: KpiTarget) => {
    setEditingTarget(target);
    setDialogError(null);
    setFormData({
      employee_id: String(target.employee_id),
      period_start: target.period_start ? target.period_start.substring(0, 10) : '',
      period_end: target.period_end ? target.period_end.substring(0, 10) : '',
      target_revenue: String(target.target_revenue),
      target_visits: String(target.target_visits),
    });
    setIsDialogOpen(true);
  };

  // Save form
  const handleSaveKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    const empId = parseInt(formData.employee_id, 10);
    const targetRev = parseFloat(formData.target_revenue);
    const targetVis = parseInt(formData.target_visits, 10);

    if (!empId) {
      setDialogError('Vui lòng chọn nhân viên được giao KPI.');
      return;
    }
    if (!formData.period_start || !formData.period_end) {
      setDialogError('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc kỳ hạn.');
      return;
    }
    if (new Date(formData.period_end) < new Date(formData.period_start)) {
      setDialogError('Ngày kết thúc kỳ hạn phải lớn hơn hoặc bằng ngày bắt đầu.');
      return;
    }
    if (isNaN(targetRev) || targetRev < 0) {
      setDialogError('Chỉ tiêu doanh thu phải là số không âm.');
      return;
    }
    if (isNaN(targetVis) || targetVis < 0) {
      setDialogError('Chỉ tiêu lượt khám phải là số nguyên không âm.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingTarget) {
        const payload: UpdateKpiTargetInput = {
          employee_id: empId,
          period_start: formData.period_start,
          period_end: formData.period_end,
          target_revenue: targetRev,
          target_visits: targetVis,
        };
        const res = await updateKpiTarget(editingTarget.id, payload);
        if (res.success) {
          setIsDialogOpen(false);
          await fetchData();
        } else {
          setDialogError(res.message || 'Cập nhật chỉ tiêu KPI thất bại.');
        }
      } else {
        const payload: CreateKpiTargetInput = {
          employee_id: empId,
          period_start: formData.period_start,
          period_end: formData.period_end,
          target_revenue: targetRev,
          target_visits: targetVis,
        };
        const res = await createKpiTarget(payload);
        if (res.success) {
          setIsDialogOpen(false);
          await fetchData();
        } else {
          setDialogError(res.message || 'Giao chỉ tiêu KPI thất bại.');
        }
      }
    } catch (err: unknown) {
      const anyErr = err as { errors?: Record<string, string[]>; message?: string };
      if (anyErr?.errors) {
        const firstField = Object.keys(anyErr.errors)[0];
        setDialogError(anyErr.errors[firstField]?.[0] || anyErr.message || 'Đã có lỗi xảy ra.');
      } else {
        setDialogError(anyErr?.message || 'Không thể lưu chỉ tiêu KPI.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete target
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      setSubmitting(true);
      const res = await deleteKpiTarget(deleteTargetId);
      if (res.success) {
        setDeleteTargetId(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Delete KPI failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Evaluation status badge helper
  const renderEvaluationBadge = (status: KpiEvaluationStatus, rate?: number) => {
    switch (status) {
      case 'EXCEEDED':
        return (
          <Badge variant="success" className="flex items-center gap-1 font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            Vượt chỉ tiêu {rate !== undefined ? `(${rate}%)` : ''}
          </Badge>
        );
      case 'ON_TRACK':
        return (
          <Badge variant="info" className="flex items-center gap-1 font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Đang đạt {rate !== undefined ? `(${rate}%)` : ''}
          </Badge>
        );
      case 'BEHIND':
      default:
        return (
          <Badge variant="destructive" className="flex items-center gap-1 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Chậm tiến độ {rate !== undefined ? `(${rate}%)` : ''}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Quản lý & Đánh giá KPI Nhân viên"
        description="Theo dõi tiến độ chỉ tiêu doanh thu, lượt khám và đánh giá hiệu suất nhân sự phòng khám theo thời gian thực."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={refreshing}
              className="gap-2 transition-all"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              <span>Làm mới</span>
            </Button>
            {canManage && (
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenCreate}
                className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Giao chỉ tiêu KPI</span>
              </Button>
            )}
          </div>
        }
      />

      {/* 2. Stat Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Nhân sự nhận chỉ tiêu"
          value={`${summary.total_employees_assigned} nhân viên`}
          description={`${summary.total_targets} kỳ chỉ tiêu được thiết lập`}
          icon={Users}
          variant="primary"
        />

        <StatCard
          title="Tỷ lệ hoàn thành TB"
          value={`${summary.average_completion_rate}%`}
          trend={
            summary.average_completion_rate >= 100
              ? 'up'
              : summary.average_completion_rate >= 80
              ? 'neutral'
              : 'down'
          }
          trendValue={`${summary.average_completion_rate}%`}
          description="Đánh giá trung bình theo doanh thu & lượt khám"
          icon={Target}
          variant={
            summary.average_completion_rate >= 100
              ? 'success'
              : summary.average_completion_rate >= 80
              ? 'primary'
              : 'warning'
          }
        />

        <StatCard
          title="Nhân sự vượt chỉ tiêu"
          value={`${summary.exceeded_count} nhân sự`}
          description={`${summary.on_track_count} đạt tiến độ, ${summary.behind_count} chậm tiến độ`}
          badge={<Badge variant="success">+{summary.exceeded_count} xuất sắc</Badge>}
          icon={Award}
          variant="success"
        />

        <StatCard
          title="Doanh thu thực đạt"
          value={formatCurrency(summary.total_actual_revenue)}
          description={`Mục tiêu: ${formatCurrency(summary.total_target_revenue)}`}
          icon={Sparkles}
          variant="primary"
        />
      </div>

      {/* 3. Recharts Target vs Actual Comparison Charts */}
      <div className="space-y-6">
        <DoctorKpiBarChart
          data={chartData}
          metric={chartMetricTab}
          title="Đối chiếu Chỉ tiêu vs Thực đạt Bác sĩ (KPI Performance)"
          description="So sánh trực quan giữa mục tiêu đã giao và kết quả vận hành thực tế của từng nhân viên"
        />

        {departmentChartData.length > 0 && (
          <DepartmentVisitsBarChart
            data={departmentChartData}
            title="Số Lượt khám Hoàn thành Giữa các Chuyên khoa Phòng khám"
            description="Tổng hợp lượt khám tiếp nhận và hoàn tất phân bổ theo từng khoa phòng chuyên môn"
          />
        )}
      </div>

      {/* 4. Filters & Search Control Bar */}
      <Card className="border shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm theo tên hoặc mã NV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="EXCEEDED">Vượt chỉ tiêu (EXCEEDED)</option>
                <option value="ON_TRACK">Đang đạt (ON_TRACK)</option>
                <option value="BEHIND">Chậm tiến độ (BEHIND)</option>
              </select>
            </div>

            {/* Period Filter */}
            <div className="w-full sm:w-44">
              <select
                value={periodPreset}
                onChange={(e) => setPeriodPreset(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="THIS_MONTH">Tháng hiện tại</option>
                <option value="ALL">Toàn thời gian</option>
                <option value="CUSTOM">Tùy chọn ngày...</option>
              </select>
            </div>
          </div>

          {periodPreset === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 w-36 text-xs"
              />
              <span className="text-slate-400">→</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 w-36 text-xs"
              />
            </div>
          )}

          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-end md:self-center">
            <span>Tìm thấy:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{targets.length}</span>
            <span>chỉ tiêu</span>
          </div>
        </div>
      </Card>

      {/* 5. Detailed KPI Targets Table with Progress */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Chi tiết Chỉ tiêu & Tiến độ Hoàn thành KPI
              </CardTitle>
              <CardDescription>
                Đối soát tỷ lệ hoàn thành doanh thu, lượt khám và tiến độ thực tế theo từng kỳ hạn
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50/80 dark:bg-slate-900/80">
                <TableHead className="w-[240px]">Nhân viên</TableHead>
                <TableHead className="w-[150px]">Kỳ hạn</TableHead>
                <TableHead className="min-w-[200px]">Doanh thu (Thực / Mục tiêu)</TableHead>
                <TableHead className="min-w-[180px]">Lượt khám (Thực / Mục tiêu)</TableHead>
                <TableHead className="w-[120px] text-center">Tỷ lệ TB</TableHead>
                <TableHead className="w-[150px]">Đánh giá</TableHead>
                {canManage && <TableHead className="w-[100px] text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="h-32 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Đang tải danh sách chỉ tiêu KPI...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="h-32 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Target className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium">Không tìm thấy chỉ tiêu KPI phù hợp</p>
                      <p className="text-xs text-slate-400">Hãy thử xóa bộ lọc hoặc giao chỉ tiêu mới</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                targets.map((target) => {
                  const emp = target.employee;
                  const revRate = target.revenue_completion_rate ?? 0;
                  const visRate = target.visits_completion_rate ?? 0;
                  const avgRate = target.completion_rate ?? 0;

                  return (
                    <TableRow key={target.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors">
                      {/* Employee Info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center font-semibold text-xs shrink-0">
                            {emp?.full_name ? emp.full_name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                              {emp?.full_name || `Nhân viên #${target.employee_id}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              {emp?.employee_code} • {emp?.position || emp?.department || 'Chuyên môn'}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Period */}
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {formatDate(target.period_start)}
                          </div>
                          <div className="text-slate-400">
                            đến {formatDate(target.period_end)}
                          </div>
                        </div>
                      </TableCell>

                      {/* Revenue with Progress */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(target.actual_revenue)}
                            </span>
                            <span className="text-slate-500">
                              / {formatCurrency(target.target_revenue)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(revRate, 100)}
                              className="h-2 flex-1"
                              indicatorClassName={
                                revRate >= 100
                                  ? 'bg-emerald-500'
                                  : revRate >= 80
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }
                            />
                            <span
                              className={cn(
                                'text-xs font-semibold w-12 text-right',
                                revRate >= 100
                                  ? 'text-emerald-600'
                                  : revRate >= 80
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              )}
                            >
                              {revRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Visits with Progress */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {target.actual_visits} lượt
                            </span>
                            <span className="text-slate-500">
                              / {target.target_visits} lượt
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(visRate, 100)}
                              className="h-2 flex-1"
                              indicatorClassName={
                                visRate >= 100
                                  ? 'bg-violet-500'
                                  : visRate >= 80
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }
                            />
                            <span
                              className={cn(
                                'text-xs font-semibold w-12 text-right',
                                visRate >= 100
                                  ? 'text-violet-600'
                                  : visRate >= 80
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              )}
                            >
                              {visRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Average completion rate */}
                      <TableCell className="text-center">
                        <div className="inline-block px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200">
                          {avgRate.toFixed(1)}%
                        </div>
                      </TableCell>

                      {/* Evaluation Status */}
                      <TableCell>
                        {renderEvaluationBadge(target.evaluation_status)}
                      </TableCell>

                      {/* Actions */}
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-blue-600"
                              onClick={() => handleOpenEdit(target)}
                              title="Chỉnh sửa chỉ tiêu"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-rose-600"
                              onClick={() => setDeleteTargetId(target.id)}
                              title="Xóa chỉ tiêu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 6. Modal Create / Edit KPI Target Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveKpi}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                {editingTarget ? 'Cập nhật chỉ tiêu KPI' : 'Giao chỉ tiêu KPI mới'}
              </DialogTitle>
              <DialogDescription>
                Thiết lập chỉ tiêu doanh thu và lượt khám cho nhân sự trong kỳ hạn xác định.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {dialogError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{dialogError}</span>
                </div>
              )}

              {/* Employee Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="employee_id" className="text-sm font-medium">
                  Nhân viên nhận chỉ tiêu <span className="text-rose-500">*</span>
                </Label>
                <select
                  id="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  disabled={!!editingTarget}
                  className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 disabled:opacity-60"
                  required
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code} - {emp.position || emp.department || 'Nhân sự'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Period Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-500">Chọn nhanh kỳ hạn:</Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setFormPeriodMonth(0)}
                    >
                      Tháng này
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setFormPeriodMonth(1)}
                    >
                      Tháng sau
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="period_start" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Từ ngày <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="period_start"
                      type="date"
                      value={formData.period_start}
                      onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="period_end" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Đến ngày <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="period_end"
                      type="date"
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Target Revenue */}
              <div className="space-y-1.5">
                <Label htmlFor="target_revenue" className="text-sm font-medium">
                  Chỉ tiêu Doanh thu (VNĐ) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="target_revenue"
                    type="number"
                    min="0"
                    step="1000000"
                    placeholder="Ví dụ: 100000000"
                    value={formData.target_revenue}
                    onChange={(e) => setFormData({ ...formData, target_revenue: e.target.value })}
                    required
                  />
                </div>
                {formData.target_revenue && !isNaN(Number(formData.target_revenue)) && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Bằng chữ: {formatCurrency(formData.target_revenue)}
                  </p>
                )}
              </div>

              {/* Target Visits */}
              <div className="space-y-1.5">
                <Label htmlFor="target_visits" className="text-sm font-medium">
                  Chỉ tiêu Số lượt khám <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="target_visits"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ví dụ: 150"
                  value={formData.target_visits}
                  onChange={(e) => setFormData({ ...formData, target_visits: e.target.value })}
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              >
                {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>{editingTarget ? 'Lưu thay đổi' : 'Xác nhận giao KPI'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Delete Confirmation Dialog */}
      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận xóa chỉ tiêu KPI
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bản ghi chỉ tiêu KPI này? Thao tác này sẽ xóa mục tiêu đã giao và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTargetId(null)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={submitting}
              className="gap-1.5"
            >
              {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
              <span>Xác nhận xóa</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
