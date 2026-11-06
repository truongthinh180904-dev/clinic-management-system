'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  deleteAppointment,
  getAppointments,
  updateAppointment,
  updateAppointmentStatus,
} from '@/lib/api/appointments';
import { getEmployees } from '@/lib/api/employees';
import { getPatients, createPatient } from '@/lib/api/patients';
import { getServices } from '@/lib/api/services';
import {
  APPOINTMENT_STATUS_MAP,
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  PaginationMeta,
  UpdateAppointmentInput,
} from '@/types/appointment';
import { Employee } from '@/types/employee';
import { Patient } from '@/types/patient';
import { Service } from '@/types/service';
import { toast } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  ConfirmDialog,
} from '@/components/ui/alert-dialog';
import {
  FormField,
  FormSection,
  FormSubmitButton,
  FormAlert,
} from '@/components/ui/form-field';
import { User, Calendar, Clock, Stethoscope, AlertTriangle, UserPlus, Search } from 'lucide-react';

function AppointmentsContent() {
  const { user, hasPermission, hasRole } = useAuth();

  const isDoctorOnly = hasRole('DOCTOR') && !hasRole('ADMIN') && !hasRole('MANAGER');
  const loggedInDoctorId = user?.employee?.id || user?.employee_id;

  const canCreate =
    hasPermission('appointments.create') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST');
  const canUpdate =
    hasPermission('appointments.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST') ||
    hasRole('DOCTOR');
  const canCancel =
    hasPermission('appointments.cancel') ||
    hasPermission('appointments.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST');
  const canDelete =
    hasPermission('appointments.delete') ||
    hasPermission('appointments.cancel') ||
    hasRole('ADMIN');

  // Appointments list & pagination
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<number | ''>('');
  const [serviceFilter, setServiceFilter] = useState<number | ''>('');
  const [patientFilter, setPatientFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');

  // Dropdown reference data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // New patient registration mode in appointment modal
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientDob, setNewPatientDob] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [newPatientAddress, setNewPatientAddress] = useState('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  // Create form state
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [createForm, setCreateForm] = useState<CreateAppointmentInput>({
    patient_id: 0,
    employee_id: 0,
    service_id: 0,
    appointment_date: todayStr,
    start_time: '08:30',
    end_time: '09:00',
    status: 'CONFIRMED',
    notes: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState<UpdateAppointmentInput>({});

  // Cancel form state
  const [cancelReason, setCancelReason] = useState('');

  // Form error states & CONFLICT error
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(
    null
  );
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load reference data
  useEffect(() => {
    async function loadReferenceData() {
      const [empRes, servRes] = await Promise.allSettled([
        getEmployees({ per_page: 100, status: 'ACTIVE' }),
        getServices({ per_page: 100, status: 'ACTIVE' }),
      ]);
      if (empRes.status === 'fulfilled') {
        setEmployees(empRes.value?.data || []);
      } else {
        console.error('Lỗi khi tải dữ liệu bác sĩ/nhân viên:', empRes.reason);
      }
      if (servRes.status === 'fulfilled') {
        setServices(servRes.value?.data || []);
      } else {
        console.error('Lỗi khi tải dữ liệu dịch vụ:', servRes.reason);
      }
    }
    loadReferenceData();
  }, []);

  // Lock employeeFilter to current doctor if doctor-only
  useEffect(() => {
    if (isDoctorOnly && loggedInDoctorId) {
      setEmployeeFilter(Number(loggedInDoctorId));
    }
  }, [isDoctorOnly, loggedInDoctorId]);

  // Fetch appointments list
  const fetchAppointments = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await getAppointments({
        search: searchTerm || undefined,
        appointment_date: dateFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        employee_id: (isDoctorOnly && loggedInDoctorId) ? Number(loggedInDoctorId) : (employeeFilter !== '' ? employeeFilter : undefined),
        service_id: serviceFilter !== '' ? serviceFilter : undefined,
        patient_id: patientFilter !== '' ? patientFilter : undefined,
        status: statusFilter !== '' ? statusFilter : undefined,
        page: currentPage,
        per_page: perPage,
        sort_by: 'appointment_date',
        order: 'desc',
      });
      setAppointments(res.data || []);
      setPagination(res.meta || null);
    } catch (err) {
      if (err instanceof ApiError) {
        setPageError(err.message);
      } else {
        setPageError(
          'Không thể tải danh sách lịch hẹn. Vui lòng kiểm tra lại kết nối.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    perPage,
    dateFilter,
    fromDate,
    toDate,
    employeeFilter,
    serviceFilter,
    patientFilter,
    statusFilter,
  ]);

  // Search patients for booking modal
  const handleSearchPatients = async (query: string) => {
    setPatientSearchQuery(query);
    if (!query || query.trim().length < 2) {
      try {
        const res = await getPatients({ per_page: 100 });
        setPatients(res.data || []);
      } catch {
        // ignore
      }
      return;
    }
    setIsSearchingPatients(true);
    try {
      const res = await getPatients({ search: query.trim(), per_page: 30 });
      setPatients(res.data || []);
    } catch (err) {
      console.error('Lỗi tìm kiếm bệnh nhân:', err);
    } finally {
      setIsSearchingPatients(false);
    }
  };

  // Helper: auto calculate end time based on selected service duration
  const updateEndTimeFromService = (
    serviceId: number,
    startTime: string,
    isEdit: boolean
  ) => {
    const srv = services.find((s) => s.id === Number(serviceId));
    if (!srv || !startTime) return;
    const parts = startTime.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const totalMinutes = h * 60 + m + (srv.duration_minutes || 30);
      const newH = Math.floor(totalMinutes / 60) % 24;
      const newM = totalMinutes % 60;
      const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      if (isEdit) {
        setEditForm((prev) => ({ ...prev, end_time: formatted }));
      } else {
        setCreateForm((prev) => ({ ...prev, end_time: formatted }));
      }
    }
  };

  // Clear specific inline field error on input change
  const clearFieldError = (fieldName: string) => {
    if (formErrors && formErrors[fieldName]) {
      setFormErrors((prev) => {
        if (!prev) return null;
        const next = { ...prev };
        delete next[fieldName];
        return Object.keys(next).length > 0 ? next : null;
      });
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = async () => {
    setConflictError(null);
    setFormErrors(null);
    setPatientMode('existing');
    setNewPatientName('');
    setNewPatientPhone('');
    setNewPatientDob('');
    setNewPatientGender('MALE');
    setNewPatientAddress('');
    setPatientSearchQuery('');
    setCreateForm({
      patient_id: 0,
      employee_id: isDoctorOnly && loggedInDoctorId ? Number(loggedInDoctorId) : (employees.length > 0 ? employees[0].id : 0),
      service_id: services.length > 0 ? services[0].id : 0,
      appointment_date: dateFilter || todayStr,
      start_time: '08:30',
      end_time: '09:00',
      status: 'CONFIRMED',
      notes: '',
    });
    setIsCreateModalOpen(true);

    // Load initial patients with 100 limit
    setIsLoadingPatients(true);
    try {
      const res = await getPatients({ per_page: 100 });
      const patList = res.data || [];
      setPatients(patList);
      if (patList.length > 0) {
        setCreateForm((prev) => ({ ...prev, patient_id: patList[0].id }));
      } else {
        // If DB has no patients, auto switch to new patient mode
        setPatientMode('new');
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách bệnh nhân:', err);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  // Submit Create Appointment
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);
    setFormErrors(null);

    let targetPatientId = createForm.patient_id;
    const errors: Record<string, string[]> = {};

    // Validate patient selection or new patient inputs
    if (patientMode === 'new') {
      if (!newPatientName.trim()) {
        errors.new_patient_name = ['Vui lòng nhập họ và tên bệnh nhân mới.'];
      }
      if (!newPatientPhone.trim()) {
        errors.new_patient_phone = ['Vui lòng nhập số điện thoại bệnh nhân.'];
      } else if (!/(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(newPatientPhone.trim().replace(/\D/g, ''))) {
        errors.new_patient_phone = ['Số điện thoại không đúng định dạng (yêu cầu 10 chữ số).'];
      }
    } else {
      if (!targetPatientId || targetPatientId === 0) {
        errors.patient_id = ['Vui lòng chọn một bệnh nhân từ danh sách hoặc chuyển sang tab Bệnh nhân mới.'];
      }
    }

    if (!createForm.employee_id || Number(createForm.employee_id) === 0) {
      errors.employee_id = ['Vui lòng chọn bác sĩ phụ trách khám.'];
    }

    if (!createForm.service_id || Number(createForm.service_id) === 0) {
      errors.service_id = ['Vui lòng chọn dịch vụ khám bệnh.'];
    }

    if (!createForm.appointment_date) {
      errors.appointment_date = ['Vui lòng chọn ngày hẹn khám.'];
    }

    if (!createForm.start_time) {
      errors.start_time = ['Vui lòng chọn giờ bắt đầu khám.'];
    }

    if (!createForm.end_time) {
      errors.end_time = ['Vui lòng chọn giờ kết thúc khám.'];
    } else if (createForm.start_time && createForm.start_time >= createForm.end_time) {
      errors.end_time = ['Thời gian kết thúc phải lớn hơn thời gian bắt đầu khám.'];
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Vui lòng kiểm tra và điền đầy đủ các thông tin bắt buộc được đánh dấu đỏ bên dưới.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (patientMode === 'new') {
        // 1. Tạo bệnh nhân mới trong DB
        const patientRes = await createPatient({
          full_name: newPatientName.trim(),
          phone: newPatientPhone.trim(),
          date_of_birth: newPatientDob || undefined,
          gender: newPatientGender,
          address: newPatientAddress.trim() || undefined,
          status: 'ACTIVE',
        });
        const createdPatient = patientRes.data;
        targetPatientId = createdPatient.id;
        // Thêm vào danh sách bệnh nhân hiện hành
        setPatients((prev) => [createdPatient, ...prev]);
      }

      await createAppointment({
        ...createForm,
        patient_id: targetPatientId,
      });

      setIsCreateModalOpen(false);
      const msg = patientMode === 'new'
        ? `Đã tạo hồ sơ bệnh nhân "${newPatientName.trim()}" và đặt lịch hẹn khám thành công!`
        : 'Đặt lịch hẹn khám thành công!';
      setActionSuccess(msg);
      toast.success(msg, 'Thành công');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchAppointments();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // CONFLICT ERROR HANDLING
          const conflictMsg =
            err.message ||
            'Xung đột khung giờ: Nhân viên/Bác sĩ đã có lịch hẹn khác trong khung giờ này trên cùng ngày khám. Vui lòng chọn khung giờ hoặc nhân viên khác.';
          setConflictError(conflictMsg);
          toast.warning(conflictMsg, 'Trùng lịch bác sĩ');
        } else {
          toast.error(err.message, 'Lỗi tạo lịch hẹn');
        }
        if (err.errors) {
          setFormErrors(err.errors);
        } else if (err.status !== 409) {
          setConflictError(err.message);
        }
      } else {
        const errorMsg = 'Có lỗi hệ thống xảy ra khi đặt lịch. Vui lòng thử lại.';
        setConflictError(errorMsg);
        toast.error(errorMsg, 'Lỗi hệ thống');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setConflictError(null);
    setFormErrors(null);
    setEditForm({
      patient_id: appt.patient_id,
      employee_id: appt.employee_id,
      service_id: appt.service_id,
      appointment_date: appt.appointment_date,
      start_time: appt.start_time.substring(0, 5),
      end_time: appt.end_time.substring(0, 5),
      status: appt.status,
      notes: appt.notes || '',
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit Appointment
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    setConflictError(null);
    setFormErrors(null);

    const startTime = editForm.start_time || selectedAppointment.start_time;
    const endTime = editForm.end_time || selectedAppointment.end_time;
    if (startTime >= endTime) {
      setFormErrors({
        end_time: ['Thời gian kết thúc phải lớn hơn thời gian bắt đầu.'],
      });
      return;
    }

    if (
      editForm.status === 'CANCELLED' &&
      (!editForm.notes || editForm.notes.trim() === '')
    ) {
      setFormErrors({
        notes: ['Vui lòng cung cấp lý do khi hủy lịch hẹn.'],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAppointment(selectedAppointment.id, editForm);
      setIsEditModalOpen(false);
      setSelectedAppointment(null);
      const msg = 'Cập nhật thông tin lịch hẹn thành công!';
      setActionSuccess(msg);
      toast.success(msg, 'Thành công');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchAppointments();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // CONFLICT ERROR HANDLING
          const conflictMsg =
            err.message ||
            'Xung đột khung giờ: Bác sĩ đã có lịch hẹn khác trong khung giờ này trên cùng ngày khám. Vui lòng chọn khung giờ hoặc nhân viên khác.';
          setConflictError(conflictMsg);
          toast.warning(conflictMsg, 'Trùng lịch bác sĩ');
        } else {
          toast.error(err.message, 'Lỗi cập nhật lịch hẹn');
        }
        if (err.errors) {
          setFormErrors(err.errors);
        } else if (err.status !== 409) {
          setConflictError(err.message);
        }
      } else {
        const errorMsg = 'Có lỗi xảy ra khi cập nhật lịch hẹn. Vui lòng thử lại.';
        setConflictError(errorMsg);
        toast.error(errorMsg, 'Lỗi hệ thống');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setCancelReason('');
    setConflictError(null);
    setIsCancelModalOpen(true);
  };

  // Submit Cancel Appointment
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    if (!cancelReason || cancelReason.trim() === '') {
      toast.warning('Vui lòng cung cấp lý do khi hủy lịch hẹn.', 'Thiếu thông tin');
      return;
    }
    setIsSubmitting(true);
    try {
      await cancelAppointment(selectedAppointment.id, cancelReason);
      setIsCancelModalOpen(false);
      setSelectedAppointment(null);
      const msg = 'Đã hủy lịch hẹn thành công.';
      setActionSuccess(msg);
      toast.success(msg, 'Đã hủy lịch');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchAppointments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể hủy lịch hẹn.';
      toast.error(msg, 'Lỗi hủy lịch');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Update
  const handleQuickStatus = async (
    appt: Appointment,
    status: AppointmentStatus
  ) => {
    try {
      await updateAppointmentStatus(appt.id, status);
      const msg = `Đã chuyển trạng thái lịch hẹn sang: ${status}`;
      setActionSuccess(msg);
      toast.success(msg, 'Cập nhật trạng thái');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchAppointments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái.';
      toast.error(msg, 'Lỗi cập nhật');
    }
  };

  // Check-in from appointment to visit (P3-015 atomic check-in)
  const [checkInApptItem, setCheckInApptItem] = useState<Appointment | null>(null);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const handleOpenCheckInModal = (appt: Appointment) => {
    setCheckInApptItem(appt);
  };

  const handleConfirmCheckIn = async () => {
    if (!checkInApptItem || checkingInId !== null) return;
    setCheckingInId(checkInApptItem.id);
    try {
      await checkInAppointment(checkInApptItem.id);
      const msg = `Tiếp nhận lịch hẹn ${checkInApptItem.appointment_code} thành công! Đã tạo lượt khám vào hàng đợi.`;
      setActionSuccess(msg);
      toast.success(msg, 'Tiếp nhận thành công');
      setTimeout(() => setActionSuccess(null), 4000);
      setCheckInApptItem(null);
      fetchAppointments();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Không thể tiếp nhận lịch hẹn này.';
      toast.error(msg, 'Lỗi tiếp nhận');
    } finally {
      setCheckingInId(null);
    }
  };

  // Delete Appointment
  const [deleteApptItem, setDeleteApptItem] = useState<Appointment | null>(null);
  const [isDeletingAppt, setIsDeletingAppt] = useState(false);

  const handleDelete = (appt: Appointment) => {
    setDeleteApptItem(appt);
  };

  const handleConfirmDelete = async () => {
    if (!deleteApptItem) return;
    setIsDeletingAppt(true);
    try {
      await deleteAppointment(deleteApptItem.id);
      const msg = 'Đã xóa lịch hẹn thành công.';
      setActionSuccess(msg);
      toast.success(msg, 'Xóa lịch hẹn');
      setTimeout(() => setActionSuccess(null), 3000);
      setDeleteApptItem(null);
      fetchAppointments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa lịch hẹn.';
      toast.error(msg, 'Lỗi xóa lịch hẹn');
    } finally {
      setIsDeletingAppt(false);
    }
  };

  // Summary counts
  const summaryCounts = useMemo(() => {
    const total = pagination?.total ?? appointments.length;
    const pending = appointments.filter((a) => a.status === 'PENDING').length;
    const confirmed = appointments.filter((a) => a.status === 'CONFIRMED').length;
    const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
    return { total, pending, confirmed, completed, cancelled };
  }, [appointments, pagination]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Lịch hẹn
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Theo dõi, điều phối lịch khám bệnh và chống trùng lịch bác sĩ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/visits?fastCheckIn=true"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <span>⚡</span>
            <span>Tiếp đón tại quầy</span>
          </Link>
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <span>➕</span>
              <span>Đặt lịch hẹn mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Success Banner */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-medium text-sm">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng lịch hẹn
          </span>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {summaryCounts.total}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Chờ xác nhận
          </span>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-300">
            {summaryCounts.pending}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Đã xác nhận
          </span>
          <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-300">
            {summaryCounts.confirmed}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Đã hoàn tất
          </span>
          <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-300">
            {summaryCounts.completed}
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
          <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
            Đã hủy
          </span>
          <p className="mt-1 text-2xl font-bold text-rose-900 dark:text-rose-300">
            {summaryCounts.cancelled}
          </p>
        </div>
      </div>

      {/* Filters & Search Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCurrentPage(1);
            fetchAppointments();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12"
        >
          {/* Keyword Search */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Tìm kiếm
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Mã lịch hẹn, tên BN, SĐT, bác sĩ, dịch vụ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Date Range: From */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDateFilter('');
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Date Range: To */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDateFilter('');
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Employee / Doctor Filter */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Bác sĩ / Nhân viên
            </label>
            {isDoctorOnly ? (
              <div className="w-full px-3 py-2 text-sm bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 font-medium flex items-center justify-between">
                <span className="truncate">
                  🔒 {user?.employee?.full_name || 'Bác sĩ'} ({user?.employee?.employee_code || 'BS'})
                </span>
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
                  Của bạn
                </span>
              </div>
            ) : (
              <select
                value={employeeFilter}
                onChange={(e) => {
                  setEmployeeFilter(
                    e.target.value ? Number(e.target.value) : ''
                  );
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Tất cả bác sĩ</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.position || emp.employee_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Service Filter */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Chuyên khoa / Dịch vụ
            </label>
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(
                  e.target.value ? Number(e.target.value) : ''
                );
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Tất cả dịch vụ</option>
              {services.map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AppointmentStatus | '');
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="COMPLETED">Đã khám xong</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="NO_SHOW">Không đến</option>
            </select>
          </div>

          {/* Quick Filter Buttons & Reset */}
          <div className="flex items-end gap-2 lg:col-span-1">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
              Lọc
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
                setFromDate('');
                setToDate('');
                setEmployeeFilter(isDoctorOnly && loggedInDoctorId ? Number(loggedInDoctorId) : '');
                setServiceFilter('');
                setPatientFilter('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
              title="Đặt lại bộ lọc"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              🔄
            </button>
          </div>
        </form>

        {/* Quick Date Presets */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Xem nhanh:
          </span>
          <button
            onClick={() => {
              setDateFilter(todayStr);
              setFromDate('');
              setToDate('');
              setCurrentPage(1);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              dateFilter === todayStr && !fromDate && !toDate
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tStr = tomorrow.toISOString().split('T')[0];
              setDateFilter(tStr);
              setFromDate('');
              setToDate('');
              setCurrentPage(1);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              dateFilter && dateFilter !== todayStr
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Ngày mai
          </button>
          <button
            onClick={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              setDateFilter('');
              setFromDate(todayStr);
              setToDate(nextWeek.toISOString().split('T')[0]);
              setCurrentPage(1);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              fromDate === todayStr && toDate
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            7 ngày tới
          </button>
          <button
            onClick={() => {
              setDateFilter('');
              setFromDate('');
              setToDate('');
              setCurrentPage(1);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              dateFilter === '' && fromDate === '' && toDate === ''
                ? 'bg-slate-700 text-white dark:bg-slate-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Tất cả ngày
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {pageError && (
          <div className="p-4 text-center text-sm text-rose-600 dark:text-rose-400">
            {pageError}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Đang tải danh sách lịch hẹn...
            </p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl">📅</span>
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Không tìm thấy lịch hẹn nào
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Thử thay đổi bộ lọc hoặc thêm lịch hẹn mới cho bệnh nhân.
            </p>
            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <span>➕</span>
                <span>Đặt lịch hẹn ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[950px]">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[130px]">Mã lịch hẹn</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[180px]">Bệnh nhân</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Thời gian</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Dịch vụ</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[160px]">Bác sĩ / Nhân sự</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[130px]">Trạng thái</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap min-w-[200px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {appointments.map((appt) => {
                  const statusInfo =
                    APPOINTMENT_STATUS_MAP[appt.status] || {
                      label: appt.status,
                      badgeClass: 'bg-slate-100 text-slate-700',
                      icon: '•',
                    };

                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/30"
                    >
                      {/* Code */}
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        <Link
                          href={`/appointments/${appt.id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {appt.appointment_code}
                        </Link>
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {appt.patient?.full_name || `BN #${appt.patient_id}`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {appt.patient?.phone ||
                            appt.patient?.patient_code ||
                            '---'}
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        <div className="font-medium text-slate-900 dark:text-white text-sm font-sans">
                          {appt.appointment_date}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          ⏱️ {appt.start_time.substring(0, 5)} -{' '}
                          {appt.end_time.substring(0, 5)}
                        </div>
                      </td>

                      {/* Service */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {appt.service?.name || `DV #${appt.service_id}`}
                        </div>
                        {appt.service?.price !== undefined && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                            {new Intl.NumberFormat('vi-VN', {
                              style: 'currency',
                              currency: 'VND',
                            }).format(appt.service.price)}
                          </div>
                        )}
                      </td>

                      {/* Doctor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {appt.employee?.full_name || `NV #${appt.employee_id}`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {appt.employee?.position ||
                            appt.employee?.employee_code ||
                            'Bác sĩ phụ trách'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.badgeClass}`}
                        >
                          <span>{statusInfo.icon}</span>
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* Quick Confirm */}
                          {canUpdate && appt.status === 'PENDING' && (
                            <button
                              onClick={() =>
                                handleQuickStatus(appt, 'CONFIRMED')
                              }
                              title="Xác nhận lịch hẹn"
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                            >
                              Xác nhận
                            </button>
                          )}

                          {/* Atomic Check-in from Confirmed Appointment */}
                          {canUpdate && appt.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleOpenCheckInModal(appt)}
                              disabled={checkingInId === appt.id}
                              title="Tiếp nhận từ Lịch hẹn"
                              className="inline-flex items-center gap-1 rounded bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900"
                            >
                              {checkingInId === appt.id ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                              ) : (
                                <span>🏥</span>
                              )}
                              <span>Tiếp nhận</span>
                            </button>
                          )}

                          {/* Quick Complete */}
                          {canUpdate && appt.status === 'CONFIRMED' && (
                            <button
                              onClick={() =>
                                handleQuickStatus(appt, 'COMPLETED')
                              }
                              title="Đánh dấu đã khám xong"
                              className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                            >
                              Xong
                            </button>
                          )}

                          {/* Edit / Reschedule */}
                          {canUpdate &&
                            appt.status !== 'CANCELLED' &&
                            appt.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleOpenEditModal(appt)}
                                title="Đổi giờ / Chỉnh sửa"
                                className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                ✏️ Đổi lịch
                              </button>
                            )}

                          {/* Cancel */}
                          {canCancel &&
                            appt.status !== 'CANCELLED' &&
                            appt.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleOpenCancelModal(appt)}
                                title="Hủy lịch hẹn"
                                className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                              >
                                ❌ Hủy
                              </button>
                            )}

                          {/* Detail Link */}
                          <Link
                            href={`/appointments/${appt.id}`}
                            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            title="Xem chi tiết"
                          >
                            👁️
                          </Link>

                          {/* Delete */}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(appt)}
                              title="Xóa lịch hẹn"
                              className="rounded px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            >
                              🗑️
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

        {/* Pagination Footer */}
        {pagination && pagination.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Hiển thị từ{' '}
              <span className="font-semibold">{pagination.from || 1}</span> đến{' '}
              <span className="font-semibold">
                {pagination.to || appointments.length}
              </span>{' '}
              trong tổng số{' '}
              <span className="font-semibold">{pagination.total}</span> lịch hẹn
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Trước
              </button>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Trang {pagination.current_page} / {pagination.last_page}
              </span>
              <button
                disabled={currentPage >= pagination.last_page}
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.last_page, p + 1))
                }
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE APPOINTMENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in-0 zoom-in-95 duration-200">
            {/* STICKY HEADER */}
            <div className="sticky top-0 z-20 shrink-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Đặt Lịch Hẹn Khám Mới
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hệ thống tự động phát hiện và khóa chống trùng lịch bác sĩ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* CONFLICT ERROR ALERT BANNER */}
                {conflictError && (
                  <FormAlert
                    type="warning"
                    title="Phát hiện xung đột lịch hẹn bác sĩ!"
                    message={
                      <div>
                        <p>{conflictError}</p>
                        <p className="mt-1 text-[11px] opacity-80">
                          Gợi ý: Hãy chọn một bác sĩ khác hoặc điều chỉnh khung giờ khám (từ giờ - đến giờ) để tránh bị chồng lấn.
                        </p>
                      </div>
                    }
                    className="mb-4"
                    onDismiss={() => setConflictError(null)}
                  />
                )}
              {/* Tab chuyển đổi chế độ bệnh nhân: Cũ / Mới */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPatientMode('existing')}
                  className={`flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    patientMode === 'existing'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  <span>Bệnh nhân đã có hồ sơ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPatientMode('new')}
                  className={`flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    patientMode === 'new'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Bệnh nhân mới (Đăng ký nhanh)</span>
                </button>
              </div>

              {/* Nhóm 1: Người khám & Bác sĩ */}
              <FormSection
                title={patientMode === 'existing' ? 'Bệnh nhân & Bác sĩ tiếp nhận' : 'Đăng ký Bệnh nhân mới & Bác sĩ tiếp nhận'}
                description={
                  patientMode === 'existing'
                    ? 'Chọn hồ sơ bệnh nhân từ danh mục và bác sĩ phụ trách khám'
                    : 'Nhập thông tin bệnh nhân mới (hệ thống sẽ tự động tạo hồ sơ)'
                }
                icon={patientMode === 'existing' ? User : UserPlus}
              >
                {patientMode === 'existing' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Bệnh nhân đặt lịch"
                      required
                      error={formErrors?.patient_id}
                    >
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={patientSearchQuery}
                            onChange={(e) => handleSearchPatients(e.target.value)}
                            placeholder="Gõ tên hoặc SĐT để lọc nhanh..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                          />
                          {isSearchingPatients && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-600 dark:text-blue-400">
                              Đang tìm...
                            </span>
                          )}
                        </div>

                        <select
                          value={createForm.patient_id}
                          onChange={(e) => {
                            setCreateForm((prev) => ({
                              ...prev,
                              patient_id: Number(e.target.value),
                            }));
                            clearFieldError('patient_id');
                          }}
                          disabled={isLoadingPatients}
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white disabled:opacity-50 ${
                            formErrors?.patient_id
                              ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <option value={0}>
                            {isLoadingPatients
                              ? '⏳ Đang tải danh sách bệnh nhân...'
                              : patients.length === 0
                              ? '-- Chưa có bệnh nhân nào trong hệ thống --'
                              : `-- Chọn bệnh nhân (${patients.length}) --`}
                          </option>
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} ({p.patient_code} - {p.phone || 'Không có SĐT'})
                            </option>
                          ))}
                        </select>

                        {patients.length === 0 && !isLoadingPatients && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center justify-between pt-1">
                            <span>Chưa có bệnh nhân nào trong hệ thống.</span>
                            <button
                              type="button"
                              onClick={() => setPatientMode('new')}
                              className="font-semibold text-blue-600 dark:text-blue-400 underline"
                            >
                              + Đăng ký bệnh nhân mới ngay
                            </button>
                          </div>
                        )}
                      </div>
                    </FormField>

                    <FormField
                      label="Bác sĩ / Nhân viên tiếp nhận"
                      required
                      error={formErrors?.employee_id}
                    >
                      {isDoctorOnly ? (
                        <div className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span className="font-medium">
                            👨‍⚕️ {user?.employee?.full_name || 'Bác sĩ'} ({user?.employee?.employee_code || 'BS'})
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                            Cố định
                          </span>
                        </div>
                      ) : (
                        <select
                          value={createForm.employee_id}
                          onChange={(e) => {
                            setCreateForm((prev) => ({
                              ...prev,
                              employee_id: Number(e.target.value),
                            }));
                            clearFieldError('employee_id');
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                            formErrors?.employee_id
                              ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                              : conflictError
                                ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-400'
                                : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <option value={0}>-- Chọn bác sĩ tiếp nhận --</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name} ({emp.position || emp.employee_code})
                            </option>
                          ))}
                        </select>
                      )}
                    </FormField>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Họ và tên bệnh nhân mới" required error={formErrors?.new_patient_name}>
                        <input
                          type="text"
                          required
                          placeholder="Ví dụ: Nguyễn Văn A..."
                          value={newPatientName}
                          onChange={(e) => {
                            setNewPatientName(e.target.value);
                            clearFieldError('new_patient_name');
                          }}
                          className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                            formErrors?.new_patient_name
                              ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        />
                      </FormField>

                      <FormField label="Số điện thoại liên hệ" required error={formErrors?.new_patient_phone}>
                        <input
                          type="tel"
                          required
                          placeholder="Ví dụ: 0912345678"
                          value={newPatientPhone}
                          onChange={(e) => {
                            setNewPatientPhone(e.target.value);
                            clearFieldError('new_patient_phone');
                          }}
                          className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                            formErrors?.new_patient_phone
                              ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField label="Ngày sinh">
                        <input
                          type="date"
                          value={newPatientDob}
                          onChange={(e) => setNewPatientDob(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </FormField>

                      <FormField label="Giới tính" required>
                        <select
                          value={newPatientGender}
                          onChange={(e) => setNewPatientGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="MALE">Nam</option>
                          <option value="FEMALE">Nữ</option>
                          <option value="OTHER">Khác</option>
                        </select>
                      </FormField>

                      <FormField label="Địa chỉ cư trú (tùy chọn)">
                        <input
                          type="text"
                          placeholder="Quận/Huyện, Tỉnh..."
                          value={newPatientAddress}
                          onChange={(e) => setNewPatientAddress(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </FormField>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <FormField
                        label="Bác sĩ / Nhân viên tiếp nhận"
                        required
                        error={formErrors?.employee_id}
                      >
                        {isDoctorOnly ? (
                          <div className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span className="font-medium">
                              👨‍⚕️ {user?.employee?.full_name || 'Bác sĩ'} ({user?.employee?.employee_code || 'BS'})
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                              Cố định
                            </span>
                          </div>
                        ) : (
                          <select
                            value={createForm.employee_id}
                            onChange={(e) => {
                              setCreateForm((prev) => ({
                                ...prev,
                                employee_id: Number(e.target.value),
                              }));
                              clearFieldError('employee_id');
                            }}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                              formErrors?.employee_id
                                ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                                : conflictError
                                  ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-400'
                                  : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <option value={0}>-- Chọn bác sĩ tiếp nhận --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.full_name} ({emp.position || emp.employee_code})
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    </div>
                  </div>
                )}
              </FormSection>

              {/* Nhóm 2: Dịch vụ & Khung giờ */}
              <FormSection
                title="Dịch vụ & Khung thời gian khám"
                description="Hệ thống tự động tính giờ kết thúc dựa theo thời lượng của gói/dịch vụ"
                icon={Clock}
              >
                <div className="space-y-4">
                  <FormField
                    label="Dịch vụ khám"
                    required
                    error={formErrors?.service_id}
                  >
                    <select
                      value={createForm.service_id}
                      onChange={(e) => {
                        const sid = Number(e.target.value);
                        setCreateForm((prev) => ({ ...prev, service_id: sid }));
                        updateEndTimeFromService(sid, createForm.start_time, false);
                        clearFieldError('service_id');
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                        formErrors?.service_id
                          ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <option value={0}>-- Chọn dịch vụ --</option>
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} ({srv.duration_minutes} phút -{' '}
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND',
                          }).format(srv.price)}
                          )
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField
                      label="Ngày hẹn khám"
                      required
                      error={formErrors?.appointment_date}
                    >
                      <input
                        type="date"
                        value={createForm.appointment_date}
                        onChange={(e) => {
                          setCreateForm((prev) => ({
                            ...prev,
                            appointment_date: e.target.value,
                          }));
                          clearFieldError('appointment_date');
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                          formErrors?.appointment_date
                            ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                    </FormField>

                    <FormField
                      label="Từ giờ"
                      required
                      error={formErrors?.start_time || formErrors?.time_slot}
                    >
                      <input
                        type="time"
                        value={createForm.start_time}
                        onChange={(e) => {
                          const st = e.target.value;
                          setCreateForm((prev) => ({ ...prev, start_time: st }));
                          updateEndTimeFromService(createForm.service_id, st, false);
                          clearFieldError('start_time');
                          clearFieldError('time_slot');
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                          formErrors?.start_time || formErrors?.time_slot
                            ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                            : conflictError
                              ? 'border-amber-500 bg-amber-50/20'
                              : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                    </FormField>

                    <FormField
                      label="Đến giờ"
                      required
                      error={formErrors?.end_time || formErrors?.time_slot}
                    >
                      <input
                        type="time"
                        value={createForm.end_time}
                        onChange={(e) => {
                          setCreateForm((prev) => ({
                            ...prev,
                            end_time: e.target.value,
                          }));
                          clearFieldError('end_time');
                          clearFieldError('time_slot');
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                          formErrors?.end_time || formErrors?.time_slot
                            ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-400'
                            : conflictError
                              ? 'border-amber-500 bg-amber-50/20'
                              : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                    </FormField>
                  </div>
                </div>
              </FormSection>

              {/* Nhóm 3: Trạng thái & Ghi chú */}
              <FormSection
                title="Trạng thái & Ghi chú tiếp đón"
                description="Ghi nhận triệu chứng sơ bộ hoặc yêu cầu của người bệnh"
                icon={Stethoscope}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Trạng thái ban đầu"
                    required
                  >
                    <select
                      value={createForm.status}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          status: e.target.value as AppointmentStatus,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="CONFIRMED">Đã xác nhận</option>
                      <option value="PENDING">Chờ xác nhận</option>
                    </select>
                  </FormField>

                  <FormField
                    label="Ghi chú / Triệu chứng ban đầu"
                  >
                    <input
                      type="text"
                      value={createForm.notes || ''}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Triệu chứng, yêu cầu riêng..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </FormField>
                </div>
              </FormSection>
              </div>

              {/* STICKY FOOTER */}
              <div className="sticky bottom-0 z-20 shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <FormSubmitButton
                  isSubmitting={isSubmitting}
                  loadingText="Đang kiểm tra & lưu..."
                  submitText="Xác nhận đặt lịch"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / RESCHEDULE MODAL */}
      {isEditModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in-0 zoom-in-95 duration-200">
            {/* STICKY HEADER */}
            <div className="sticky top-0 z-20 shrink-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Cập Nhật Lịch Hẹn {selectedAppointment.appointment_code}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bệnh nhân: {selectedAppointment.patient?.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* CONFLICT ERROR ALERT BANNER */}
                {conflictError && (
                  <FormAlert
                    type="warning"
                    title="Phát hiện xung đột lịch hẹn!"
                    message={
                      <div>
                        <p>{conflictError}</p>
                        <p className="mt-1 text-[11px] opacity-80">
                          Gợi ý: Khung giờ đã chọn bị trùng với lịch hẹn khác của bác sĩ. Hãy chọn giờ khác hoặc chọn bác sĩ khác.
                        </p>
                      </div>
                    }
                    className="mb-4"
                    onDismiss={() => setConflictError(null)}
                  />
                )}
              <FormSection
                title="Phụ trách & Dịch vụ"
                description="Điều chỉnh bác sĩ khám hoặc gói dịch vụ điều trị"
                icon={User}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Bác sĩ / Nhân viên tiếp nhận"
                    required
                    error={conflictError ? 'Khung giờ này bị trùng lịch' : undefined}
                  >
                    {isDoctorOnly ? (
                      <div className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span className="font-medium">
                          👨‍⚕️ {user?.employee?.full_name || 'Bác sĩ'} ({user?.employee?.employee_code || 'BS'})
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                          Cố định
                        </span>
                      </div>
                    ) : (
                      <select
                        value={editForm.employee_id}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            employee_id: Number(e.target.value),
                          }))
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                          conflictError
                            ? 'border-amber-500 bg-amber-50/20'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.position || emp.employee_code})
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>

                  <FormField
                    label="Dịch vụ khám"
                  >
                    <select
                      value={editForm.service_id}
                      onChange={(e) => {
                        const sid = Number(e.target.value);
                        setEditForm((prev) => ({ ...prev, service_id: sid }));
                        updateEndTimeFromService(
                          sid,
                          editForm.start_time || '08:30',
                          true
                        );
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} ({srv.duration_minutes} phút -{' '}
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND',
                          }).format(srv.price)}
                          )
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                title="Thời gian hẹn khám"
                description="Khung giờ khám mới của lượt tiếp nhận"
                icon={Clock}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormField
                    label="Ngày khám"
                    required
                  >
                    <input
                      type="date"
                      value={editForm.appointment_date || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          appointment_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </FormField>

                  <FormField
                    label="Từ giờ"
                    required
                  >
                    <input
                      type="time"
                      value={editForm.start_time || ''}
                      onChange={(e) => {
                        const st = e.target.value;
                        setEditForm((prev) => ({ ...prev, start_time: st }));
                        if (editForm.service_id) {
                          updateEndTimeFromService(editForm.service_id, st, true);
                        }
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                        conflictError
                          ? 'border-amber-500 bg-amber-50/20'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                  </FormField>

                  <FormField
                    label="Đến giờ"
                    required
                    error={formErrors?.end_time}
                  >
                    <input
                      type="time"
                      value={editForm.end_time || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          end_time: e.target.value,
                        }))
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                        conflictError || formErrors?.end_time
                          ? 'border-amber-500 bg-amber-50/20'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                title="Trạng thái & Ghi chú"
                description="Cập nhật tiến độ tiếp nhận bệnh nhân"
                icon={Stethoscope}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Trạng thái lịch"
                    required
                  >
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          status: e.target.value as AppointmentStatus,
                        }))
                      }
                      disabled={
                        selectedAppointment.status === 'COMPLETED' ||
                        selectedAppointment.status === 'CANCELLED' ||
                        selectedAppointment.status === 'NO_SHOW'
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {selectedAppointment.status === 'PENDING' && (
                        <>
                          <option value="PENDING">Chờ xác nhận (Hiện tại)</option>
                          <option value="CONFIRMED">Đã xác nhận</option>
                          <option value="CANCELLED">Hủy lịch hẹn</option>
                        </>
                      )}
                      {selectedAppointment.status === 'CONFIRMED' && (
                        <>
                          <option value="CONFIRMED">Đã xác nhận (Hiện tại)</option>
                          <option value="COMPLETED">Đã khám xong</option>
                          <option value="CANCELLED">Hủy lịch hẹn</option>
                          <option value="NO_SHOW">Không đến (No-show)</option>
                        </>
                      )}
                      {selectedAppointment.status === 'COMPLETED' && (
                        <option value="COMPLETED">Đã khám xong (Đã khóa)</option>
                      )}
                      {selectedAppointment.status === 'CANCELLED' && (
                        <option value="CANCELLED">Đã hủy (Đã khóa)</option>
                      )}
                      {selectedAppointment.status === 'NO_SHOW' && (
                        <option value="NO_SHOW">Không đến (Đã khóa)</option>
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label={
                      editForm.status === 'CANCELLED'
                        ? 'Lý do hủy lịch hẹn'
                        : 'Ghi chú bổ sung'
                    }
                    required={editForm.status === 'CANCELLED'}
                    error={formErrors?.notes}
                  >
                    <input
                      type="text"
                      value={editForm.notes || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </FormField>
                </div>
              </FormSection>
              </div>

              {/* STICKY FOOTER */}
              <div className="sticky bottom-0 z-20 shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <FormSubmitButton
                  isSubmitting={isSubmitting}
                  loadingText="Đang kiểm tra trùng..."
                  submitText="Lưu thay đổi"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL APPOINTMENT ALERT DIALOG */}
      <AlertDialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <AlertDialogTitle>
                Hủy Lịch Hẹn {selectedAppointment?.appointment_code}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Lịch sau khi hủy sẽ giải phóng khung giờ làm việc cho bác sĩ. Thao tác này sẽ ghi nhận vào audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedAppointment && (
            <form onSubmit={handleCancelSubmit} className="space-y-4 pt-1">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div>
                  Bệnh nhân: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAppointment.patient?.full_name}</span>
                </div>
                <div>
                  Ngày khám: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAppointment.appointment_date} ({selectedAppointment.start_time.substring(0, 5)} - {selectedAppointment.end_time.substring(0, 5)})</span>
                </div>
              </div>

              <FormField
                label="Lý do hủy lịch"
                required
                hint="Nhập lý do chi tiết để lưu vết kiểm toán (audit log)"
              >
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ví dụ: Bệnh nhân báo bận đột xuất, chuyển sang ngày khác..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Đóng
                </AlertDialogCancel>
                <FormSubmitButton
                  variant="destructive"
                  isSubmitting={isSubmitting}
                  disabled={!cancelReason.trim()}
                  loadingText="Đang hủy..."
                  submitText="Xác nhận hủy lịch"
                />
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* CHECK-IN FROM APPOINTMENT CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!checkInApptItem}
        onOpenChange={(open) => {
          if (!open && checkingInId === null) setCheckInApptItem(null);
        }}
        title="Xác nhận tiếp nhận từ Lịch hẹn"
        variant="success"
        confirmText="Xác nhận tiếp nhận"
        cancelText="Hủy bỏ"
        isLoading={checkingInId !== null}
        onConfirm={handleConfirmCheckIn}
        onCancel={() => setCheckInApptItem(null)}
        description={
          checkInApptItem ? (
            <div className="space-y-3">
              <p>
                Bạn có chắc chắn muốn tiếp nhận bệnh nhân{' '}
                <strong className="text-slate-900 dark:text-white">
                  {checkInApptItem.patient?.full_name}
                </strong>{' '}
                (Mã: <span className="font-mono">{checkInApptItem.appointment_code}</span>)?
              </p>
              <div className="rounded-lg bg-teal-50 dark:bg-teal-950/40 p-3 text-xs space-y-1.5 border border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Dịch vụ:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {checkInApptItem.service?.name || `DV #${checkInApptItem.service_id}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Bác sĩ phụ trách:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {checkInApptItem.employee?.full_name || `NV #${checkInApptItem.employee_id}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Giờ hẹn:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {checkInApptItem.appointment_date} ({checkInApptItem.start_time.substring(0, 5)} - {checkInApptItem.end_time.substring(0, 5)})
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hệ thống sẽ chuyển trạng thái lịch hẹn sang <strong>COMPLETED</strong> và tự động sinh lượt khám trong hàng đợi với cơ chế khóa bi quan chống tạo trùng.
              </p>
            </div>
          ) : null
        }
      />

      {/* DELETE APPOINTMENT CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!deleteApptItem}
        onOpenChange={(open) => {
          if (!open && !isDeletingAppt) setDeleteApptItem(null);
        }}
        title="Xác nhận xóa vĩnh viễn lịch hẹn"
        description={
          deleteApptItem ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa vĩnh viễn lịch hẹn{' '}
                <strong className="font-mono text-rose-600 font-semibold">{deleteApptItem.appointment_code}</strong>{' '}
                của bệnh nhân{' '}
                <strong className="text-slate-900 dark:text-white">{deleteApptItem.patient?.full_name}</strong>?
              </p>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-2 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                ⚠️ Cảnh báo: Thao tác này sẽ xóa hoàn toàn lịch hẹn khỏi hệ thống và không thể phục hồi!
              </div>
            </div>
          ) : null
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="destructive"
        isLoading={isDeletingAppt}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteApptItem(null)}
      />
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Đang tải dữ liệu lịch hẹn...
          </p>
        </div>
      }
    >
      <AppointmentsContent />
    </Suspense>
  );
}
