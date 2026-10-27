'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployeeStatus,
} from '@/lib/api/employees';
import {
  CreateEmployeeInput,
  Employee,
  EmployeeStatus,
} from '@/types/employee';
import { PaginationMeta } from '@/types/auth';

const DEPARTMENTS = [
  'Tất cả phòng ban',
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

export default function EmployeesPage() {
  const { hasPermission, hasRole } = useAuth();
  const canCreate = hasPermission('employees.create') || hasRole('ADMIN');
  const canUpdate = hasPermission('employees.update') || hasRole('ADMIN');
  const canDelete = hasPermission('employees.delete') || hasRole('ADMIN');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    from: 0,
    last_page: 1,
    per_page: 10,
    to: 0,
    total: 0,
  });

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal create state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrors, setModalErrors] = useState<Record<string, string[]> | null>(null);
  const [modalGeneralError, setModalGeneralError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateEmployeeInput>({
    employee_code: '',
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: 'MALE',
    position: '',
    department: '',
    hire_date: new Date().toISOString().slice(0, 10),
    status: 'ACTIVE',
    notes: '',
  });

  // Action status message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fetchEmployees = async (currentPage = page) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getEmployees({
        search: search.trim() || undefined,
        department: selectedDept && selectedDept !== 'Tất cả phòng ban' ? selectedDept : undefined,
        status: selectedStatus || undefined,
        page: currentPage,
        per_page: 10,
      });
      setEmployees(res.data || []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải danh sách nhân viên.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedDept, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEmployees(1);
  };

  const handleStatusChange = async (employee: Employee, newStatus: EmployeeStatus) => {
    if (!canUpdate) return;
    try {
      await updateEmployeeStatus(employee.id, newStatus);
      setActionSuccess(`Đã cập nhật trạng thái nhân viên ${employee.full_name} thành ${STATUS_MAP[newStatus].label}.`);
      setEmployees((prev) =>
        prev.map((item) => (item.id === employee.id ? { ...item, status: newStatus } : item))
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái.';
      alert(msg);
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa nhân viên "${employee.full_name}" (${employee.employee_code})?`
    );
    if (!confirmed) return;

    try {
      await deleteEmployee(employee.id);
      setActionSuccess(`Đã xóa thành công nhân viên ${employee.full_name}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmployees(page);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa nhân viên.';
      alert(`Lỗi: ${msg}`);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      employee_code: '',
      full_name: '',
      phone: '',
      email: '',
      date_of_birth: '',
      gender: 'MALE',
      position: '',
      department: '',
      hire_date: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
      notes: '',
    });
    setModalErrors(null);
    setModalGeneralError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalErrors(null);
    setModalGeneralError(null);

    try {
      const payload: CreateEmployeeInput = {
        ...formData,
        employee_code: formData.employee_code?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        hire_date: formData.hire_date || undefined,
        notes: formData.notes?.trim() || undefined,
      };

      const res = await createEmployee(payload);
      setIsModalOpen(false);
      setActionSuccess(`Đã tạo thành công nhân viên "${res.data.full_name}" (Mã: ${res.data.employee_code}).`);
      setTimeout(() => setActionSuccess(null), 5000);
      setPage(1);
      fetchEmployees(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setModalGeneralError(err.message);
        if (err.errors) {
          setModalErrors(err.errors);
        }
      } else {
        setModalGeneralError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Quản lý Nhân sự
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Danh sách bác sĩ, điều dưỡng, lễ tân và nhân viên trong phòng khám
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span>+</span>
            <span>Thêm nhân viên mới</span>
          </button>
        )}
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:opacity-75 text-xs font-semibold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm mã NV, họ tên, SĐT, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả phòng ban</option>
              {DEPARTMENTS.slice(1).map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang làm việc</option>
              <option value="INACTIVE">Tạm nghỉ</option>
              <option value="LOCKED">Đã nghỉ việc</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
            >
              Tìm kiếm
            </button>
            {(search || selectedDept || selectedStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedDept('');
                  setSelectedStatus('');
                  setPage(1);
                  startTransition(() => {
                    fetchEmployees(1);
                  });
                }}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700"
                title="Xóa bộ lọc"
              >
                ✕
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Content: Table / Loading / Error / Empty */}
      <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách nhân sự...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xl font-bold">
              !
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">Không thể tải dữ liệu</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
            <button
              onClick={() => fetchEmployees(page)}
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Thử lại
            </button>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl">🧑‍⚕️</span>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Không tìm thấy nhân viên nào
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {search || selectedDept || selectedStatus
                ? 'Không có kết quả nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại.'
                : 'Chưa có dữ liệu nhân sự trên hệ thống.'}
            </p>
            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Thêm nhân viên đầu tiên
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Mã NV</th>
                    <th className="py-3.5 px-4">Họ và tên</th>
                    <th className="py-3.5 px-4">Liên hệ</th>
                    <th className="py-3.5 px-4">Phòng ban & Chức vụ</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Tài khoản</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {employees.map((emp) => {
                    const statusInfo = STATUS_MAP[emp.status] || STATUS_MAP.ACTIVE;
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Employee Code */}
                        <td className="py-3.5 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="hover:underline"
                          >
                            {emp.employee_code}
                          </Link>
                        </td>

                        {/* Full Name */}
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {emp.full_name}
                          </Link>
                          {emp.gender && (
                            <span className="ml-2 text-xs text-slate-400">
                              ({emp.gender === 'MALE' ? 'Nam' : emp.gender === 'FEMALE' ? 'Nữ' : 'Khác'})
                            </span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div>{emp.phone || '—'}</div>
                          {emp.email && (
                            <div className="text-xs text-slate-400">{emp.email}</div>
                          )}
                        </td>

                        {/* Department & Position */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div className="font-medium">{emp.department || '—'}</div>
                          <div className="text-xs text-slate-400">{emp.position || '—'}</div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Linked Account */}
                        <td className="py-3.5 px-4">
                          {emp.user ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              {emp.user.username}
                            </span>
                          ) : (
                            <Link
                              href={`/users?employee_id=${emp.id}&full_name=${encodeURIComponent(emp.full_name)}&email=${encodeURIComponent(emp.email || '')}`}
                              className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            >
                              + Cấp tài khoản
                            </Link>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/employees/${emp.id}`}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            >
                              Chi tiết
                            </Link>

                            {canUpdate && (
                              <select
                                value={emp.status}
                                onChange={(e) =>
                                  handleStatusChange(emp, e.target.value as EmployeeStatus)
                                }
                                aria-label="Đổi trạng thái nhân viên"
                                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <option value="ACTIVE">Hoạt động</option>
                                <option value="INACTIVE">Tạm nghỉ</option>
                                <option value="LOCKED">Đã nghỉ</option>
                              </select>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => handleDelete(emp)}
                                title="Xóa nhân viên"
                                className="rounded px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              >
                                Xóa
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

            {/* Pagination Controls */}
            {meta.last_page > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  Hiển thị <span className="font-medium text-slate-700 dark:text-slate-200">{meta.from || 0}</span> -{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.to || 0}</span> trong tổng số{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.total}</span> nhân sự
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={meta.current_page <= 1}
                    className="rounded px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    « Trước
                  </button>

                  {Array.from({ length: meta.last_page }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === meta.last_page || Math.abs(p - meta.current_page) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const hasGap = prev && p - prev > 1;
                      return (
                        <React.Fragment key={p}>
                          {hasGap && <span className="px-1 text-slate-400">...</span>}
                          <button
                            onClick={() => setPage(p)}
                            className={`rounded px-3 py-1.5 border text-xs font-medium ${
                              meta.current_page === p
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                    disabled={meta.current_page >= meta.last_page}
                    className="rounded px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sau »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Thêm nhân viên mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Thêm nhân viên mới
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {modalGeneralError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3.5 border border-rose-200 dark:border-rose-900 text-sm text-rose-800 dark:text-rose-300">
                  {modalGeneralError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.full_name && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.full_name[0]}</p>
                  )}
                </div>

                {/* Employee code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã nhân viên (để trống tự sinh)
                  </label>
                  <input
                    type="text"
                    value={formData.employee_code || ''}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    placeholder="NV-000001"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.employee_code && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.employee_code[0]}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0987654321"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.phone && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.phone[0]}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Địa chỉ email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nhanvien@qlpk.vn"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.email && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.email[0]}</p>
                  )}
                </div>

                {/* Date of birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.date_of_birth && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.date_of_birth[0]}</p>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Giới tính
                  </label>
                  <select
                    value={formData.gender || 'MALE'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' | 'OTHER' })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    list="dept-list"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="VD: Khám bệnh"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <datalist id="dept-list">
                    {DEPARTMENTS.slice(1).map((d) => (
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
                    value={formData.position || ''}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="VD: Bác sĩ chuyên khoa, Điều dưỡng..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Hire Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày vào làm
                  </label>
                  <input
                    type="date"
                    value={formData.hire_date || ''}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EmployeeStatus })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú về văn bằng, chứng chỉ hành nghề, phân công..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{isSubmitting ? 'Đang lưu...' : 'Tạo nhân viên'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
