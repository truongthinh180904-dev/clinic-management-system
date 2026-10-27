'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeftRight,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  AlertOctagon,
  Info,
  ExternalLink,
  Eye,
  HelpCircle,
  Check,
  Database,
  Users,
  Boxes,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  FileCheck,
  Stethoscope,
  DollarSign,
  Receipt,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

import {
  ImportBatchItem,
  ImportErrorItem,
  ImportModule,
  ImportBatchStatus,
  ExportType,
  ModuleTemplateInfo,
} from '@/types/data-transfer';
import {
  getImportBatches,
  getImportBatchDetail,
  uploadImportFile,
  downloadModuleTemplate,
  downloadExportCsv,
} from '@/lib/api/data-transfer';

const MODULE_TEMPLATES: ModuleTemplateInfo[] = [
  {
    module: 'patients',
    label: 'Hồ sơ Bệnh nhân',
    description: 'Danh sách hồ sơ bệnh nhân, thông tin liên hệ, tiền sử bệnh án và người giám hộ.',
    filename: 'template_patients.csv',
    sampleColumns: [
      'patient_code',
      'full_name*',
      'date_of_birth*',
      'gender*',
      'phone*',
      'email',
      'address',
      'emergency_contact_name',
      'emergency_contact_phone',
      'notes',
    ],
  },
  {
    module: 'services',
    label: 'Dịch vụ Kỹ thuật',
    description: 'Bảng giá danh mục dịch vụ khám lâm sàng, siêu âm, xét nghiệm và thủ thuật.',
    filename: 'template_services.csv',
    sampleColumns: [
      'service_code',
      'name*',
      'price*',
      'duration_minutes',
      'description',
      'status (ACTIVE/INACTIVE)',
    ],
  },
  {
    module: 'products',
    label: 'Thuốc & Vật tư Kho',
    description: 'Danh mục thuốc kê đơn, vật tư tiêu hao y tế, định mức tồn an toàn và số lượng ban đầu.',
    filename: 'template_products.csv',
    sampleColumns: [
      'product_code*',
      'name*',
      'unit*',
      'minimum_stock*',
      'initial_stock',
      'status',
    ],
  },
];

export default function DataTransferPage() {
  const { user } = useAuth();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'import' | 'history' | 'export'>('import');

  // Loading States
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingTemplate, setDownloadingTemplate] = useState<string | null>(null);
  const [downloadingExport, setDownloadingExport] = useState<string | null>(null);

  // Import Tab State
  const [selectedModule, setSelectedModule] = useState<ImportModule>('patients');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    batch?: ImportBatchItem;
  } | null>(null);

  // Batch History State
  const [batches, setBatches] = useState<ImportBatchItem[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Error Inspection Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingBatch, setInspectingBatch] = useState<ImportBatchItem | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [errorSearch, setErrorSearch] = useState('');
  const [selectedRawData, setSelectedRawData] = useState<Record<string, unknown> | null>(null);

  // Export Tab Filters State
  const [patientExportStatus, setPatientExportStatus] = useState<string>('all');
  const [patientExportGender, setPatientExportGender] = useState<string>('all');
  const [invoiceExportStatus, setInvoiceExportStatus] = useState<string>('all');
  const [invoiceDateRange, setInvoiceDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [cashbookExportType, setCashbookExportType] = useState<string>('all');
  const [cashbookMethod, setCashbookMethod] = useState<string>('all');
  const [cashbookDateRange, setCashbookDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [inventoryDateRange, setInventoryDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  // Fetch batches list
  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await getImportBatches({
        module: moduleFilter !== 'all' ? (moduleFilter as ImportModule) : undefined,
        status: statusFilter !== 'all' ? (statusFilter as ImportBatchStatus) : undefined,
      });
      if (res.success && res.data) {
        setBatches(res.data);
      }
    } catch (err) {
      console.error('Failed to load import batches:', err);
    } finally {
      setBatchesLoading(false);
    }
  }, [moduleFilter, statusFilter]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Compute Overview Stats
  const overviewStats = useMemo(() => {
    const totalBatches = batches.length;
    let totalSuccess = 0;
    let totalErrors = 0;
    let totalRows = 0;

    batches.forEach((b) => {
      totalSuccess += b.success_rows || 0;
      totalErrors += b.error_rows || 0;
      totalRows += b.total_rows || 0;
    });

    const successRate = totalRows > 0 ? Math.round((totalSuccess / totalRows) * 100) : 100;

    return {
      totalBatches,
      totalSuccess,
      totalErrors,
      totalRows,
      successRate,
    };
  }, [batches]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
        setSelectedFile(file);
        setImportNotice(null);
      } else {
        alert('Vui lòng chỉ tải lên tệp định dạng .csv');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setImportNotice(null);
    }
  };

  // Trigger Template Download
  const handleDownloadTemplate = async (module: ImportModule) => {
    try {
      setDownloadingTemplate(module);
      await downloadModuleTemplate(module);
    } catch (error) {
      alert(`Không thể tải mẫu CSV: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    } finally {
      setDownloadingTemplate(null);
    }
  };

  // Perform CSV Upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(15);
    setImportNotice(null);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 200);

    try {
      const res = await uploadImportFile(selectedModule, selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);

      const batch = res.data;
      if (batch) {
        if (batch.status === 'COMPLETED') {
          setImportNotice({
            type: 'success',
            message: `Nhập dữ liệu thành công hoàn toàn! ${batch.success_rows}/${batch.total_rows} dòng đã được đưa vào hệ thống.`,
            batch,
          });
        } else if (batch.status === 'COMPLETED_WITH_ERRORS') {
          setImportNotice({
            type: 'warning',
            message: `Hoàn tất với cảnh báo: ${batch.success_rows} dòng hợp lệ, ${batch.error_rows} dòng bị lỗi cần xử lý.`,
            batch,
          });
        } else {
          setImportNotice({
            type: 'error',
            message: `Quá trình import thất bại hoặc có lỗi nghiêm trọng.`,
            batch,
          });
        }
      }
      setSelectedFile(null);
      await loadBatches();
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setImportNotice({
        type: 'error',
        message: `Lỗi tải lên dữ liệu: ${error instanceof Error ? error.message : 'Vui lòng kiểm tra lại cấu trúc file CSV'}`,
      });
    } finally {
      setUploading(false);
    }
  };

  // Open Error Inspection Dialog
  const handleOpenInspection = async (batchItem: ImportBatchItem) => {
    setInspectModalOpen(true);
    setInspectLoading(true);
    setErrorSearch('');
    setSelectedRawData(null);

    try {
      if (batchItem.errors && batchItem.errors.length > 0) {
        setInspectingBatch(batchItem);
      } else {
        const res = await getImportBatchDetail(batchItem.id);
        if (res.success && res.data) {
          setInspectingBatch(res.data);
        } else {
          setInspectingBatch(batchItem);
        }
      }
    } catch (err) {
      console.error('Failed to load batch inspection details:', err);
      setInspectingBatch(batchItem);
    } finally {
      setInspectLoading(false);
    }
  };

  // Filtered Errors in Inspection Dialog
  const filteredErrors = useMemo(() => {
    if (!inspectingBatch?.errors) return [];
    if (!errorSearch.trim()) return inspectingBatch.errors;
    const term = errorSearch.toLowerCase().trim();
    return inspectingBatch.errors.filter(
      (err) =>
        String(err.row_number).includes(term) ||
        (err.column_name && err.column_name.toLowerCase().includes(term)) ||
        err.error_message.toLowerCase().includes(term)
    );
  }, [inspectingBatch, errorSearch]);

  // Export CSV Handler
  const handleExport = async (type: ExportType) => {
    try {
      setDownloadingExport(type);
      if (type === 'patients') {
        await downloadExportCsv('patients', {
          status: patientExportStatus !== 'all' ? patientExportStatus : undefined,
          gender: patientExportGender !== 'all' ? patientExportGender : undefined,
        });
      } else if (type === 'invoices') {
        await downloadExportCsv('invoices', {
          status: invoiceExportStatus !== 'all' ? invoiceExportStatus : undefined,
          start_date: invoiceDateRange.start_date,
          end_date: invoiceDateRange.end_date,
        });
      } else if (type === 'cashbook') {
        await downloadExportCsv('cashbook', {
          transaction_type: cashbookExportType !== 'all' ? cashbookExportType : undefined,
          payment_method: cashbookMethod !== 'all' ? cashbookMethod : undefined,
          start_date: cashbookDateRange.start_date,
          end_date: cashbookDateRange.end_date,
        });
      } else if (type === 'inventory') {
        await downloadExportCsv('inventory', {
          start_date: inventoryDateRange.start_date,
          end_date: inventoryDateRange.end_date,
        });
      }
    } catch (error) {
      alert(`Xuất dữ liệu thất bại: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    } finally {
      setDownloadingExport(null);
    }
  };

  // Export Error rows as local CSV
  const handleExportErrorsCsv = () => {
    if (!inspectingBatch?.errors || inspectingBatch.errors.length === 0) return;
    const bom = '\uFEFF';
    let csv = bom + 'batch_id,row_number,column_name,error_message,raw_data\n';
    inspectingBatch.errors.forEach((e) => {
      const raw = e.raw_data ? JSON.stringify(e.raw_data).replace(/"/g, '""') : '';
      csv += `${e.batch_id},${e.row_number},"${e.column_name || ''}","${e.error_message.replace(/"/g, '""')}","${raw}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `errors_batch_${inspectingBatch.id}_${inspectingBatch.module}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  };

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.file_name.toLowerCase().includes(q);
        const matchModule = b.module.toLowerCase().includes(q);
        const matchUser = b.importer?.username?.toLowerCase().includes(q) || false;
        if (!matchName && !matchModule && !matchUser) return false;
      }
      return true;
    });
  }, [batches, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Trung tâm Import / Export Dữ liệu"
        description="Nhập dữ liệu danh mục bệnh nhân, dịch vụ, kho thuốc vật tư qua tệp CSV và xuất báo cáo dữ liệu định dạng chuẩn UTF-8 BOM Excel."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadBatches}
            disabled={batchesLoading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', batchesLoading && 'animate-spin')} />
            Làm mới
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setActiveTab('import')}
            className="h-9 gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-3.5 w-3.5" />
            Nhập CSV mới
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveTab('export')}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            Khu vực Xuất file
          </Button>
        </div>
      </PageHeader>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng đợt Import"
          value={overviewStats.totalBatches}
          description="Tất cả các module đã tải lên"
          icon={ArrowLeftRight}
          badge={<Badge variant="info" className="text-[10px]">Lưu vết tự động</Badge>}
        />
        <StatCard
          title="Tỷ lệ Thành công"
          value={`${overviewStats.successRate}%`}
          description={`${overviewStats.totalSuccess} / ${overviewStats.totalRows} dòng hợp lệ`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Dòng Dữ liệu Đã Nhập"
          value={overviewStats.totalSuccess.toLocaleString('vi-VN')}
          description="Bệnh nhân, Dịch vụ & Vật tư"
          icon={FileCheck}
          variant="default"
        />
        <StatCard
          title="Số Dòng Cần Soát Lỗi"
          value={overviewStats.totalErrors.toLocaleString('vi-VN')}
          description="Được ghi vào import_errors"
          icon={AlertTriangle}
          variant={overviewStats.totalErrors > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'import' | 'history' | 'export')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-xl bg-slate-100 p-1 rounded-xl dark:bg-slate-800">
          <TabsTrigger
            value="import"
            className="gap-2 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400"
          >
            <Upload className="h-4 w-4" />
            Nhập Dữ Liệu (Import CSV)
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-2 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400"
          >
            <Clock className="h-4 w-4" />
            Lịch Sử & Bảng Soát Lỗi
            {overviewStats.totalErrors > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {overviewStats.totalErrors}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="export"
            className="gap-2 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400"
          >
            <Download className="h-4 w-4" />
            Xuất Báo Cáo (Export CSV)
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: IMPORT CSV */}
        {/* ========================================================================= */}
        <TabsContent value="import" className="mt-6 space-y-6">
          {/* Notification Banner */}
          {importNotice && (
            <div
              className={cn(
                'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border',
                importNotice.type === 'success' &&
                  'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300',
                importNotice.type === 'warning' &&
                  'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300',
                importNotice.type === 'error' &&
                  'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300'
              )}
            >
              <div className="flex items-center gap-3">
                {importNotice.type === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {importNotice.type === 'warning' && (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                {importNotice.type === 'error' && (
                  <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">{importNotice.message}</p>
                  {importNotice.batch && (
                    <p className="text-xs opacity-90 mt-0.5">
                      Mã đợt #{importNotice.batch.id} • Tệp: {importNotice.batch.file_name} •{' '}
                      {formatDateTime(importNotice.batch.created_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {importNotice.batch && importNotice.batch.error_rows > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleOpenInspection(importNotice.batch!)}
                    className="gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mở Bảng Soát Lỗi Chi Tiết ({importNotice.batch.error_rows})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-medium"
                >
                  Xem danh sách lịch sử
                </Button>
                <button
                  type="button"
                  onClick={() => setImportNotice(null)}
                  className="p-1 hover:opacity-75 rounded-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Module Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                  Bước 1: Chọn Phân hệ Dữ liệu & Tải Mẫu CSV Chuẩn
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chọn đúng loại dữ liệu cần import. Tải file mẫu có sẵn header chuẩn để tránh phát sinh lỗi cột.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODULE_TEMPLATES.map((tmpl) => {
                const isSelected = selectedModule === tmpl.module;
                return (
                  <div
                    key={tmpl.module}
                    onClick={() => setSelectedModule(tmpl.module)}
                    className={cn(
                      'relative cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md',
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {tmpl.module === 'patients' && <Users className="h-5 w-5" />}
                          {tmpl.module === 'services' && <Stethoscope className="h-5 w-5" />}
                          {tmpl.module === 'products' && <Boxes className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {tmpl.label}
                          </h4>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            module: {tmpl.module}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {tmpl.description}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        {tmpl.sampleColumns.length} cột trường dữ liệu
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={downloadingTemplate === tmpl.module}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadTemplate(tmpl.module);
                        }}
                        className="h-7 px-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-100/60 dark:text-blue-400"
                      >
                        <Download
                          className={cn(
                            'mr-1.5 h-3.5 w-3.5',
                            downloadingTemplate === tmpl.module && 'animate-bounce'
                          )}
                        />
                        {downloadingTemplate === tmpl.module ? 'Đang tải...' : 'Tải File Mẫu'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload CSV Zone */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                Bước 2: Tải lên Tệp CSV ({selectedModule === 'patients' ? 'Bệnh nhân' : selectedModule === 'services' ? 'Dịch vụ' : 'Thuốc/Vật tư'})
              </CardTitle>
              <CardDescription className="text-xs">
                Kéo thả file .csv hoặc chọn từ máy tính của bạn. Hệ thống tự động kiểm tra định dạng và ghi nhận từng dòng lỗi nếu có.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                  dragActive
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/20'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : 'Kéo thả tệp CSV vào đây hoặc bấm để chọn'}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB • Sẵn sàng import vào phân hệ ${selectedModule}`
                    : 'Chỉ chấp nhận file định dạng .csv (tối đa 10MB / 10,000 dòng)'}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <label htmlFor="csv-file-upload">
                    <span className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {selectedFile ? 'Chọn tệp khác' : 'Duyệt tệp từ thiết bị'}
                    </span>
                    <input
                      id="csv-file-upload"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {selectedFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      className="h-8 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                    >
                      Hủy bỏ
                    </Button>
                  )}
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                  <div className="flex justify-between text-xs font-semibold text-blue-900 dark:text-blue-300">
                    <span>Đang tải lên và phân tích dòng dữ liệu CSV...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Columns Header Guide */}
              <div className="rounded-lg bg-slate-100/70 p-3.5 dark:bg-slate-850">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Quy cách định dạng cột cho module{' '}
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {selectedModule}
                  </span>
                  :
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MODULE_TEMPLATES.find((t) => t.module === selectedModule)?.sampleColumns.map(
                    (col) => {
                      const isRequired = col.includes('*');
                      return (
                        <span
                          key={col}
                          className={cn(
                            'inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px]',
                            isRequired
                              ? 'bg-rose-100 text-rose-800 font-bold dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-white text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          )}
                        >
                          {col}
                        </span>
                      );
                    }
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-rose-600 dark:text-rose-400">(*)</span> là cột bắt buộc. Dòng nào thiếu trường bắt buộc hoặc sai định dạng số/ngày sẽ được tự động ghi vào bảng soát lỗi `import_errors` để bạn kiểm tra lại mà không làm gián đoạn toàn bộ quá trình.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => setSelectedFile(null)}
              >
                Đặt lại
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!selectedFile || uploading}
                onClick={handleUpload}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Đang Import...' : 'Bắt đầu Import Dữ liệu'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: IMPORT HISTORY & ERROR INSPECTION TABLE */}
        {/* ========================================================================= */}
        <TabsContent value="history" className="mt-6 space-y-4">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Lịch Sử Đợt Import & Bảng Soát Lỗi Dữ Liệu
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Theo dõi trạng thái các đợt nhập dữ liệu, tỷ lệ thành công và kiểm tra chi tiết từng dòng lỗi trong bảng `import_errors`.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadBatches}
                    disabled={batchesLoading}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', batchesLoading && 'animate-spin')} />
                    Cập nhật
                  </Button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Tìm tên tệp, phân hệ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 text-xs"
                  />
                </div>

                <div>
                  <select
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="all">Tất cả phân hệ (Module)</option>
                    <option value="patients">Hồ sơ Bệnh nhân (patients)</option>
                    <option value="services">Dịch vụ Kỹ thuật (services)</option>
                    <option value="products">Kho Thuốc & Vật tư (products)</option>
                  </select>
                </div>

                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="COMPLETED">Thành công 100% (COMPLETED)</option>
                    <option value="COMPLETED_WITH_ERRORS">Có dòng lỗi (COMPLETED_WITH_ERRORS)</option>
                    <option value="PROCESSING">Đang xử lý (PROCESSING)</option>
                    <option value="FAILED">Thất bại (FAILED)</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Tên tệp CSV</TableHead>
                    <TableHead>Phân hệ</TableHead>
                    <TableHead>Người nhập & Thời gian</TableHead>
                    <TableHead className="text-center">Tổng dòng</TableHead>
                    <TableHead className="text-center">Thành công</TableHead>
                    <TableHead className="text-center">Dòng lỗi</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchesLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="text-xs">Đang tải lịch sử import...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredBatches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                        <FileText className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-xs font-medium">Chưa có lịch sử import nào phù hợp.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBatches.map((b) => (
                      <TableRow key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <TableCell className="font-mono text-xs font-semibold text-slate-500">
                          #{b.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-medium text-xs text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={b.file_name}>
                              {b.file_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              b.module === 'patients'
                                ? 'info'
                                : b.module === 'services'
                                ? 'default'
                                : 'secondary'
                            }
                            className="font-medium text-[11px]"
                          >
                            {b.module === 'patients' && 'Bệnh nhân'}
                            {b.module === 'services' && 'Dịch vụ'}
                            {b.module === 'products' && 'Thuốc/Vật tư'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            {formatDateTime(b.created_at)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            bởi {b.importer?.username || 'Hệ thống'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-medium">
                          {b.total_rows}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {b.success_rows}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {b.error_rows > 0 ? (
                            <span className="inline-flex items-center font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                              {b.error_rows}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {b.status === 'COMPLETED' && (
                            <Badge variant="success" className="gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              Thành công 100%
                            </Badge>
                          )}
                          {b.status === 'COMPLETED_WITH_ERRORS' && (
                            <Badge variant="warning" className="gap-1 text-[11px]">
                              <AlertTriangle className="h-3 w-3" />
                              Có {b.error_rows} dòng lỗi
                            </Badge>
                          )}
                          {b.status === 'PROCESSING' && (
                            <Badge variant="info" className="gap-1 text-[11px]">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Đang xử lý
                            </Badge>
                          )}
                          {b.status === 'FAILED' && (
                            <Badge variant="destructive" className="gap-1 text-[11px]">
                              <XCircle className="h-3 w-3" />
                              Thất bại
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {b.error_rows > 0 ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleOpenInspection(b)}
                              className="h-7 px-2.5 text-xs font-semibold gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Soát {b.error_rows} lỗi
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenInspection(b)}
                              className="h-7 px-2.5 text-xs text-slate-600 hover:text-blue-600"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Chi tiết
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: EXPORT CENTER */}
        {/* ========================================================================= */}
        <TabsContent value="export" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Export Bệnh nhân */}
            <Card className="border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Danh Sách Bệnh Nhân</CardTitle>
                      <CardDescription className="text-xs">
                        Xuất toàn bộ danh bạ bệnh nhân, thông tin liên hệ và tiền sử
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    UTF-8 BOM (.CSV)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Trạng thái hồ sơ</Label>
                    <select
                      value={patientExportStatus}
                      onChange={(e) => setPatientExportStatus(e.target.value)}
                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                      <option value="INACTIVE">Ngưng theo dõi (INACTIVE)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Giới tính</Label>
                    <select
                      value={patientExportGender}
                      onChange={(e) => setPatientExportGender(e.target.value)}
                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">Tất cả giới tính</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button
                  variant="default"
                  size="sm"
                  disabled={downloadingExport === 'patients'}
                  onClick={() => handleExport('patients')}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  <Download className={cn('h-4 w-4', downloadingExport === 'patients' && 'animate-bounce')} />
                  {downloadingExport === 'patients' ? 'Đang tạo file...' : 'Xuất CSV Danh Sách Bệnh Nhân'}
                </Button>
              </CardFooter>
            </Card>

            {/* 2. Export Hóa đơn & Doanh thu */}
            <Card className="border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Hóa Đơn & Công Nợ</CardTitle>
                      <CardDescription className="text-xs">
                        Xuất số liệu hóa đơn, đã thu, còn nợ và chiết khấu
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    UTF-8 BOM (.CSV)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={invoiceDateRange.start_date}
                      onChange={(e) =>
                        setInvoiceDateRange((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={invoiceDateRange.end_date}
                      onChange={(e) =>
                        setInvoiceDateRange((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Trạng thái thanh toán</Label>
                  <select
                    value={invoiceExportStatus}
                    onChange={(e) => setInvoiceExportStatus(e.target.value)}
                    className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="PAID">Đã thanh toán đủ (PAID)</option>
                    <option value="PARTIAL">Còn nợ 1 phần (PARTIAL)</option>
                    <option value="UNPAID">Chưa thanh toán (UNPAID)</option>
                    <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button
                  variant="default"
                  size="sm"
                  disabled={downloadingExport === 'invoices'}
                  onClick={() => handleExport('invoices')}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <Download className={cn('h-4 w-4', downloadingExport === 'invoices' && 'animate-bounce')} />
                  {downloadingExport === 'invoices' ? 'Đang xuất hóa đơn...' : 'Xuất CSV Báo Cáo Hóa Đơn'}
                </Button>
              </CardFooter>
            </Card>

            {/* 3. Export Sổ quỹ Thu Chi */}
            <Card className="border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Sổ Quỹ Thu - Chi</CardTitle>
                      <CardDescription className="text-xs">
                        Xuất toàn bộ giao dịch dòng tiền mặt, chuyển khoản và quẹt thẻ
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    UTF-8 BOM (.CSV)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={cashbookDateRange.start_date}
                      onChange={(e) =>
                        setCashbookDateRange((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={cashbookDateRange.end_date}
                      onChange={(e) =>
                        setCashbookDateRange((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Loại giao dịch</Label>
                    <select
                      value={cashbookExportType}
                      onChange={(e) => setCashbookExportType(e.target.value)}
                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">Tất cả thu & chi</option>
                      <option value="IN">Phiếu Thu (IN)</option>
                      <option value="OUT">Phiếu Chi (OUT)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Phương thức</Label>
                    <select
                      value={cashbookMethod}
                      onChange={(e) => setCashbookMethod(e.target.value)}
                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">Tất cả phương thức</option>
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK_TRANSFER">Chuyển khoản</option>
                      <option value="CARD">Thẻ POS</option>
                    </select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button
                  variant="default"
                  size="sm"
                  disabled={downloadingExport === 'cashbook'}
                  onClick={() => handleExport('cashbook')}
                  className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium"
                >
                  <Download className={cn('h-4 w-4', downloadingExport === 'cashbook' && 'animate-bounce')} />
                  {downloadingExport === 'cashbook' ? 'Đang trích xuất...' : 'Xuất CSV Báo Cáo Sổ Quỹ'}
                </Button>
              </CardFooter>
            </Card>

            {/* 4. Export Báo cáo Tồn kho */}
            <Card className="border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Tồn Kho & Nhập Xuất</CardTitle>
                      <CardDescription className="text-xs">
                        Báo cáo Nhập - Xuất - Tồn đầu kỳ và cuối kỳ của thuốc, vật tư y tế
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    UTF-8 BOM (.CSV)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Kỳ bắt đầu</Label>
                    <Input
                      type="date"
                      value={inventoryDateRange.start_date}
                      onChange={(e) =>
                        setInventoryDateRange((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kỳ kết thúc</Label>
                    <Input
                      type="date"
                      value={inventoryDateRange.end_date}
                      onChange={(e) =>
                        setInventoryDateRange((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 dark:bg-slate-900">
                  File CSV xuất ra chứa đầy đủ: Mã SP, Tên sản phẩm, Đơn vị, Tồn đầu, Tổng nhập, Tổng xuất, Tồn cuối, Định mức tối thiểu và Trạng thái cảnh báo.
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button
                  variant="default"
                  size="sm"
                  disabled={downloadingExport === 'inventory'}
                  onClick={() => handleExport('inventory')}
                  className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  <Download className={cn('h-4 w-4', downloadingExport === 'inventory' && 'animate-bounce')} />
                  {downloadingExport === 'inventory' ? 'Đang trích xuất...' : 'Xuất CSV Báo Cáo Tồn Kho'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* SHADCN/UI ERROR INSPECTION TABLE DIALOG MODAL */}
      {/* ========================================================================= */}
      <Dialog open={inspectModalOpen} onOpenChange={setInspectModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          {/* Modal Header */}
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                  <AlertOctagon className="h-5 w-5 text-amber-500" />
                  Bảng Soát Lỗi Dữ Liệu Import (Error Inspection Table)
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  {inspectingBatch ? (
                    <span>
                      Đợt #{inspectingBatch.id} • Tệp: <strong>{inspectingBatch.file_name}</strong> •{' '}
                      Phân hệ: <span className="font-mono text-blue-600 dark:text-blue-400">{inspectingBatch.module}</span>
                    </span>
                  ) : (
                    'Chi tiết từng dòng lỗi được lưu vết trong cơ sở dữ liệu'
                  )}
                </DialogDescription>
              </div>

              {inspectingBatch && inspectingBatch.error_rows > 0 && (
                <Badge variant="destructive" className="font-semibold text-xs">
                  {inspectingBatch.error_rows} dòng lỗi cần xử lý
                </Badge>
              )}
            </div>

            {/* Quick Batch Summary Banner */}
            {inspectingBatch && (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400">Tổng số dòng:</span>{' '}
                  <strong className="text-slate-700 dark:text-slate-300 font-mono">
                    {inspectingBatch.total_rows}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Hợp lệ thành công:</span>{' '}
                  <strong className="text-emerald-600 font-mono">
                    {inspectingBatch.success_rows}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Dòng phát sinh lỗi:</span>{' '}
                  <strong className="text-rose-600 font-mono">
                    {inspectingBatch.error_rows}
                  </strong>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Modal Body: Search & Table */}
          <div className="p-6 pt-3 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Lọc theo dòng, cột lỗi hoặc lý do..."
                  value={errorSearch}
                  onChange={(e) => setErrorSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {inspectingBatch && inspectingBatch.errors && inspectingBatch.errors.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportErrorsCsv}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-slate-600" />
                  Xuất danh sách lỗi CSV
                </Button>
              )}
            </div>

            {/* Table Area */}
            <div className="rounded-lg border border-slate-200 overflow-hidden dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="w-20 font-bold">Vị trí</TableHead>
                    <TableHead className="w-32 font-bold">Cột dữ liệu</TableHead>
                    <TableHead className="font-bold">Chi tiết lỗi phát hiện</TableHead>
                    <TableHead className="w-48 font-bold">Dữ liệu thô gửi lên</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspectLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                        <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-xs mt-2 block">Đang tải danh sách lỗi...</span>
                      </TableCell>
                    </TableRow>
                  ) : filteredErrors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {inspectingBatch?.error_rows === 0
                            ? 'Tuyệt vời! Đợt import này không có lỗi nào.'
                            : 'Không tìm thấy dòng lỗi phù hợp với từ khóa lọc.'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredErrors.map((err) => (
                      <TableRow key={err.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                        <TableCell>
                          <Badge variant="destructive" className="font-mono text-[11px] font-bold">
                            Dòng #{err.row_number}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {err.column_name ? (
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              {err.column_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Toàn bộ dòng</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1.5 text-xs text-rose-700 font-medium dark:text-rose-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                            <span>{err.error_message}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {err.raw_data ? (
                            <div className="max-w-[200px]">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setSelectedRawData(
                                    typeof err.raw_data === 'object'
                                      ? (err.raw_data as Record<string, unknown>)
                                      : { value: String(err.raw_data) }
                                  )
                                }
                                className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-mono"
                              >
                                Xem dữ liệu dòng ({Object.keys(err.raw_data).length} cột)
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Raw Data Preview Popup if selected */}
            {selectedRawData && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Dữ liệu thô của dòng:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedRawData(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <pre className="mt-2 max-h-36 overflow-auto font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {JSON.stringify(selectedRawData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInspectModalOpen(false)}
              className="text-xs"
            >
              Đóng bảng soát lỗi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
