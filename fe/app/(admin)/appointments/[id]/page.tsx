'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  cancelAppointment,
  checkInAppointment,
  deleteAppointment,
  getAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from '@/lib/api/appointments';
import { getEmployees } from '@/lib/api/employees';
import { getServices } from '@/lib/api/services';
import {
  APPOINTMENT_STATUS_MAP,
  Appointment,
  AppointmentStatus,
  UpdateAppointmentInput,
} from '@/types/appointment';
import { Employee } from '@/types/employee';
import { Service } from '@/types/service';

interface PageProps {
  params: Promise<{ id: string }>;
}

function AppointmentDetailContent({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const { hasPermission, hasRole } = useAuth();

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

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [editForm, setEditForm] = useState<UpdateAppointmentInput>({});
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchAppointmentDetail = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await getAppointment(appointmentId);
      setAppointment(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setPageError(err.message);
      } else {
        setPageError('Không thể tải thông tin chi tiết lịch hẹn.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointmentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  // Load employees and services when opening edit modal
  const handleOpenEdit = async () => {
    if (!appointment) return;
    setConflictError(null);
    setFormErrors(null);
    setEditForm({
      patient_id: appointment.patient_id,
      employee_id: appointment.employee_id,
      service_id: appointment.service_id,
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time.substring(0, 5),
      end_time: appointment.end_time.substring(0, 5),
      status: appointment.status,
      notes: appointment.notes || '',
    });

    try {
      const [empRes, srvRes] = await Promise.all([
        getEmployees({ per_page: 100 }),
        getServices({ per_page: 100 }),
      ]);
      setEmployees(empRes.data || []);
      setServices(srvRes.data || []);
    } catch {
      // ignore
    }

    setIsEditModalOpen(true);
  };

  // Submit Edit Appointment
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    setConflictError(null);
    setFormErrors(null);

    const startTime = editForm.start_time || appointment.start_time;
    const endTime = editForm.end_time || appointment.end_time;
    if (startTime >= endTime) {
      setFormErrors({
        end_time: ['Thời gian kết thúc phải lớn hơn thời gian bắt đầu.'],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateAppointment(appointment.id, editForm);
      setAppointment(res.data);
      setIsEditModalOpen(false);
      setActionSuccess('Đã cập nhật lịch hẹn thành công!');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // CONFLICT ERROR HANDLING
          setConflictError(
            err.message ||
              'Xung đột khung giờ: Bác sĩ đã có lịch hẹn khác trong khung giờ này trên cùng ngày khám. Vui lòng chọn khung giờ hoặc nhân viên khác.'
          );
        }
        if (err.errors) {
          setFormErrors(err.errors);
        } else if (err.status !== 409) {
          setConflictError(err.message);
        }
      } else {
        setConflictError('Có lỗi xảy ra khi cập nhật lịch hẹn.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Status Change
  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    if (!appointment) return;
    try {
      const res = await updateAppointmentStatus(appointment.id, newStatus);
      setAppointment(res.data);
      setActionSuccess(`Đã chuyển trạng thái lịch hẹn sang: ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('Không thể cập nhật trạng thái.');
      }
    }
  };

  // Check-in from appointment into visit
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const handleCheckIn = async () => {
    if (!appointment || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      await checkInAppointment(appointment.id);
      setActionSuccess('Tiếp nhận thành công! Lịch hẹn đã chuyển thành lượt khám.');
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchAppointmentDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('Không thể tiếp nhận lịch hẹn này.');
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Submit Cancel
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    if (!cancelReason || cancelReason.trim() === '') {
      alert('Vui lòng cung cấp lý do khi hủy lịch hẹn.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await cancelAppointment(appointment.id, cancelReason);
      setAppointment(res.data);
      setIsCancelModalOpen(false);
      setActionSuccess('Đã hủy lịch hẹn thành công.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('Không thể hủy lịch hẹn.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!appointment) return;
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa vĩnh viễn lịch hẹn ${appointment.appointment_code}?`
      )
    ) {
      return;
    }
    try {
      await deleteAppointment(appointment.id);
      router.push('/appointments');
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('Không thể xóa lịch hẹn.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Đang tải thông tin chi tiết lịch hẹn...
        </p>
      </div>
    );
  }

  if (pageError || !appointment) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        <p className="font-semibold">{pageError || 'Không tìm thấy lịch hẹn.'}</p>
        <Link
          href="/appointments"
          className="mt-3 inline-block text-sm font-medium text-blue-600 underline dark:text-blue-400"
        >
          ← Quay lại danh sách lịch hẹn
        </Link>
      </div>
    );
  }

  const statusInfo =
    APPOINTMENT_STATUS_MAP[appointment.status] || {
      label: appointment.status,
      badgeClass: 'bg-slate-100 text-slate-700',
      icon: '•',
    };

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/appointments"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              ← Danh sách lịch hẹn
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {appointment.appointment_code}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Chi Tiết Lịch Hẹn: {appointment.appointment_code}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.badgeClass}`}
            >
              <span>{statusInfo.icon}</span>
              <span>{statusInfo.label}</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && appointment.status === 'PENDING' && (
            <button
              onClick={() => handleStatusChange('CONFIRMED')}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              ✅ Xác nhận lịch hẹn
            </button>
          )}

          {canUpdate && appointment.status === 'CONFIRMED' && (
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {isCheckingIn ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>🏥</span>
              )}
              <span>Tiếp nhận từ Lịch hẹn</span>
            </button>
          )}

          {canUpdate && appointment.status === 'CONFIRMED' && (
            <button
              onClick={() => handleStatusChange('COMPLETED')}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              🎉 Đánh dấu đã khám xong
            </button>
          )}

          {canUpdate &&
            appointment.status !== 'CANCELLED' &&
            appointment.status !== 'COMPLETED' && (
              <button
                onClick={handleOpenEdit}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                ✏️ Đổi lịch / Chỉnh sửa
              </button>
            )}

          {canCancel &&
            appointment.status !== 'CANCELLED' &&
            appointment.status !== 'COMPLETED' && (
              <button
                onClick={() => {
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
                className="rounded-lg bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-400"
              >
                ❌ Hủy lịch hẹn
              </button>
            )}

          {canDelete && (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-rose-300 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
            >
              🗑️ Xóa
            </button>
          )}
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-medium text-sm">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Grid: Details Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Patient Details Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧑‍🤝‍🧑</span>
            <span>Thông tin bệnh nhân</span>
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Họ và tên
              </span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {appointment.patient?.full_name || '---'}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mã bệnh nhân
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {appointment.patient?.patient_code || '---'}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Số điện thoại
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {appointment.patient?.phone || 'Chưa cung cấp'}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Giới tính / Ngày sinh
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {appointment.patient?.gender === 'MALE'
                  ? 'Nam'
                  : appointment.patient?.gender === 'FEMALE'
                  ? 'Nữ'
                  : appointment.patient?.gender || '---'}{' '}
                {appointment.patient?.date_of_birth
                  ? `(${appointment.patient.date_of_birth})`
                  : ''}
              </p>
            </div>

            {appointment.patient_id && (
              <div className="pt-2">
                <Link
                  href={`/patients/${appointment.patient_id}`}
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Xem hồ sơ bệnh nhân đầy đủ →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Schedule & Service Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>⏱️</span>
            <span>Khung giờ & Dịch vụ</span>
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ngày khám hẹn
              </span>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {appointment.appointment_date}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Khung giờ hẹn
              </span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {appointment.start_time.substring(0, 5)} -{' '}
                {appointment.end_time.substring(0, 5)}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Dịch vụ khám
              </span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {appointment.service?.name || '---'}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Thời lượng & Đơn giá
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {appointment.service?.duration_minutes || 30} phút •{' '}
                {appointment.service?.price !== undefined
                  ? new Intl.NumberFormat('vi-VN', {
                      style: 'currency',
                      currency: 'VND',
                    }).format(appointment.service.price)
                  : '---'}
              </p>
            </div>
          </div>
        </div>

        {/* Staff & Metadata Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧑‍⚕️</span>
            <span>Bác sĩ & Lịch sử</span>
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Bác sĩ / Nhân viên tiếp nhận
              </span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {appointment.employee?.full_name || '---'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {appointment.employee?.position ||
                  appointment.employee?.department ||
                  appointment.employee?.employee_code}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Người tạo lịch
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {appointment.creator?.username || 'Hệ thống'}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Lượt khám thực hiện
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {appointment.visits_count || 0} lượt khám
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ghi chú / Yêu cầu
              </span>
              <p className="font-normal italic text-slate-600 dark:text-slate-300">
                {appointment.notes || 'Không có ghi chú'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cập nhật thông tin lịch hẹn
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* CONFLICT ERROR ALERT BANNER */}
            {conflictError && (
              <div className="mt-4 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-900 shadow-sm dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-400">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="font-bold text-sm">
                      Phát hiện xung đột lịch hẹn!
                    </h4>
                    <p className="mt-0.5 text-xs leading-relaxed">
                      {conflictError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bác sĩ / Nhân sự tiếp nhận
                </label>
                <select
                  value={editForm.employee_id}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      employee_id: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.position || emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dịch vụ
                </label>
                <select
                  value={editForm.service_id}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      service_id: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} ({srv.duration_minutes} phút)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày khám
                  </label>
                  <input
                    type="date"
                    value={editForm.appointment_date || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        appointment_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Từ giờ
                  </label>
                  <input
                    type="time"
                    value={editForm.start_time || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        start_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Đến giờ
                  </label>
                  <input
                    type="time"
                    value={editForm.end_time || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        end_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {formErrors?.end_time && (
                    <p className="mt-1 text-xs text-rose-500">
                      {formErrors.end_time[0]}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: e.target.value as AppointmentStatus,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="PENDING">Chờ xác nhận</option>
                    <option value="CONFIRMED">Đã xác nhận</option>
                    <option value="COMPLETED">Đã khám xong</option>
                    <option value="CANCELLED">Đã hủy</option>
                    <option value="NO_SHOW">Không đến</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={editForm.notes || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang kiểm tra trùng...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Xác nhận hủy lịch hẹn
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lịch sau khi hủy sẽ giải phóng khung giờ cho bác sĩ.
            </p>

            <form onSubmit={handleCancelSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do hủy
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do bệnh nhân hủy..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang hủy...' : 'Xác nhận hủy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentDetailResolver({ params }: PageProps) {
  const resolvedParams = use(params);
  return <AppointmentDetailContent appointmentId={resolvedParams.id} />;
}

export default function AppointmentDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Đang tải thông tin lịch hẹn...
          </p>
        </div>
      }
    >
      <AppointmentDetailResolver params={params} />
    </Suspense>
  );
}
