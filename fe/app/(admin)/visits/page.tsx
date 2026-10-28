'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils';
import {
  cancelVisit,
  createVisit,
  getVisits,
  updateVisitStatus,
} from '@/lib/api/visits';
import { getEmployees } from '@/lib/api/employees';
import { getPatients, createPatient, checkDuplicatePatients } from '@/lib/api/patients';
import { getServices } from '@/lib/api/services';
import { Service } from '@/types/service';
import { Patient, DuplicateWarning } from '@/types/patient';
import {
  PAYMENT_STATUS_MAP,
  VISIT_STATUS_MAP,
  Visit,
  VisitPaymentStatus,
  VisitStatus,
} from '@/types/visit';
import { PaginationMeta } from '@/types/auth';
import { Employee } from '@/types/employee';
import { toast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { FormField, FormSubmitButton } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { EmptySearchState, EmptyDataState, ErrorState } from '@/components/ui/empty-state';
import {
  Stethoscope,
  Activity,
  CheckCircle2,
  XCircle,
  Search,
  X,
  Zap,
  UserCheck,
  UserPlus,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { PatientFileManager } from '@/components/patient-files';


function VisitsListContent() {
  const searchParams = useSearchParams();
  const fastCheckInParam = searchParams.get('fastCheckIn');
  const { hasPermission, hasRole } = useAuth();

  const canCreate =
    hasPermission('visits.create') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST') ||
    hasRole('DOCTOR');
  const canUpdate =
    hasPermission('visits.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('DOCTOR') ||
    hasRole('RECEPTIONIST');
  const canCancel =
    hasPermission('visits.cancel') ||
    hasPermission('visits.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST');
  const canMedical =
    hasPermission('medical_records.view') ||
    hasPermission('medical_records.create') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR');
  const canViewFiles =
    hasPermission('patient_files.view') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('DOCTOR') ||
    hasRole('NURSE') ||
    hasRole('RECEPTIONIST');
  const canUploadFiles =
    hasPermission('patient_files.upload') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('DOCTOR') ||
    hasRole('NURSE') ||
    hasRole('RECEPTIONIST');
  const canDeleteFiles =
    hasPermission('patient_files.delete') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('DOCTOR');

  // List & pagination
  const [visits, setVisits] = useState<Visit[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<number | ''>('');
  const [patientFilter, setPatientFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<VisitStatus | ''>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    VisitPaymentStatus | ''
  >('');

  // Dropdown references
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Fast Reception Check-in States
  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);
  const [receptionMode, setReceptionMode] = useState<'existing' | 'new'>('existing');

  // Existing patient search in check-in
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [matchedPatients, setMatchedPatients] = useState<Patient[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New patient registration in check-in
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newGender, setNewGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Duplicate warnings
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateOverride, setDuplicateOverride] = useState(false);

  // Check-in department & doctor selection
  const [checkInServiceId, setCheckInServiceId] = useState<number | ''>('');
  const [checkInDoctorId, setCheckInDoctorId] = useState<number | ''>('');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Action Modals
  const [statusModalVisit, setStatusModalVisit] = useState<Visit | null>(null);
  const [targetStatus, setTargetStatus] = useState<VisitStatus>('IN_PROGRESS');
  const [statusNote, setStatusNote] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const [cancelModalVisit, setCancelModalVisit] = useState<Visit | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // File Manager Modal
  const [selectedFileVisit, setSelectedFileVisit] = useState<Visit | null>(null);


  // Auto open fast check-in if query param present
  useEffect(() => {
    if (fastCheckInParam === 'true') {
      setIsReceptionModalOpen(true);
    }
  }, [fastCheckInParam]);

  // Load Reference Data (Employees & Services)
  useEffect(() => {
    async function loadRefs() {
      try {
        const [empRes, srvRes] = await Promise.all([
          getEmployees({ per_page: 100 }),
          getServices({ per_page: 100, status: 'ACTIVE' }),
        ]);
        setEmployees(empRes.data || []);
        const activeServices = srvRes.data || [];
        setServices(activeServices);
        if (activeServices.length > 0) {
          setCheckInServiceId(activeServices[0].id);
        }
      } catch (err) {
        console.error('Failed to load references', err);
      }
    }
    loadRefs();
  }, []);

  // Debounced patient search for existing mode
  useEffect(() => {
    if (receptionMode !== 'existing' || !patientSearchTerm.trim() || patientSearchTerm.trim().length < 2) {
      setMatchedPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const res = await getPatients({ search: patientSearchTerm.trim(), per_page: 5 });
        setMatchedPatients(res.data || []);
      } catch (err) {
        console.error('Error searching patients', err);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearchTerm, receptionMode]);

  // Debounced duplicate detection for new patient mode
  useEffect(() => {
    if (receptionMode !== 'new') {
      setDuplicateWarnings([]);
      return;
    }
    const phoneClean = newPhone.trim();
    const nameClean = newFullName.trim();
    if (phoneClean.length < 9 && (!nameClean || !newDob)) {
      setDuplicateWarnings([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const res = await checkDuplicatePatients({
          phone: phoneClean || undefined,
          full_name: nameClean || undefined,
          date_of_birth: newDob || undefined,
        });
        if (res.data?.has_duplicates && res.data.duplicate_warnings) {
          setDuplicateWarnings(res.data.duplicate_warnings);
        } else {
          setDuplicateWarnings([]);
        }
      } catch (err) {
        console.error('Error checking duplicate patients', err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [newPhone, newFullName, newDob, receptionMode]);

  // Load Visits
  const loadVisits = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await getVisits({
        page: currentPage,
        per_page: perPage,
        search: searchTerm || undefined,
        visit_date: dateFilter || undefined,
        employee_id: employeeFilter || undefined,
        patient_id: patientFilter || undefined,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        sort_by: 'visit_date',
        order: 'desc',
      });
      setVisits(res.data || []);
      if (res.meta) {
        setPagination(res.meta);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setPageError(err.message);
      } else {
        setPageError('Không thể tải danh sách lượt khám.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    perPage,
    searchTerm,
    dateFilter,
    employeeFilter,
    patientFilter,
    statusFilter,
    paymentStatusFilter,
  ]);

  // Handle Quick Status Change
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalVisit) return;
    setIsSubmittingStatus(true);
    try {
      await updateVisitStatus(
        statusModalVisit.id,
        targetStatus,
        statusNote || undefined
      );
      const msg = `Đã cập nhật trạng thái lượt khám #${statusModalVisit.visit_code} sang ${VISIT_STATUS_MAP[targetStatus]?.label || targetStatus}`;
      setActionSuccess(msg);
      toast.success(msg, 'Cập nhật trạng thái');
      setStatusModalVisit(null);
      setStatusNote('');
      loadVisits();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Cập nhật trạng thái thất bại.';
      toast.error(msg, 'Lỗi cập nhật');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Handle Cancel Visit
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalVisit) return;
    setIsSubmittingCancel(true);
    try {
      await cancelVisit(cancelModalVisit.id, cancelReason || undefined);
      const msg = `Đã hủy lượt khám #${cancelModalVisit.visit_code} thành công.`;
      setActionSuccess(msg);
      toast.success(msg, 'Hủy lượt khám');
      setCancelModalVisit(null);
      setCancelReason('');
      loadVisits();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Hủy lượt khám thất bại.';
      toast.error(msg, 'Lỗi hủy lượt khám');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Format currency
  const formatMoney = (val?: number | null) => {
    if (val === null || val === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val);
  };

  // Calculate Today's Queue Number
  const todayQueueNumber = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const countToday = visits.filter((v) => v.visit_date?.startsWith(today)).length;
    return countToday + 1;
  }, [visits]);

  // Reset Fast Check-in Form
  const resetReceptionForm = () => {
    setReceptionMode('existing');
    setPatientSearchTerm('');
    setMatchedPatients([]);
    setSelectedPatient(null);
    setNewFullName('');
    setNewPhone('');
    setNewDob('');
    setNewGender('MALE');
    setNewAddress('');
    setNewNotes('');
    setDuplicateWarnings([]);
    setDuplicateOverride(false);
    if (services.length > 0) {
      setCheckInServiceId(services[0].id);
    }
    if (employees.length > 0) {
      setCheckInDoctorId(employees[0].id);
    }
    setCheckInNotes('');
    setCheckInError(null);
  };

  // Submit Fast Check-in
  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckInError(null);

    if (!checkInServiceId) {
      setCheckInError('Vui lòng chọn dịch vụ / chuyên khoa khám.');
      return;
    }
    if (!checkInDoctorId) {
      setCheckInError('Vui lòng chọn bác sĩ phụ trách tiếp nhận.');
      return;
    }

    let targetPatientId: number;

    setIsSubmittingCheckIn(true);
    try {
      if (receptionMode === 'existing') {
        if (!selectedPatient) {
          setCheckInError('Vui lòng tìm và chọn một bệnh nhân đã có hồ sơ trong hệ thống.');
          setIsSubmittingCheckIn(false);
          return;
        }
        targetPatientId = selectedPatient.id;
      } else {
        // Validate new patient fields
        if (!newFullName.trim()) {
          setCheckInError('Vui lòng nhập họ và tên bệnh nhân.');
          setIsSubmittingCheckIn(false);
          return;
        }
        if (!newPhone.trim()) {
          setCheckInError('Vui lòng nhập số điện thoại bệnh nhân.');
          setIsSubmittingCheckIn(false);
          return;
        }
        if (duplicateWarnings.length > 0 && !duplicateOverride) {
          setCheckInError(
            'Hệ thống phát hiện hồ sơ có thể bị trùng lặp. Vui lòng kiểm tra lại danh sách trùng lặp bên dưới hoặc đánh dấu xác nhận để tiếp tục.'
          );
          setIsSubmittingCheckIn(false);
          return;
        }

        // Create new patient record
        const newPatientRes = await createPatient({
          full_name: newFullName.trim(),
          phone: newPhone.trim(),
          date_of_birth: newDob || undefined,
          gender: newGender,
          address: newAddress.trim() || undefined,
          notes: newNotes.trim() || undefined,
          status: 'ACTIVE',
        });
        targetPatientId = newPatientRes.data.id;
      }

      // Format Queue string and initial clinical notes
      const queuePrefix = `[Tiếp đón lễ tân - STT: #${String(todayQueueNumber).padStart(2, '0')}]`;
      const fullNotes = checkInNotes.trim()
        ? `${queuePrefix} ${checkInNotes.trim()}`
        : queuePrefix;

      const selectedService = services.find((s) => s.id === Number(checkInServiceId));
      const unitPrice = selectedService ? Number(selectedService.price) : 0;

      // 1-Click Check-in creating Visit with status SCHEDULED (waiting in queue)
      const visitRes = await createVisit({
        patient_id: targetPatientId,
        employee_id: Number(checkInDoctorId),
        service_id: Number(checkInServiceId),
        visit_date: new Date().toISOString(),
        quantity: 1,
        unit_price: unitPrice,
        discount_amount: 0,
        status: 'SCHEDULED',
        notes: fullNotes,
      });

      const patientName =
        receptionMode === 'existing'
          ? selectedPatient?.full_name
          : newFullName.trim();
      const successMsg = `Đã tiếp đón thành công bệnh nhân ${patientName}! Lượt khám #${visitRes.data?.visit_code || ''} (STT: #${String(todayQueueNumber).padStart(2, '0')}) với trạng thái Chờ khám.`;

      toast.success(successMsg, 'Tiếp đón thành công');
      setActionSuccess(successMsg);
      setIsReceptionModalOpen(false);
      resetReceptionForm();
      loadVisits();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Tiếp đón thất bại. Vui lòng kiểm tra lại thông tin.';
      setCheckInError(msg);
      toast.error(msg, 'Lỗi tiếp đón');
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  // Block 3: Summary Statistics
  const summaryStats = useMemo(() => {
    const total = pagination?.total ?? visits.length;
    const inProgress = visits.filter((v) => v.status === 'IN_PROGRESS').length;
    const completed = visits.filter((v) => v.status === 'COMPLETED').length;
    const cancelled = visits.filter((v) => v.status === 'CANCELLED').length;
    return [
      {
        title: 'Tổng lượt khám',
        value: total,
        icon: Stethoscope,
        variant: 'primary' as const,
        description: 'Tổng lượt khám ghi nhận',
      },
      {
        title: 'Đang thực hiện',
        value: inProgress,
        icon: Activity,
        variant: 'warning' as const,
        description: 'Đang được bác sĩ thăm khám',
      },
      {
        title: 'Đã hoàn thành',
        value: completed,
        icon: CheckCircle2,
        variant: 'success' as const,
        description: 'Đã kết thúc lượt khám',
      },
      {
        title: 'Đã hủy',
        value: cancelled,
        icon: XCircle,
        variant: 'destructive' as const,
        description: 'Lượt khám bị hủy bỏ',
      },
    ];
  }, [pagination?.total, visits]);

  const hasActiveFilters = Boolean(
    searchTerm || dateFilter || employeeFilter || patientFilter || statusFilter || paymentStatusFilter
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setEmployeeFilter('');
    setPatientFilter('');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Block 1 & 2: Top Header & Actions */}
      <PageHeader
        title="Quản lý Lượt khám & Bệnh án"
        description="Theo dõi danh sách tiếp nhận, khám chữa bệnh, sử dụng gói và lập hồ sơ bệnh án"
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetReceptionForm();
                  setIsReceptionModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                <Zap className="h-4 w-4" />
                <span>Tiếp đón nhanh tại quầy</span>
              </button>
              <Link
                href="/visits/new"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                <span>➕</span>
                <span>Tạo lượt khám</span>
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* Block 3: Khối tóm tắt thống kê quan trọng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Error Notification */}
      {pageError && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{pageError}</span>
          </div>
          <button
            onClick={() => setPageError(null)}
            className="text-rose-600 dark:text-rose-400 hover:underline text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Block 4 & 5: Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Mã lượt khám, tên, SĐT, dịch vụ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Visit Date */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Ngày khám
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Trạng thái khám
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as VisitStatus | '');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="SCHEDULED">Đã lên lịch</option>
              <option value="IN_PROGRESS">Đang khám</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Thanh toán
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value as VisitPaymentStatus | '');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả thanh toán</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PARTIALLY_PAID">Thanh toán một phần</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
        </div>

        {/* Second Row Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Employee Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Bác sĩ / Nhân viên phụ trách
            </label>
            <select
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value ? Number(e.target.value) : '');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả bác sĩ / nhân viên</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code}) - {emp.position || 'Nhân viên'}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Clear Filter */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
                setEmployeeFilter('');
                setPatientFilter('');
                setStatusFilter('');
                setPaymentStatusFilter('');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Visits Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Đang tải danh sách lượt khám...
            </p>
          </div>
        ) : visits.length === 0 ? (
          <div className="p-6">
            {hasActiveFilters ? (
              <EmptySearchState query={searchTerm} onReset={handleResetFilters} />
            ) : (
              <EmptyDataState
                title="Chưa có lượt khám nào"
                description="Hệ thống chưa ghi nhận lượt khám nào phù hợp. Hãy tiếp đón bệnh nhân hoặc tạo lượt khám mới."
                createLabel="+ Tạo lượt khám mới"
                createHref={canCreate ? "/visits/new" : undefined}
                icon={Stethoscope}
              />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Mã lượt khám</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Bệnh nhân</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">Ngày khám</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">Dịch vụ / Gói</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">Bác sĩ</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">Thành tiền</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">Trạng thái</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Thanh toán</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap min-w-[180px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {visits.map((visit) => {
                  const statusInfo =
                    VISIT_STATUS_MAP[visit.status] || {
                      label: visit.status,
                      badgeClass: 'bg-slate-100 text-slate-700',
                      icon: '•',
                    };
                  const paymentInfo =
                    PAYMENT_STATUS_MAP[visit.payment_status] || {
                      label: visit.payment_status,
                      badgeClass: 'bg-slate-100 text-slate-700',
                    };

                  return (
                    <tr
                      key={visit.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        <Link
                          href={`/visits/${visit.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span>{visit.visit_code}</span>
                        </Link>
                      </td>

                      {/* Patient */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {visit.patient?.full_name || `BN #${visit.patient_id}`}
                        </div>
                        <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                          {visit.patient?.patient_code}
                          {visit.patient?.phone && ` • ${visit.patient.phone}`}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <div>{formatDate(visit.visit_date)}</div>
                      </td>

                      {/* Service / Package */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {visit.service?.name || `DV #${visit.service_id}`}
                        </div>
                        {visit.patient_package_id && (
                          <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded text-xs whitespace-nowrap">
                            <span>📦 Gói dịch vụ</span>
                            {visit.patient_package?.package?.name && (
                              <span className="font-semibold">
                                ({visit.patient_package.package.name})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Doctor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {visit.employee?.full_name || `BS #${visit.employee_id}`}
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {visit.employee?.position || 'Bác sĩ phụ trách'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium font-mono text-slate-900 dark:text-slate-100">
                        {formatMoney(visit.total_amount)}
                        {visit.discount_amount > 0 && (
                          <div className="text-xs text-rose-500">
                            - {formatMoney(visit.discount_amount)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}
                        >
                          <span>{statusInfo.icon}</span>
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${paymentInfo.badgeClass}`}
                        >
                          {paymentInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Link
                            href={`/visits/${visit.id}`}
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
                            title="Xem chi tiết & bệnh án"
                          >
                            Chi tiết
                          </Link>

                          {canMedical && visit.status !== 'CANCELLED' && (
                            <Link
                              href={`/visits/${visit.id}/medical-record`}
                              className="px-2.5 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-md transition-colors"
                              title="Khám bệnh & Bệnh án EMR"
                            >
                              Khám bệnh
                            </Link>
                          )}

                          {canViewFiles && (
                            <button
                              type="button"
                              onClick={() => setSelectedFileVisit(visit)}
                              className="px-2.5 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md transition-colors inline-flex items-center gap-1"
                              title="Quản lý và xem trước tệp y tế (X-quang, MRI, PDF)"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              <span>Tệp y tế</span>
                            </button>
                          )}

                          {canUpdate && visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                setStatusModalVisit(visit);
                                setTargetStatus(
                                  visit.status === 'SCHEDULED'
                                    ? 'IN_PROGRESS'
                                    : 'COMPLETED'
                                );
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md transition-colors"
                              title="Chuyển trạng thái"
                            >
                              Đổi trạng thái
                            </button>
                          )}

                          {canCancel && visit.status !== 'CANCELLED' && visit.status !== 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setCancelModalVisit(visit);
                                setCancelReason('');
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-md transition-colors"
                              title="Hủy lượt khám"
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Block 7: Standard Pagination */}
        <Pagination
          currentPage={pagination?.current_page || currentPage}
          totalPages={pagination?.last_page || 1}
          totalItems={pagination?.total}
          from={pagination?.from}
          to={pagination?.to}
          perPage={pagination?.per_page || perPage}
          onPageChange={(p) => setCurrentPage(p)}
          itemLabel="lượt khám"
        />
      </div>

      {/* Quick Status Modal */}
      <Dialog open={!!statusModalVisit} onOpenChange={(open) => !open && setStatusModalVisit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cập nhật trạng thái lượt khám</DialogTitle>
            <DialogDescription>
              Lượt khám #{statusModalVisit?.visit_code} - Bệnh nhân: {statusModalVisit?.patient?.full_name}
            </DialogDescription>
          </DialogHeader>
          {statusModalVisit && (
            <form onSubmit={handleConfirmStatusChange} className="space-y-4 pt-1">
              <FormField
                label="Trạng thái mới"
                required
              >
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as VisitStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="SCHEDULED">SCHEDULED - Đã lên lịch</option>
                  <option value="IN_PROGRESS">IN_PROGRESS - Đang khám</option>
                  <option value="COMPLETED">COMPLETED - Hoàn thành khám</option>
                  <option value="CANCELLED">CANCELLED - Hủy lượt khám</option>
                </select>
              </FormField>

              <FormField
                label="Ghi chú cập nhật (tùy chọn)"
                hint="Ghi chú lâm sàng hoặc lý do điều chuyển"
              >
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Nhập ghi chú chuyển trạng thái nếu có..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </FormField>

              <DialogFooter>
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={() => setStatusModalVisit(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                >
                  Đóng
                </button>
                <FormSubmitButton
                  isSubmitting={isSubmittingStatus}
                  loadingText="Đang lưu..."
                  submitText="Xác nhận cập nhật"
                />
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Visit Alert Dialog */}
      <AlertDialog open={!!cancelModalVisit} onOpenChange={(open) => !open && setCancelModalVisit(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <XCircle className="h-5 w-5 shrink-0" />
              <AlertDialogTitle>
                Hủy lượt khám #{cancelModalVisit?.visit_code}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Bệnh nhân: <strong className="text-slate-800 dark:text-slate-200">{cancelModalVisit?.patient?.full_name}</strong>. Lưu ý: Nếu lượt khám có sử dụng gói dịch vụ, lượt sử dụng sẽ được hoàn lại an toàn vào gói của bệnh nhân.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {cancelModalVisit && (
            <form onSubmit={handleConfirmCancel} className="space-y-4 pt-1">
              <FormField
                label="Lý do hủy lượt khám"
                required
                hint="Nhập lý do chi tiết để lưu vết kiểm toán phòng khám"
              >
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy lượt khám (ví dụ: Bệnh nhân đổi lịch, hủy hẹn, yêu cầu hoàn gói...)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </FormField>

              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isSubmittingCancel}
                  onClick={() => setCancelModalVisit(null)}
                >
                  Đóng
                </AlertDialogCancel>
                <FormSubmitButton
                  variant="destructive"
                  isSubmitting={isSubmittingCancel}
                  disabled={!cancelReason.trim()}
                  loadingText="Đang hủy..."
                  submitText="Xác nhận hủy"
                />
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Fast Reception Desk Check-in Modal */}
      <Dialog
        open={isReceptionModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsReceptionModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Zap className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-xl">
                Tiếp đón bệnh nhân nhanh tại Quầy Lễ tân
              </DialogTitle>
            </div>
            <DialogDescription>
              Tra cứu thông tin bệnh nhân cũ hoặc tạo mới tức thời, kiểm tra cảnh báo trùng lặp và cấp số thứ tự chờ khám (STT: #{String(todayQueueNumber).padStart(2, '0')}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmCheckIn} className="space-y-5 pt-2">
            {/* Mode Selector Tabs */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => {
                  setReceptionMode('existing');
                  setCheckInError(null);
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
                  receptionMode === 'existing'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Bệnh nhân cũ (Đã có hồ sơ)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReceptionMode('new');
                  setCheckInError(null);
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
                  receptionMode === 'new'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>Bệnh nhân mới (Lần đầu đến khám)</span>
              </button>
            </div>

            {/* Error Banner */}
            {checkInError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{checkInError}</span>
              </div>
            )}

            {/* Mode 1: Bệnh nhân cũ */}
            {receptionMode === 'existing' && (
              <div className="space-y-3">
                <FormField
                  label="Tìm kiếm bệnh nhân"
                  hint="Nhập Số điện thoại, CCCD/CMND, Mã BN hoặc Họ tên"
                  required
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Gõ SĐT (ví dụ: 0912...), CCCD hoặc tên bệnh nhân..."
                      value={patientSearchTerm}
                      onChange={(e) => {
                        setPatientSearchTerm(e.target.value);
                        setSelectedPatient(null);
                      }}
                      className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {patientSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setPatientSearchTerm('');
                          setMatchedPatients([]);
                          setSelectedPatient(null);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </FormField>

                {/* Search in progress */}
                {isSearchingPatients && (
                  <div className="text-xs text-slate-500 flex items-center gap-2 py-1">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span>Đang tra cứu hồ sơ bệnh nhân...</span>
                  </div>
                )}

                {/* Match Results list */}
                {!selectedPatient && matchedPatients.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-sm max-h-48 overflow-y-auto">
                    {matchedPatients.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearchTerm('');
                          setMatchedPatients([]);
                        }}
                        className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{p.full_name}</span>
                            <span className="text-xs font-mono font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {p.patient_code}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                            <span>SĐT: {p.phone || 'Chưa có'}</span>
                            {p.date_of_birth && <span>NS: {p.date_of_birth}</span>}
                            <span>Giới tính: {p.gender === 'MALE' ? 'Nam' : p.gender === 'FEMALE' ? 'Nữ' : 'Khác'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          Chọn
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Patient Card */}
                {selectedPatient ? (
                  <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {selectedPatient.full_name}
                        </span>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                          {selectedPatient.patient_code}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {selectedPatient.gender === 'MALE' ? 'Nam' : selectedPatient.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4">
                        <span>📞 {selectedPatient.phone || 'Chưa cập nhật SĐT'}</span>
                        {selectedPatient.date_of_birth && (
                          <span>🎂 {selectedPatient.date_of_birth}</span>
                        )}
                        {selectedPatient.address && (
                          <span>📍 {selectedPatient.address}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline shrink-0 px-2"
                    >
                      Đổi bệnh nhân
                    </button>
                  </div>
                ) : (
                  !isSearchingPatients &&
                  patientSearchTerm.length >= 2 &&
                  matchedPatients.length === 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>Không tìm thấy hồ sơ nào khớp với từ khóa &ldquo;{patientSearchTerm}&rdquo;.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setReceptionMode('new');
                          if (/^0\d{8,10}$/.test(patientSearchTerm.trim())) {
                            setNewPhone(patientSearchTerm.trim());
                          } else {
                            setNewFullName(patientSearchTerm.trim());
                          }
                        }}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        + Tạo hồ sơ mới ngay
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Mode 2: Bệnh nhân mới */}
            {receptionMode === 'new' && (
              <div className="space-y-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Họ và tên bệnh nhân" required>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A..."
                      value={newFullName}
                      onChange={(e) => {
                        setNewFullName(e.target.value);
                        setDuplicateOverride(false);
                      }}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Số điện thoại liên hệ" required>
                    <input
                      type="tel"
                      required
                      placeholder="0912345678"
                      value={newPhone}
                      onChange={(e) => {
                        setNewPhone(e.target.value);
                        setDuplicateOverride(false);
                      }}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Ngày sinh">
                    <input
                      type="date"
                      value={newDob}
                      onChange={(e) => {
                        setNewDob(e.target.value);
                        setDuplicateOverride(false);
                      }}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Giới tính" required>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Địa chỉ cư trú (tùy chọn)">
                  <input
                    type="text"
                    placeholder="Số nhà, đường, phường/xã, quận/huyện..."
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>

                <FormField label="Tiền sử dị ứng / Ghi chú ban đầu (tùy chọn)">
                  <input
                    type="text"
                    placeholder="Dị ứng kháng sinh penicillin, hen suyễn, tiểu đường..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>

                {/* Duplicate Checking Indicator */}
                {isCheckingDuplicates && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 py-1">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                    <span>Đang kiểm tra trùng lặp hồ sơ trên hệ thống...</span>
                  </div>
                )}

                {/* DUPLICATE WARNING ALERT BANNER */}
                {duplicateWarnings.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs sm:text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>CẢNH BÁO TRÙNG LẶP HỒ SƠ BỆNH NHÂN</span>
                    </div>

                    {duplicateWarnings.map((warning, wIdx) => (
                      <div key={wIdx} className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                        <p className="font-medium">• {warning.message}</p>
                        {warning.matched_patients && warning.matched_patients.length > 0 && (
                          <div className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-2 border border-amber-200 dark:border-amber-800 space-y-1.5">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              Hồ sơ đã có trong hệ thống:
                            </p>
                            {warning.matched_patients.map((mp) => (
                              <div
                                key={mp.id}
                                className="flex items-center justify-between gap-2 p-1.5 bg-amber-50/60 dark:bg-amber-950/40 rounded border border-amber-200/50 dark:border-amber-800/50"
                              >
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {mp.full_name}
                                  </span>{' '}
                                  <span className="font-mono text-xs text-blue-600">
                                    ({mp.patient_code})
                                  </span>{' '}
                                  <span className="text-slate-500">
                                    - SĐT: {mp.phone}
                                    {mp.date_of_birth && ` - NS: ${mp.date_of_birth}`}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPatient(mp as Patient);
                                    setReceptionMode('existing');
                                    setDuplicateWarnings([]);
                                    setDuplicateOverride(false);
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shrink-0"
                                >
                                  Sử dụng hồ sơ này
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={duplicateOverride}
                        onChange={(e) => setDuplicateOverride(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                        Xác nhận vẫn tạo hồ sơ mới (Ví dụ người thân/gia đình dùng chung số điện thoại)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Phân luồng phòng khám chuyên khoa & Bác sĩ */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Phân luồng Chuyên khoa & Bác sĩ Khám</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                  STT Chờ khám: #{String(todayQueueNumber).padStart(2, '0')}
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Dịch vụ / Chuyên khoa khám" required>
                  <select
                    value={checkInServiceId}
                    onChange={(e) => setCheckInServiceId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Chọn dịch vụ khám --</option>
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({formatMoney(srv.price)})
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Bác sĩ tiếp nhận thăm khám" required>
                  <select
                    value={checkInDoctorId}
                    onChange={(e) => setCheckInDoctorId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Chọn bác sĩ phụ trách --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) - {emp.position || 'Bác sĩ'}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField
                label="Lý do khám / Triệu chứng ban đầu (tùy chọn)"
                hint="Ghi chú ban đầu từ quầy tiếp đón"
              >
                <input
                  type="text"
                  placeholder="Ví dụ: Đau đầu, sốt nhẹ 2 ngày, khám sức khỏe tổng quát..."
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </FormField>

              {/* Status Info Box */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Trạng thái tiếp nhận:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold font-mono">
                    ⏳ Chờ khám (WAITING / SCHEDULED)
                  </span>
                </div>
                <div>
                  STT cấp: <strong className="font-mono text-sm">#{String(todayQueueNumber).padStart(2, '0')}</strong>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                disabled={isSubmittingCheckIn}
                onClick={() => setIsReceptionModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <FormSubmitButton
                isSubmitting={isSubmittingCheckIn}
                loadingText="Đang tiếp nhận..."
                submitText="⚡ Xác nhận tiếp đón & Cấp số khám"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Patient Files Dialog for Selected Visit */}
      {selectedFileVisit && (
        <Dialog
          open={!!selectedFileVisit}
          onOpenChange={(open) => !open && setSelectedFileVisit(null)}
        >
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <FolderOpen className="h-5 w-5 text-indigo-600" />
                <span>Tài liệu & Tệp y tế — Ca khám {selectedFileVisit.visit_code}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Bệnh nhân: {selectedFileVisit.patient?.full_name} ({selectedFileVisit.patient?.patient_code}) • Ngày khám: {formatDate(selectedFileVisit.visit_date)}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <PatientFileManager
                patientId={selectedFileVisit.patient_id}
                patientName={selectedFileVisit.patient?.full_name}
                visitId={selectedFileVisit.id}
                title={`Tệp y tế ca khám ${selectedFileVisit.visit_code}`}
                canUpload={canUploadFiles && selectedFileVisit.status !== 'CANCELLED'}
                canDelete={canDeleteFiles}
                canView={canViewFiles}
                compact={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function VisitsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
        </div>
      }
    >
      <VisitsListContent />
    </Suspense>
  );
}
