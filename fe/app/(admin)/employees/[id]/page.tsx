'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  deleteEmployee,
  getEmployee,
  updateEmployee,
  updateEmployeeStatus,
} from '@/lib/api/employees';
import {
  Employee,
  EmployeeStatus,
  Gender,
  UpdateEmployeeInput,
} from '@/types/employee';

const DEPARTMENTS = [
  'Khám bệnh',
  'Chẩn đoán hình ảnh',
  'Xét nghiệm',
  'Dược',
  'Lễ tân & CSKH',
  'Tài chính - Kế toán',
  'Ban Giám Đốc',
  'Khác',
];

const STATUS_MAP: Record<EmployeeStatus, { label: string; badgeClass: string }> = {
  ACTIVE: {
    label: 'Đang làm việc',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  INACTIVE: {
    label: 'Tạm nghỉ',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  LOCKED: {
    label: 'Đã nghỉ việc',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function EmployeeDetailContent({ employeeId }: { employeeId: string }) {
  const router = useRouter();

  const { hasPermission, hasRole } = useAuth();
  const canUpdate = hasPermission('employees.update') || hasRole('ADMIN');
  const canDelete = hasPermission('employees.delete') || hasRole('ADMIN');

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<UpdateEmployeeInput>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(null);
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);

  const fetchDetail = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getEmployee(employeeId);
      setEmployee(res.data);
      setFormData({
        employee_code: res.data.employee_code || '',
        full_name: res.data.full_name || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.slice(0, 10) : '',
        gender: res.data.gender || 'MALE',
        department: res.data.department || '',
        position: res.data.position || '',
        hire_date: res.data.hire_date ? res.data.hire_date.slice(0, 10) : '',
        status: res.data.status || 'ACTIVE',
        notes: res.data.notes || '',
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải thông tin nhân viên.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdate) return;
    setIsSaving(true);
    setFormErrors(null);
    setFormGeneralError(null);
    setSaveSuccess(null);

    try {
      const payload: UpdateEmployeeInput = {
        employee_code: formData.employee_code?.trim() || undefined,
        full_name: formData.full_name?.trim() || '',
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        date_of_birth: formData.date_of_birth || null,
        gender: (formData.gender as Gender) || null,
        department: formData.department?.trim() || null,
        position: formData.position?.trim() || null,
        hire_date: formData.hire_date || null,
        status: formData.status as EmployeeStatus,
        notes: formData.notes?.trim() || null,
      };

      const res = await updateEmployee(employeeId, payload);
      setEmployee(res.data);
      setSaveSuccess('Đã cập nhật thông tin nhân viên thành công.');
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormGeneralError(err.message);
        if (err.errors) {
          setFormErrors(err.errors);
        }
      } else {
        setFormGeneralError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: EmployeeStatus) => {
    if (!canUpdate || !employee) return;
    try {
      await updateEmployeeStatus(employee.id, newStatus);
      setEmployee({ ...employee, status: newStatus });
      setFormData((prev) => ({ ...prev, status: newStatus }));
      setSaveSuccess(`Đã cập nhật trạng thái thành ${STATUS_MAP[newStatus].label}.`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái.';
      alert(msg);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !employee) return;
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn xóa nhân viên "${employee.full_name}" (${employee.employee_code})? Thao tác này không thể hoàn tác.`
    );
    if (!confirmed) return;

    try {
      await deleteEmployee(employee.id);
      alert('Đã xóa nhân viên thành công.');
      router.push('/employees');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa nhân viên.';
      alert(`Lỗi: ${msg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải hồ sơ nhân viên...</p>
      </div>
    );
  }

  if (errorMsg || !employee) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-950 p-8 border border-slate-200 dark:border-slate-800 text-center">
        <span className="text-4xl">⚠️</span>
        <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Không tìm thấy nhân viên</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{errorMsg || 'Hồ sơ nhân viên không tồn tại hoặc đã bị xóa.'}</p>
        <Link
          href="/employees"
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ← Quay lại danh sách nhân sự
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[employee.status] || STATUS_MAP.ACTIVE;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/employees" className="hover:text-blue-600 dark:hover:text-blue-400">
            Nhân sự
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-900 dark:text-white">
            {employee.full_name} ({employee.employee_code})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/employees"
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ← Quay lại
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-2xl">
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {employee.full_name}
              </h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>Mã NV: <strong className="text-blue-600 dark:text-blue-400">{employee.employee_code}</strong></span>
              <span>•</span>
              <span>Phòng ban: {employee.department || 'Chưa cập nhật'}</span>
              <span>•</span>
              <span>Chức vụ: {employee.position || 'Chưa cập nhật'}</span>
            </div>
          </div>
        </div>

        {canUpdate && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Trạng thái:</span>
            <select
              value={employee.status}
              onChange={(e) => handleStatusChange(e.target.value as EmployeeStatus)}
              aria-label="Cập nhật trạng thái"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ACTIVE">Đang làm việc</option>
              <option value="INACTIVE">Tạm nghỉ</option>
              <option value="LOCKED">Đã nghỉ việc</option>
            </select>
          </div>
        )}
      </div>

      {/* Notification banner */}
      {saveSuccess && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300">
          ✅ {saveSuccess}
        </div>
      )}

      {formGeneralError && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-4 border border-rose-200 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-300">
          ❌ {formGeneralError}
        </div>
      )}

      {/* Main Grid: Left Edit Form / Right Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Edit Form */}
        <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Thông tin hồ sơ nhân viên
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canUpdate}
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                {formErrors?.full_name && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.full_name[0]}</p>
                )}
              </div>

              {/* Employee Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mã nhân viên
                </label>
                <input
                  type="text"
                  disabled={!canUpdate}
                  value={formData.employee_code || ''}
                  onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                {formErrors?.employee_code && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.employee_code[0]}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  disabled={!canUpdate}
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                {formErrors?.phone && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.phone[0]}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  disabled={!canUpdate}
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                {formErrors?.email && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.email[0]}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  disabled={!canUpdate}
                  value={formData.date_of_birth || ''}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                {formErrors?.date_of_birth && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.date_of_birth[0]}</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Giới tính
                </label>
                <select
                  disabled={!canUpdate}
                  value={formData.gender || 'MALE'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phòng ban
                </label>
                <input
                  type="text"
                  list="dept-list-detail"
                  disabled={!canUpdate}
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                <datalist id="dept-list-detail">
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chức vụ
                </label>
                <input
                  type="text"
                  disabled={!canUpdate}
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              {/* Hire Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ngày vào làm
                </label>
                <input
                  type="date"
                  disabled={!canUpdate}
                  value={formData.hire_date || ''}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Trạng thái
                </label>
                <select
                  disabled={!canUpdate}
                  value={formData.status || 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EmployeeStatus })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="ACTIVE">Đang làm việc</option>
                  <option value="INACTIVE">Tạm nghỉ</option>
                  <option value="LOCKED">Đã nghỉ việc</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú
              </label>
              <textarea
                rows={3}
                disabled={!canUpdate}
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>

            {canUpdate && (
              <div className="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Column (1/3): Account Info & Danger Zone */}
        <div className="space-y-6">
          {/* Linked User Account Card */}
          <div className="rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <span>👤</span>
              <span>Tài khoản người dùng</span>
            </h3>

            {employee.user ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Tên đăng nhập:</span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                      {employee.user.username}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Email tài khoản:</span>
                    <span className="text-xs text-slate-800 dark:text-slate-200">
                      {employee.user.email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Trạng thái:</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                      {employee.user.status}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/users?search=${encodeURIComponent(employee.user.username)}`}
                  className="block w-full text-center rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  Quản lý tài khoản trong Phân quyền →
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nhân viên này chưa được cấp tài khoản đăng nhập vào hệ thống.
                </p>
                <Link
                  href={`/users?employee_id=${employee.id}&full_name=${encodeURIComponent(employee.full_name)}&email=${encodeURIComponent(employee.email || '')}`}
                  className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  + Cấp tài khoản mới
                </Link>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <h3 className="font-semibold text-slate-900 dark:text-white text-xs mb-2">
              Thời gian khởi tạo
            </h3>
            <div className="flex justify-between">
              <span>Ngày tạo:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {employee.created_at ? new Date(employee.created_at).toLocaleString('vi-VN') : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cập nhật cuối:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {employee.updated_at ? new Date(employee.updated_at).toLocaleString('vi-VN') : '—'}
              </span>
            </div>
          </div>

          {/* Danger Zone */}
          {canDelete && (
            <div className="rounded-xl bg-rose-50/60 dark:bg-rose-950/20 p-6 border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                Vùng nguy hiểm
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Xóa vĩnh viễn hồ sơ nhân viên này khỏi hệ thống. Lưu ý: Nếu nhân viên đã có dữ liệu lượt khám, lịch hẹn hoặc bệnh án thì hệ thống sẽ từ chối xóa để đảm bảo toàn vẹn dữ liệu.
              </p>
              <button
                onClick={handleDelete}
                className="w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors"
              >
                Xóa hồ sơ nhân viên này
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeDetailResolver({ params }: PageProps) {
  const resolvedParams = use(params);
  return <EmployeeDetailContent employeeId={resolvedParams.id} />;
}

export default function EmployeeDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải hồ sơ nhân viên...</p>
        </div>
      }
    >
      <EmployeeDetailResolver params={params} />
    </Suspense>
  );
}
