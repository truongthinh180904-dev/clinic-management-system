'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  PlusCircle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Building2,
  Banknote,
  FileText,
  AlertCircle,
  FolderPlus,
  Eye,
  Check,
  X,
  Calendar,
  Layers,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  CashbookSummary,
  CashTransaction,
  CashTransactionType,
  CreateCashTransactionInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  Expense,
  ExpenseApprovalStatus,
  ExpenseCategory,
  PaymentMethod,
} from '@/types/finance';
import {
  approveExpense,
  createCashTransaction,
  createExpense,
  createExpenseCategory,
  getCashbookSummary,
  getCashTransactions,
  getExpenseCategories,
  getExpenses,
  rejectExpense,
  updateExpenseCategory,
} from '@/lib/api/finance';

function formatCurrencyShort(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace(/\.0$/, '')} tr`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(0)} k`;
  }
  return String(amount);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    fill?: string;
  }>;
  label?: string;
}

const CustomCashflowTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
        <div className="space-y-1 text-xs">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color || entry.fill || '#3b82f6' }}
                />
                {entry.name}:
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function FinanceCashbookPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('cashbook');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<string>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterMethod, setFilterMethod] = useState<PaymentMethod | ''>('');

  // Cashbook Data
  const [summary, setSummary] = useState<CashbookSummary | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [txSearch, setTxSearch] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<CashTransactionType | ''>('');
  const [txPage, setTxPage] = useState<number>(1);
  const txPerPage = 10;

  // Chart view mode: Bar (Thu vs Chi) or Area (Dòng tiền ròng)
  const [chartMode, setChartMode] = useState<'bar' | 'area'>('bar');

  // Expenses Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expSearch, setExpSearch] = useState<string>('');
  const [expStatusFilter, setExpStatusFilter] = useState<ExpenseApprovalStatus | ''>('');
  const [expCategoryFilter, setExpCategoryFilter] = useState<string>('');
  const [expPage, setExpPage] = useState<number>(1);
  const expPerPage = 10;

  // Expense Categories Data
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [catSearch, setCatSearch] = useState<string>('');

  // Modals state
  const [openNewTxDialog, setOpenNewTxDialog] = useState<boolean>(false);
  const [openNewExpenseDialog, setOpenNewExpenseDialog] = useState<boolean>(false);
  const [openNewCategoryDialog, setOpenNewCategoryDialog] = useState<boolean>(false);
  const [openRejectDialog, setOpenRejectDialog] = useState<boolean>(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [openExpenseDetailDialog, setOpenExpenseDetailDialog] = useState<boolean>(false);
  const [openEditCatDialog, setOpenEditCatDialog] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

  // Form states - New Cash Transaction
  const [newTxType, setNewTxType] = useState<CashTransactionType>('IN');
  const [newTxAmount, setNewTxAmount] = useState<string>('');
  const [newTxMethod, setNewTxMethod] = useState<PaymentMethod>('CASH');
  const [newTxDate, setNewTxDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [newTxDesc, setNewTxDesc] = useState<string>('');
  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);

  // Form states - New Expense
  const [newExpCatId, setNewExpCatId] = useState<string>('');
  const [newExpAmount, setNewExpAmount] = useState<string>('');
  const [newExpMethod, setNewExpMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [newExpDate, setNewExpDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newExpDesc, setNewExpDesc] = useState<string>('');
  const [isSubmittingExp, setIsSubmittingExp] = useState<boolean>(false);

  // Form states - Reject Expense
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Form states - Category
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [catStatus, setCatStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [isSubmittingCat, setIsSubmittingCat] = useState<boolean>(false);

  // Load all finance data
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [sumRes, txRes, expRes, catRes] = await Promise.all([
        getCashbookSummary({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          payment_method: filterMethod || undefined,
        }),
        getCashTransactions(),
        getExpenses(),
        getExpenseCategories(),
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (expRes.data) setExpenses(expRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err) {
      console.error('Error loading finance data:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Có lỗi xảy ra khi nạp dữ liệu thu chi. Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, filterMethod]);

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, [loadData]);

  // Handle Quick Date Range presets
  const handleDatePresetChange = (preset: string) => {
    setDateRange(preset);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const ymd = toYMD(today);
      setStartDate(ymd);
      setEndDate(ymd);
    } else if (preset === '7d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      setStartDate(toYMD(start));
      setEndDate(toYMD(today));
    } else if (preset === '30d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      setStartDate(toYMD(start));
      setEndDate(toYMD(today));
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toYMD(start));
      setEndDate(toYMD(today));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Recharts Chart Data generation from transactions
  const chartData = useMemo(() => {
    if (!transactions.length) return [];

    // Group transactions by date (YYYY-MM-DD)
    const dateMap = new Map<string, { totalIn: number; totalOut: number }>();

    // Seed last 10 days
    const days = 10;
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { totalIn: 0, totalOut: 0 });
    }

    transactions.forEach((tx) => {
      const dateKey = tx.transaction_date ? tx.transaction_date.slice(0, 10) : '';
      if (dateKey && dateMap.has(dateKey)) {
        const item = dateMap.get(dateKey)!;
        if (tx.transaction_type === 'IN') {
          item.totalIn += Number(tx.amount);
        } else {
          item.totalOut += Number(tx.amount);
        }
      }
    });

    return Array.from(dateMap.entries()).map(([dateStr, val]) => {
      const parts = dateStr.split('-');
      const displayDate = `${parts[2]}/${parts[1]}`;
      return {
        date: dateStr,
        displayDate,
        totalIn: val.totalIn,
        totalOut: val.totalOut,
        netFlow: val.totalIn - val.totalOut,
      };
    });
  }, [transactions]);

  // Filtered Cash Transactions for Table
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txTypeFilter && tx.transaction_type !== txTypeFilter) return false;
      if (filterMethod && tx.payment_method !== filterMethod) return false;
      if (txSearch) {
        const q = txSearch.toLowerCase();
        const matchCode = tx.transaction_code.toLowerCase().includes(q);
        const matchDesc = tx.description ? tx.description.toLowerCase().includes(q) : false;
        const matchCreator = tx.creator?.employee?.full_name?.toLowerCase().includes(q) || false;
        if (!matchCode && !matchDesc && !matchCreator) return false;
      }
      return true;
    });
  }, [transactions, txTypeFilter, filterMethod, txSearch]);

  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPerPage;
    return filteredTransactions.slice(start, start + txPerPage);
  }, [filteredTransactions, txPage]);

  const totalTxPages = Math.ceil(filteredTransactions.length / txPerPage) || 1;

  // Filtered Expenses for Table
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (expStatusFilter && exp.approval_status !== expStatusFilter) return false;
      if (expCategoryFilter && String(exp.category_id) !== expCategoryFilter) return false;
      if (filterMethod && exp.payment_method !== filterMethod) return false;
      if (expSearch) {
        const q = expSearch.toLowerCase();
        const matchCode = exp.expense_code.toLowerCase().includes(q);
        const matchDesc = exp.description ? exp.description.toLowerCase().includes(q) : false;
        const matchCat = exp.category?.name?.toLowerCase().includes(q) || false;
        if (!matchCode && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [expenses, expStatusFilter, expCategoryFilter, filterMethod, expSearch]);

  const paginatedExpenses = useMemo(() => {
    const start = (expPage - 1) * expPerPage;
    return filteredExpenses.slice(start, start + expPerPage);
  }, [filteredExpenses, expPage]);

  const totalExpPages = Math.ceil(filteredExpenses.length / expPerPage) || 1;

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    if (!catSearch) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, catSearch]);

  // Handle Create Cash Transaction
  const handleCreateCashTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Vui lòng nhập số tiền giao dịch hợp lệ (> 0).',
      });
      return;
    }

    try {
      setIsSubmittingTx(true);
      const input: CreateCashTransactionInput = {
        transaction_type: newTxType,
        amount: amountNum,
        payment_method: newTxMethod,
        transaction_date: newTxDate ? new Date(newTxDate).toISOString() : new Date().toISOString(),
        description: newTxDesc.trim() || undefined,
      };

      const res = await createCashTransaction(input);
      setOpenNewTxDialog(false);
      setNewTxAmount('');
      setNewTxDesc('');
      setFeedbackMessage({
        type: 'success',
        text: `Đã lập phiếu ${newTxType === 'IN' ? 'thu' : 'chi'} quỹ ${res.data.transaction_code} (${formatCurrency(amountNum)}) thành công.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo giao dịch sổ quỹ.';
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Handle Create Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpCatId) {
      setFeedbackMessage({ type: 'error', text: 'Vui lòng chọn danh mục chi phí.' });
      return;
    }
    const amountNum = parseFloat(newExpAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedbackMessage({ type: 'error', text: 'Vui lòng nhập số tiền chi hợp lệ (> 0).' });
      return;
    }

    try {
      setIsSubmittingExp(true);
      const input: CreateExpenseInput = {
        category_id: Number(newExpCatId),
        amount: amountNum,
        payment_method: newExpMethod,
        expense_date: newExpDate ? new Date(newExpDate).toISOString() : new Date().toISOString(),
        description: newExpDesc.trim() || undefined,
      };

      const res = await createExpense(input);
      setOpenNewExpenseDialog(false);
      setNewExpAmount('');
      setNewExpDesc('');
      setFeedbackMessage({
        type: 'success',
        text: `Đã tạo phiếu chi ${res.data.expense_code}. Phiếu đang ở trạng thái CHỜ PHÊ DUYỆT.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo phiếu chi.';
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmittingExp(false);
    }
  };

  // Handle Quick Approve Expense
  const handleApproveExpense = async (exp: Expense) => {
    if (!window.confirm(`Xác nhận phê duyệt phiếu chi ${exp.expense_code} (${formatCurrency(exp.amount)})?\nSau khi duyệt, hệ thống sẽ tự động ghi bút toán CHI (OUT) vào sổ quỹ.`)) {
      return;
    }

    try {
      const res = await approveExpense(exp.id);
      setFeedbackMessage({
        type: 'success',
        text: `Đã phê duyệt thành công phiếu chi ${res.data.expense_code}. Sổ quỹ đã được tự động cập nhật giảm ${formatCurrency(res.data.amount)}.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi phê duyệt phiếu chi.';
      setFeedbackMessage({ type: 'error', text: msg });
    }
  };

  // Handle Reject Expense
  const handleRejectExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    if (!rejectReason.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Vui lòng nhập lý do từ chối phiếu chi.' });
      return;
    }

    try {
      setIsSubmittingReject(true);
      const res = await rejectExpense(selectedExpense.id, { reason: rejectReason.trim() });
      setOpenRejectDialog(false);
      setSelectedExpense(null);
      setRejectReason('');
      setFeedbackMessage({
        type: 'info',
        text: `Đã từ chối phiếu chi ${res.data.expense_code}. Lý do: "${rejectReason.trim()}".`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi từ chối phiếu chi.';
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Tên danh mục chi phí không được để trống.' });
      return;
    }

    try {
      setIsSubmittingCat(true);
      const input: CreateExpenseCategoryInput = {
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        status: catStatus,
      };

      const res = await createExpenseCategory(input);
      setOpenNewCategoryDialog(false);
      setCatName('');
      setCatDesc('');
      setFeedbackMessage({
        type: 'success',
        text: `Thêm nhóm chi phí "${res.data.name}" thành công.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi thêm danh mục chi phí.';
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Handle Update Category
  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    if (!catName.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Tên danh mục chi phí không được để trống.' });
      return;
    }

    try {
      setIsSubmittingCat(true);
      const res = await updateExpenseCategory(selectedCategory.id, {
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        status: catStatus,
      });
      setOpenEditCatDialog(false);
      setSelectedCategory(null);
      setFeedbackMessage({
        type: 'success',
        text: `Cập nhật danh mục "${res.data.name}" thành công.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật danh mục chi phí.';
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Pending expenses count & total amount
  const pendingExpensesStats = useMemo(() => {
    const pendings = expenses.filter((e) => e.approval_status === 'PENDING');
    const totalAmount = pendings.reduce((sum, e) => sum + Number(e.amount), 0);
    return { count: pendings.length, totalAmount };
  }, [expenses]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Thu chi & Sổ quỹ Phòng khám
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản lý dòng tiền thực tế (Cashflow), kiểm soát sổ cái thu chi, phê duyệt phiếu chi và danh mục chi phí vận hành.
              </p>
            </div>
          </div>
        }
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Tài chính & Kho Dược' },
          { label: 'Sổ quỹ & Thu chi' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={refreshing}
              className="gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Làm mới
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewTxType('IN');
                setNewTxAmount('');
                setNewTxDesc('');
                setOpenNewTxDialog(true);
              }}
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40 text-xs font-medium"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Lập Phiếu Thu / Chi Quỹ
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setNewExpCatId(categories[0]?.id ? String(categories[0].id) : '');
                setNewExpAmount('');
                setNewExpDesc('');
                setOpenNewExpenseDialog(true);
              }}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm shadow-blue-600/20"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Tạo Phiếu Chi Mới
            </Button>
          </div>
        }
      />

      {/* Dismissible Feedback Message */}
      {feedbackMessage && (
        <div
          className={cn(
            'flex items-center justify-between rounded-lg p-3 text-sm transition-all',
            feedbackMessage.type === 'success' &&
              'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
            feedbackMessage.type === 'error' &&
              'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
            feedbackMessage.type === 'info' &&
              'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900'
          )}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {feedbackMessage.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
            {feedbackMessage.type === 'info' && <Clock className="h-4 w-4 shrink-0" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Date & Filter Toolbar */}
      <Card className="border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick date presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Kỳ báo cáo:
              </span>
              {[
                { key: 'today', label: 'Hôm nay' },
                { key: '7d', label: '7 ngày qua' },
                { key: '30d', label: '30 ngày qua' },
                { key: 'month', label: 'Tháng này' },
                { key: 'all', label: 'Toàn bộ' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleDatePresetChange(item.key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    dateRange === item.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Custom Range & Payment Method filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDateRange('custom');
                    setStartDate(e.target.value);
                  }}
                  className="h-8 w-34 text-xs"
                />
                <span className="text-slate-400">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDateRange('custom');
                    setEndDate(e.target.value);
                  }}
                  className="h-8 w-34 text-xs"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="flex items-center gap-1">
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value as PaymentMethod | '')}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">Tất cả phương thức</option>
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                  <option value="CARD">Quẹt thẻ (CARD)</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 StatCards - Opening, Total In, Total Out, Closing Balance */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tồn quỹ Đầu kỳ"
          value={formatCurrency(summary?.opening_balance ?? 0)}
          icon={Wallet}
          variant="primary"
          description="Số dư lũy kế trước mốc thời gian lọc"
          trend="neutral"
          trendLabel="Số dư bảo toàn"
        />
        <StatCard
          title="Tổng Thu trong kỳ (IN)"
          value={formatCurrency(summary?.total_in ?? 0)}
          icon={TrendingUp}
          variant="success"
          description="Doanh thu hóa đơn & nộp tiền quỹ"
          trend="up"
          trendValue={`+${formatCurrencyShort(summary?.total_in ?? 0)}`}
          trendLabel="Dòng tiền vào"
        />
        <StatCard
          title="Tổng Chi trong kỳ (OUT)"
          value={formatCurrency(summary?.total_out ?? 0)}
          icon={TrendingDown}
          variant="destructive"
          description="Phiếu chi đã duyệt & xuất quỹ"
          trend="down"
          trendValue={`-${formatCurrencyShort(summary?.total_out ?? 0)}`}
          trendLabel="Dòng tiền ra"
        />
        <StatCard
          title="Tồn quỹ Cuối kỳ"
          value={formatCurrency(summary?.closing_balance ?? 0)}
          icon={CircleDollarSign}
          variant="primary"
          description={
            summary && summary.net_change >= 0
              ? `Dòng tiền ròng: +${formatCurrency(summary.net_change)}`
              : `Dòng tiền ròng: ${formatCurrency(summary?.net_change ?? 0)}`
          }
          trend={summary && summary.net_change >= 0 ? 'up' : 'down'}
          trendLabel={summary && summary.net_change >= 0 ? 'Dương dòng tiền' : 'Âm dòng tiền'}
        />
      </div>

      {/* Pending Expenses Alert Banner (If Any) */}
      {pendingExpensesStats.count > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Có {pendingExpensesStats.count} phiếu chi đang chờ Quản lý phê duyệt (Tổng: {formatCurrency(pendingExpensesStats.totalAmount)})
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Phiếu chi sau khi được Quản lý duyệt sẽ tự động trừ quỹ và xuất hiện trong sổ quỹ tiền tệ.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActiveTab('expenses');
              setExpStatusFilter('PENDING');
            }}
            className="border-amber-300 bg-white text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
          >
            Duyệt phiếu ngay
          </Button>
        </div>
      )}

      {/* Main Tabs System */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="cashbook" className="flex items-center gap-2 text-xs font-semibold">
            <Wallet className="h-4 w-4" />
            Sổ quỹ & Dòng tiền
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2 text-xs font-semibold">
            <FileText className="h-4 w-4" />
            Quản lý Phiếu chi
            {pendingExpensesStats.count > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {pendingExpensesStats.count}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2 text-xs font-semibold">
            <Layers className="h-4 w-4" />
            Danh mục Chi phí
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB 1: SỔ QUỸ & DÒNG TIỀN (CASHBOOK & RECHARTS CHART)
           ========================================================================= */}
        <TabsContent value="cashbook" className="space-y-6">
          {/* Cashflow Chart & Breakdown Card Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Recharts Cashflow Trend Chart */}
            <Card className="lg:col-span-2 border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    Biểu đồ Dòng tiền Thực tế (Cashflow)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    Đối chiếu doanh thu thực thu vào quỹ (IN) và các khoản chi thực xuất (OUT)
                  </CardDescription>
                </div>
                {/* Switch Chart Mode */}
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 text-xs">
                  <button
                    onClick={() => setChartMode('bar')}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-all',
                      chartMode === 'bar'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    )}
                  >
                    Thu vs Chi
                  </button>
                  <button
                    onClick={() => setChartMode('area')}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-all',
                      chartMode === 'area'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    )}
                  >
                    Dòng tiền ròng
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[280px] w-full">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartMode === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="displayDate"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => formatCurrencyShort(val)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <Tooltip content={<CustomCashflowTooltip />} />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                          />
                          <Bar
                            dataKey="totalIn"
                            name="Thu quỹ (IN)"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                          <Bar
                            dataKey="totalOut"
                            name="Chi quỹ (OUT)"
                            fill="#f43f5e"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                        </BarChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="netFlowGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="displayDate"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => formatCurrencyShort(val)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <Tooltip content={<CustomCashflowTooltip />} />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="netFlow"
                            name="Dòng tiền ròng (Net Flow)"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#netFlowGrad)"
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      Đang tải biểu đồ dòng tiền...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Breakdown by Payment Method */}
            <Card className="border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  Cơ cấu Quỹ theo Phương thức
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Số dư hiện tại phân bổ theo từng hình thức tiền tệ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {/* Cash */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      Tiền mặt tại Két (CASH)
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(summary?.by_payment_method?.CASH?.closing_balance ?? 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-emerald-600 font-medium">
                      + Thu: {formatCurrency(summary?.by_payment_method?.CASH?.total_in ?? 0)}
                    </span>
                    <span className="text-rose-600 font-medium text-right">
                      - Chi: {formatCurrency(summary?.by_payment_method?.CASH?.total_out ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Bank Transfer */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Tài khoản Ngân hàng (BANK)
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(summary?.by_payment_method?.BANK_TRANSFER?.closing_balance ?? 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-emerald-600 font-medium">
                      + Thu: {formatCurrency(summary?.by_payment_method?.BANK_TRANSFER?.total_in ?? 0)}
                    </span>
                    <span className="text-rose-600 font-medium text-right">
                      - Chi: {formatCurrency(summary?.by_payment_method?.BANK_TRANSFER?.total_out ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Card / POS */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      Thẻ & Máy POS (CARD)
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(summary?.by_payment_method?.CARD?.closing_balance ?? 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-emerald-600 font-medium">
                      + Thu: {formatCurrency(summary?.by_payment_method?.CARD?.total_in ?? 0)}
                    </span>
                    <span className="text-rose-600 font-medium text-right">
                      - Chi: {formatCurrency(summary?.by_payment_method?.CARD?.total_out ?? 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sổ cái Giao dịch Quỹ (Cash Transactions Table) */}
          <Card className="border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Sổ cái Lịch sử Giao dịch Quỹ ({filteredTransactions.length} bản ghi)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Lịch sử toàn bộ các lần thu vào và chi ra khỏi quỹ phòng khám
                </CardDescription>
              </div>

              {/* Table search & filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Tìm mã phiếu, ghi chú..."
                    value={txSearch}
                    onChange={(e) => {
                      setTxSearch(e.target.value);
                      setTxPage(1);
                    }}
                    className="h-8 w-44 pl-8 text-xs"
                  />
                </div>
                <select
                  value={txTypeFilter}
                  onChange={(e) => {
                    setTxTypeFilter(e.target.value as CashTransactionType | '');
                    setTxPage(1);
                  }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">Tất cả loại giao dịch</option>
                  <option value="IN">Chỉ xem Thu quỹ (IN)</option>
                  <option value="OUT">Chỉ xem Chi quỹ (OUT)</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewTxType('IN');
                    setNewTxAmount('');
                    setNewTxDesc('');
                    setOpenNewTxDialog(true);
                  }}
                  className="h-8 gap-1 text-xs"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Tạo phiếu quỹ
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Mã phiếu</TableHead>
                    <TableHead className="w-24">Loại quỹ</TableHead>
                    <TableHead className="w-36 text-right">Số tiền</TableHead>
                    <TableHead className="w-32">Phương thức</TableHead>
                    <TableHead className="w-36">Nguồn tham chiếu</TableHead>
                    <TableHead className="w-40">Thời gian</TableHead>
                    <TableHead className="w-44">Người thực hiện</TableHead>
                    <TableHead>Diễn giải / Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-36 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Wallet className="h-8 w-8 mb-2 stroke-1 opacity-50" />
                          <p className="text-sm font-medium">Không tìm thấy giao dịch quỹ nào</p>
                          <p className="text-xs">Thử đổi điều kiện lọc hoặc tạo giao dịch thu/chi mới</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <TableCell className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                          {tx.transaction_code}
                        </TableCell>
                        <TableCell>
                          {tx.transaction_type === 'IN' ? (
                            <Badge variant="success" className="gap-1 text-[11px] font-semibold">
                              <ArrowUpRight className="h-3 w-3" /> Thu quỹ
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
                              <ArrowDownRight className="h-3 w-3" /> Chi quỹ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-bold text-xs',
                            tx.transaction_type === 'IN'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          )}
                        >
                          {tx.transaction_type === 'IN' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {tx.payment_method === 'CASH' && 'Tiền mặt'}
                            {tx.payment_method === 'BANK_TRANSFER' && 'Chuyển khoản'}
                            {tx.payment_method === 'CARD' && 'Quẹt thẻ'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                          {tx.reference_type === 'Payment' && (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium">
                              Biên lai viện phí
                            </span>
                          )}
                          {tx.reference_type === 'Expense' && (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-medium">
                              Phiếu chi đã duyệt
                            </span>
                          )}
                          {(!tx.reference_type || tx.reference_type === 'Manual') && (
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                              Nạp / Rút thủ công
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDateTime(tx.transaction_date)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {tx.creator?.employee?.full_name || tx.creator?.name || 'Quản lý phòng khám'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {tx.description || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalTxPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Hiển thị {(txPage - 1) * txPerPage + 1} -{' '}
                    {Math.min(txPage * txPerPage, filteredTransactions.length)} trong tổng số{' '}
                    {filteredTransactions.length} giao dịch
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={txPage <= 1}
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs"
                    >
                      Trang trước
                    </Button>
                    <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Trang {txPage} / {totalTxPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={txPage >= totalTxPages}
                      onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                      className="h-7 text-xs"
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 2: QUẢN LÝ PHIẾU CHI (EXPENSES & APPROVAL WORKFLOW)
           ========================================================================= */}
        <TabsContent value="expenses" className="space-y-6">
          <Card className="border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Danh sách Phiếu chi Vận hành ({filteredExpenses.length} phiếu)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Lập phiếu chi tạm ứng, chi tiêu mua sắm trang thiết bị, vật tư y tế và phê duyệt thanh toán
                </CardDescription>
              </div>

              {/* Expense Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Tìm mã phiếu chi, diễn giải..."
                    value={expSearch}
                    onChange={(e) => {
                      setExpSearch(e.target.value);
                      setExpPage(1);
                    }}
                    className="h-8 w-44 pl-8 text-xs"
                  />
                </div>
                <select
                  value={expStatusFilter}
                  onChange={(e) => {
                    setExpStatusFilter(e.target.value as ExpenseApprovalStatus | '');
                    setExpPage(1);
                  }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ phê duyệt</option>
                  <option value="APPROVED">Đã phê duyệt</option>
                  <option value="REJECTED">Đã từ chối</option>
                </select>
                <select
                  value={expCategoryFilter}
                  onChange={(e) => {
                    setExpCategoryFilter(e.target.value);
                    setExpPage(1);
                  }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">Tất cả danh mục chi</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => {
                    setNewExpCatId(categories[0]?.id ? String(categories[0].id) : '');
                    setNewExpAmount('');
                    setNewExpDesc('');
                    setOpenNewExpenseDialog(true);
                  }}
                  className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Tạo phiếu chi
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Mã phiếu</TableHead>
                    <TableHead className="w-36">Danh mục</TableHead>
                    <TableHead className="w-32 text-right">Số tiền</TableHead>
                    <TableHead className="w-28">Phương thức</TableHead>
                    <TableHead className="w-28">Ngày chi</TableHead>
                    <TableHead className="w-36">Trạng thái duyệt</TableHead>
                    <TableHead className="w-40">Người đề xuất</TableHead>
                    <TableHead>Diễn giải</TableHead>
                    <TableHead className="w-32 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-36 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <FileText className="h-8 w-8 mb-2 stroke-1 opacity-50" />
                          <p className="text-sm font-medium">Không tìm thấy phiếu chi nào</p>
                          <p className="text-xs">Nhấn &quot;Tạo phiếu chi&quot; để lập đề xuất chi mới</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedExpenses.map((exp) => (
                      <TableRow key={exp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <TableCell className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                          {exp.expense_code}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {exp.category?.name || 'Chi phí chung'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-rose-600 dark:text-rose-400">
                          {formatCurrency(exp.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {exp.payment_method === 'CASH' && 'Tiền mặt'}
                            {exp.payment_method === 'BANK_TRANSFER' && 'Chuyển khoản'}
                            {exp.payment_method === 'CARD' && 'Quẹt thẻ'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(exp.expense_date)}
                        </TableCell>
                        <TableCell>
                          {exp.approval_status === 'PENDING' && (
                            <Badge variant="warning" className="gap-1 text-[11px] font-semibold">
                              <Clock className="h-3 w-3" /> Chờ duyệt
                            </Badge>
                          )}
                          {exp.approval_status === 'APPROVED' && (
                            <Badge variant="success" className="gap-1 text-[11px] font-semibold">
                              <CheckCircle2 className="h-3 w-3" /> Đã duyệt
                            </Badge>
                          )}
                          {exp.approval_status === 'REJECTED' && (
                            <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
                              <XCircle className="h-3 w-3" /> Đã từ chối
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {exp.creator?.employee?.full_name || exp.creator?.name || 'Nhân viên'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {exp.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {exp.approval_status === 'PENDING' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleApproveExpense(exp)}
                                  className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                  title="Duyệt phiếu chi"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedExpense(exp);
                                    setRejectReason('');
                                    setOpenRejectDialog(true);
                                  }}
                                  className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                                  title="Từ chối phiếu chi"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedExpense(exp);
                                setOpenExpenseDetailDialog(true);
                              }}
                              className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                              title="Xem chi tiết phiếu chi"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalExpPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Hiển thị {(expPage - 1) * expPerPage + 1} -{' '}
                    {Math.min(expPage * expPerPage, filteredExpenses.length)} trong tổng số{' '}
                    {filteredExpenses.length} phiếu chi
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={expPage <= 1}
                      onClick={() => setExpPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs"
                    >
                      Trang trước
                    </Button>
                    <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Trang {expPage} / {totalExpPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={expPage >= totalExpPages}
                      onClick={() => setExpPage((p) => Math.min(totalExpPages, p + 1))}
                      className="h-7 text-xs"
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 3: DANH MỤC CHI PHÍ (EXPENSE CATEGORIES)
           ========================================================================= */}
        <TabsContent value="categories" className="space-y-6">
          <Card className="border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" />
                  Danh mục Nhóm Chi phí ({filteredCategories.length} nhóm)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Chuẩn hóa phân loại ngân sách phục vụ đối soát tài chính và báo cáo kết quả kinh doanh
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Tìm tên nhóm chi..."
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    className="h-8 w-48 pl-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setCatName('');
                    setCatDesc('');
                    setCatStatus('ACTIVE');
                    setOpenNewCategoryDialog(true);
                  }}
                  className="h-8 gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Thêm danh mục
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="w-56">Tên nhóm chi phí</TableHead>
                    <TableHead>Mô tả chi tiết</TableHead>
                    <TableHead className="w-32 text-center">Trạng thái</TableHead>
                    <TableHead className="w-32 text-right">Số phiếu chi</TableHead>
                    <TableHead className="w-40 text-right">Tổng tiền đã chi</TableHead>
                    <TableHead className="w-24 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                        Chưa có danh mục chi phí nào
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCategories.map((cat, idx) => (
                      <TableRow key={cat.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <TableCell className="text-center text-xs text-slate-400 font-mono">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {cat.name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          {cat.description || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cat.status === 'ACTIVE' ? (
                            <Badge variant="success" className="text-[11px] font-semibold">
                              Áp dụng
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px] font-medium">
                              Tạm dừng
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {cat.expenses_count ?? 0} phiếu
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(cat.total_amount ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCategory(cat);
                              setCatName(cat.name);
                              setCatDesc(cat.description || '');
                              setCatStatus(cat.status);
                              setOpenEditCatDialog(true);
                            }}
                            className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 font-medium"
                          >
                            Sửa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =========================================================================
          MODALS / DIALOGS
         ========================================================================= */}

      {/* 1. Modal Lập Phiếu Thu / Chi Quỹ Thủ Công */}
      <Dialog open={openNewTxDialog} onOpenChange={setOpenNewTxDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
              Lập Phiếu Thu / Chi Quỹ Thủ Công
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Nhập giao dịch phát sinh trực tiếp vào sổ cái tiền tệ (nộp rút quỹ, chuyển tiền)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCashTransaction} className="space-y-4 py-2">
            {/* Loại giao dịch (IN / OUT) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Loại giao dịch
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTxType('IN')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-bold transition-all',
                    newTxType === 'IN'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                  )}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Thu vào quỹ (IN)
                </button>
                <button
                  type="button"
                  onClick={() => setNewTxType('OUT')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-bold transition-all',
                    newTxType === 'OUT'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-xs dark:bg-rose-950/60 dark:text-rose-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                  )}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  Chi ra khỏi quỹ (OUT)
                </button>
              </div>
            </div>

            {/* Số tiền */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Số tiền giao dịch (VNĐ) <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                placeholder="Ví dụ: 2000000"
                value={newTxAmount}
                onChange={(e) => setNewTxAmount(e.target.value)}
                required
                className="text-base font-bold text-slate-900 dark:text-slate-50"
              />
              {/* Quick amount presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[500000, 1000000, 2000000, 5000000, 10000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewTxAmount(String(preset))}
                    className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  >
                    +{formatCurrencyShort(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phương thức thanh toán
              </Label>
              <select
                value={newTxMethod}
                onChange={(e) => setNewTxMethod(e.target.value as PaymentMethod)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="CASH">Tiền mặt tại két (CASH)</option>
                <option value="BANK_TRANSFER">Chuyển khoản ngân hàng (BANK_TRANSFER)</option>
                <option value="CARD">Quẹt thẻ ngân hàng / POS (CARD)</option>
              </select>
            </div>

            {/* Ngày giao dịch */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Thời gian thực hiện
              </Label>
              <Input
                type="datetime-local"
                value={newTxDate}
                onChange={(e) => setNewTxDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Diễn giải */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Diễn giải nội dung thu / chi
              </Label>
              <Textarea
                placeholder="Ví dụ: Nộp quỹ đầu ngày từ Ban giám đốc, chi tiếp khách chuyên môn..."
                value={newTxDesc}
                onChange={(e) => setNewTxDesc(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenNewTxDialog(false)}
                className="text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingTx}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isSubmittingTx ? 'Đang ghi quỹ...' : 'Xác nhận ghi sổ quỹ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Modal Tạo Phiếu Chi Mới */}
      <Dialog open={openNewExpenseDialog} onOpenChange={setOpenNewExpenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <FileText className="h-5 w-5 text-blue-600" />
              Lập Phiếu Đề Xuất Chi Mới
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Phiếu sau khi tạo sẽ chuyển sang trạng thái CHỜ DUYỆT. Quản lý duyệt xong sẽ tự động ghi sổ quỹ.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateExpense} className="space-y-4 py-2">
            {/* Nhóm chi phí */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Danh mục nhóm chi phí <span className="text-rose-500">*</span>
              </Label>
              <select
                value={newExpCatId}
                onChange={(e) => setNewExpCatId(e.target.value)}
                required
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">-- Chọn nhóm chi phí --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Số tiền chi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Số tiền chi (VNĐ) <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                placeholder="Ví dụ: 3500000"
                value={newExpAmount}
                onChange={(e) => setNewExpAmount(e.target.value)}
                required
                className="text-base font-bold text-rose-600 dark:text-rose-400"
              />
            </div>

            {/* Phương thức chi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phương thức chi trả
              </Label>
              <select
                value={newExpMethod}
                onChange={(e) => setNewExpMethod(e.target.value as PaymentMethod)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="BANK_TRANSFER">Chuyển khoản ngân hàng (Ủy nhiệm chi)</option>
                <option value="CASH">Tiền mặt tại két</option>
                <option value="CARD">Thẻ ngân hàng</option>
              </select>
            </div>

            {/* Ngày chi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ngày phát sinh chi phí
              </Label>
              <Input
                type="date"
                value={newExpDate}
                onChange={(e) => setNewExpDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Diễn giải lý do chi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Lý do chi / Nội dung chi tiết
              </Label>
              <Textarea
                placeholder="Ghi rõ nội dung chi, số hóa đơn chứng từ kèm theo..."
                value={newExpDesc}
                onChange={(e) => setNewExpDesc(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenNewExpenseDialog(false)}
                className="text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingExp}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {isSubmittingExp ? 'Đang gửi...' : 'Gửi đề xuất chi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Modal Từ chối Phiếu chi */}
      <Dialog open={openRejectDialog} onOpenChange={setOpenRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle className="h-5 w-5" />
              Từ chối Phê duyệt Phiếu chi
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Phiếu {selectedExpense?.expense_code} ({formatCurrency(selectedExpense?.amount)}) sẽ chuyển sang trạng thái ĐÃ TỪ CHỐI và không xuất quỹ.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejectExpense} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Lý do từ chối <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                placeholder="Nhập lý do cụ thể (chứng từ chưa hợp lệ, vượt hạn mức ngân sách...)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenRejectDialog(false)}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingReject}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                {isSubmittingReject ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Modal Chi tiết Phiếu chi */}
      <Dialog open={openExpenseDetailDialog} onOpenChange={setOpenExpenseDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-slate-900 dark:text-slate-50 pr-6">
              <span>Chi tiết Phiếu chi {selectedExpense?.expense_code}</span>
              {selectedExpense?.approval_status === 'APPROVED' && (
                <Badge variant="success" className="text-xs">Đã duyệt</Badge>
              )}
              {selectedExpense?.approval_status === 'PENDING' && (
                <Badge variant="warning" className="text-xs">Chờ duyệt</Badge>
              )}
              {selectedExpense?.approval_status === 'REJECTED' && (
                <Badge variant="destructive" className="text-xs">Đã từ chối</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <span className="text-slate-400">Danh mục:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedExpense.category?.name || 'Chi phí chung'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Số tiền chi:</span>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {formatCurrency(selectedExpense.amount)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Phương thức:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedExpense.payment_method === 'CASH' && 'Tiền mặt tại két'}
                    {selectedExpense.payment_method === 'BANK_TRANSFER' && 'Chuyển khoản ngân hàng'}
                    {selectedExpense.payment_method === 'CARD' && 'Thẻ / POS'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Ngày phát sinh:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatDate(selectedExpense.expense_date)}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-slate-400">Nội dung / Diễn giải:</span>
                <p className="rounded-md border border-slate-200 bg-white p-2.5 font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 mt-1">
                  {selectedExpense.description || 'Không có ghi chú thêm'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-slate-400">Người đề xuất:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedExpense.creator?.employee?.full_name || selectedExpense.creator?.name || 'Nhân sự'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Người phê duyệt:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedExpense.approver?.employee?.full_name || selectedExpense.approver?.name || '-'}
                  </p>
                  {selectedExpense.approved_at && (
                    <p className="text-[11px] text-slate-400">
                      Vào lúc: {formatDateTime(selectedExpense.approved_at)}
                    </p>
                  )}
                </div>
              </div>

              {selectedExpense.approval_status === 'REJECTED' && selectedExpense.rejection_reason && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <span className="font-bold">Lý do từ chối:</span>
                  <p className="mt-0.5">{selectedExpense.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedExpense?.approval_status === 'PENDING' && (
              <Button
                size="sm"
                onClick={() => {
                  setOpenExpenseDetailDialog(false);
                  handleApproveExpense(selectedExpense);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                Duyệt phiếu chi này
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpenExpenseDetailDialog(false)}
              className="text-xs"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Modal Thêm Danh Mục Chi Phí Mới */}
      <Dialog open={openNewCategoryDialog} onOpenChange={setOpenNewCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <FolderPlus className="h-5 w-5 text-purple-600" />
              Thêm Danh Mục Nhóm Chi Phí
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tạo nhóm phân loại chi phí mới phục vụ kiểm soát ngân sách phòng khám
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tên nhóm chi phí <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="Ví dụ: Hội nghị y khoa & Đào tạo chuyên môn"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mô tả phạm vi chi
              </Label>
              <Textarea
                placeholder="Ghi chú chi tiết các loại chi phí thuộc nhóm này..."
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Trạng thái áp dụng
              </Label>
              <select
                value={catStatus}
                onChange={(e) => setCatStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ACTIVE">Đang áp dụng (ACTIVE)</option>
                <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenNewCategoryDialog(false)}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCat}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
              >
                {isSubmittingCat ? 'Đang tạo...' : 'Tạo danh mục'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Modal Cập Nhật Danh Mục Chi Phí */}
      <Dialog open={openEditCatDialog} onOpenChange={setOpenEditCatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <Layers className="h-5 w-5 text-blue-600" />
              Cập nhật Danh mục Chi phí
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateCategory} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tên nhóm chi phí <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mô tả
              </Label>
              <Textarea
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Trạng thái áp dụng
              </Label>
              <select
                value={catStatus}
                onChange={(e) => setCatStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ACTIVE">Đang áp dụng (ACTIVE)</option>
                <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenEditCatDialog(false)}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCat}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {isSubmittingCat ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
