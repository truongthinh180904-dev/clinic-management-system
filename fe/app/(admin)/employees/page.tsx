'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  getNextEmployeeCode,
  updateEmployeeStatus,
} from '@/lib/api/employees';
import {
  CreateEmployeeInput,
  Employee,
  EmployeeStatus,
} from '@/types/employee';
import { PaginationMeta } from '@/types/auth';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import {
  FormField,
  FormSection,
  FormSubmitButton,
  FormAlert,
} from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { EmptySearchState, EmptyDataState, ErrorState } from '@/components/ui/empty-state';
import { User, Briefcase, FileText, UserCog, UserCheck, UserMinus, UserX, Search, X, Sparkles, RefreshCw, Check } from 'lucide-react';

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
  const [suggestedCode, setSuggestedCode] = useState<string>('');
  const [loadingSuggestedCode, setLoadingSuggestedCode] = useState<boolean>(false);

  const fetchSuggestedCode = async () => {
    setLoadingSuggestedCode(true);
    try {
      const res = await getNextEmployeeCode();
      if (res?.data?.suggested_code) {
        setSuggestedCode(res.data.suggested_code);
      }
    } catch (e) {
      console.warn('Could not fetch suggested employee code:', e);
    } finally {
      setLoadingSuggestedCode(false);
    }
  };

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
      const msg = `Đã cập nhật trạng thái nhân viên ${employee.full_name} thành ${STATUS_MAP[newStatus].label}.`;
      setActionSuccess(msg);
      toast.success(msg, 'Cập nhật trạng thái');
      setEmployees((prev) =>
        prev.map((item) => (item.id === employee.id ? { ...item, status: newStatus } : item))
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái.';
      toast.error(msg, 'Lỗi cập nhật');
    }
  };

  // Delete Confirmation State
  const [deleteEmployeeItem, setDeleteEmployeeItem] = useState<Employee | null>(null);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

  const handleDelete = (employee: Employee) => {
    if (!canDelete) return;
    setDeleteEmployeeItem(employee);
  };

  const handleConfirmDelete = async () => {
    if (!deleteEmployeeItem) return;
    setIsDeletingEmployee(true);
    try {
      await deleteEmployee(deleteEmployeeItem.id);
      const msg = `Đã xóa thành công nhân viên ${deleteEmployeeItem.full_name}.`;
      setActionSuccess(msg);
      toast.success(msg, 'Xóa nhân viên');
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteEmployeeItem(null);
      fetchEmployees(page);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa nhân viên.';
      toast.error(msg, 'Lỗi xóa nhân viên');
    } finally {
      setIsDeletingEmployee(false);
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
    setSuggestedCode('');
    setIsModalOpen(true);
    fetchSuggestedCode();
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
      const msg = `Đã tạo thành công nhân viên "${res.data.full_name}" (Mã: ${res.data.employee_code}).`;
      setActionSuccess(msg);
      toast.success(msg, 'Thêm nhân viên thành công');
      setTimeout(() => setActionSuccess(null), 5000);
      setPage(1);
      fetchEmployees(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setModalGeneralError(err.message);
        toast.error(err.message, 'Lỗi tạo nhân viên');
        if (err.errors) {
          setModalErrors(err.errors);
        }
      } else {
        setModalGeneralError('Đã xảy ra lỗi không xác định.');
        toast.error('Đã xảy ra lỗi không xác định.', 'Lỗi hệ thống');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Block 3: Summary Statistics
  const summaryStats = useMemo(() => {
    const total = meta.total || employees.length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const inactive = employees.filter((e) => e.status === 'INACTIVE').length;
    const locked = employees.filter((e) => e.status === 'LOCKED').length;
    return [
      {
        title: 'Tổng số nhân viên',
        value: total,
        icon: UserCog,
        variant: 'primary' as const,
        description: 'Tổng hồ sơ nhân sự',
      },
      {
        title: 'Đang làm việc',
        value: active,
        icon: UserCheck,
        variant: 'success' as const,
        description: 'Nhân viên đang làm việc',
      },
      {
        title: 'Tạm nghỉ',
        value: inactive,
        icon: UserMinus,
        variant: 'warning' as const,
        description: 'Tạm nghỉ phép hoặc thai sản',
      },
      {
        title: 'Đã nghỉ việc',
        value: locked,
        icon: UserX,
        variant: 'destructive' as const,
        description: 'Đã hoàn tất thủ tục thôi việc',
      },
    ];
  }, [meta.total, employees]);

  const hasActiveFilters = Boolean(search || selectedDept || selectedStatus);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('');
    setSelectedStatus('');
    setPage(1);
    startTransition(() => {
      fetchEmployees(1);
    });
  };

  return (
    <div className="space-y-6">
      {/* Block 1 & 2: Page Header & Action Buttons */}
      <PageHeader
        title="Quản lý Nhân sự"
        description="Danh sách bác sĩ, điều dưỡng, lễ tân và nhân viên trong phòng khám"
        actions={
          canCreate ? (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span>+</span>
              <span>Thêm nhân viên mới</span>
            </button>
          ) : undefined
        }
      />

      {/* Block 3: Khối tóm tắt thống kê quan trọng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
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

      {/* Block 4 & 5: Filters & Search */}
      <div className="rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm kiếm mã NV, họ tên, SĐT, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-9 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
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
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700"
                title="Xóa bộ lọc"
              >
                ✕
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Block 6, 7 & 8: Main Content: Table / Loading / Error / Empty */}
      <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách nhân sự...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6">
            <ErrorState message={errorMsg} onRetry={() => fetchEmployees(page)} />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-6">
            {hasActiveFilters ? (
              <EmptySearchState query={search} onReset={handleResetFilters} />
            ) : (
              <EmptyDataState
                title="Chưa có nhân viên nào"
                description="Chưa có dữ liệu nhân sự trên hệ thống. Bắt đầu bằng cách thêm nhân viên đầu tiên."
                createLabel="+ Thêm nhân viên đầu tiên"
                onCreate={canCreate ? handleOpenCreateModal : undefined}
                icon={UserCog}
              />
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

            {/* Block 7: Standard Pagination */}
            <Pagination
              currentPage={meta.current_page}
              totalPages={meta.last_page}
              totalItems={meta.total}
              from={meta.from}
              to={meta.to}
              perPage={meta.per_page}
              onPageChange={(p) => {
                setPage(p);
                fetchEmployees(p);
              }}
              itemLabel="nhân sự"
            />
          </>
        )}
      </div>

      {/* Modal: Thêm nhân viên mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in-0 zoom-in-95 duration-200">
            {/* STICKY HEADER - KHÔNG BAO GIỜ BỊ CHE */}
            <div className="sticky top-0 z-20 shrink-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-blue-600" />
                  Thêm nhân viên mới
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tạo hồ sơ nhân viên, chức danh chuyên môn và thiết lập mã định danh
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Đóng modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* FORM BODY WITH SCROLLABLE CONTENT */}
            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {modalGeneralError && (
                  <FormAlert
                    type="error"
                    title="Không thể tạo nhân viên mới"
                    message={modalGeneralError}
                    onDismiss={() => setModalGeneralError(null)}
                  />
                )}

                {/* Nhóm 1: Thông tin cá nhân */}
                <FormSection
                  title="Thông tin cá nhân & Định danh"
                  description="Họ tên, ngày sinh, giới tính và thông tin liên hệ của nhân sự"
                  icon={User}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Họ và tên nhân viên"
                      required
                      error={modalErrors?.full_name}
                    >
                      <input
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Nguyễn Văn A"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </FormField>

                    {/* MÃ NHÂN VIÊN VỚI GỢI Ý TỰ ĐỘNG TĂNG */}
                    <FormField
                      label="Mã nhân viên"
                      hint="Nhập mã riêng hoặc nhấn mã gợi ý bên dưới để chọn tự động"
                      error={modalErrors?.employee_code}
                    >
                      <div className="space-y-1.5">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={formData.employee_code || ''}
                            onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                            placeholder="VD: NV000001 (để trống tự sinh)"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                          {formData.employee_code && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, employee_code: '' })}
                              className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600"
                              title="Xóa mã đã nhập"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Gợi ý mã tăng tự động tương tác 1-Click */}
                        {suggestedCode ? (
                          <div className="flex items-center flex-wrap gap-1.5 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Mã đề xuất kế tiếp:</span>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, employee_code: suggestedCode })}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono font-bold text-xs transition-all",
                                formData.employee_code === suggestedCode
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700"
                                  : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800 cursor-pointer shadow-2xs active:scale-95"
                              )}
                              title="Nhấn vào đây để tự động điền mã này"
                            >
                              <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                              <span>{suggestedCode}</span>
                              <span className="font-sans text-[10px] font-medium underline ml-1">
                                {formData.employee_code === suggestedCode ? '✓ Đã chọn' : '← Nhấn để chọn'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={fetchSuggestedCode}
                              disabled={loadingSuggestedCode}
                              className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                              title="Tải lại mã gợi ý mới nhất"
                            >
                              <RefreshCw className={cn("h-3 w-3", loadingSuggestedCode && "animate-spin")} />
                            </button>
                          </div>
                        ) : loadingSuggestedCode ? (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                            Đang lấy gợi ý mã nhân viên...
                          </div>
                        ) : null}
                      </div>
                    </FormField>

                    <FormField
                      label="Số điện thoại"
                      error={modalErrors?.phone}
                    >
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="0987654321"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField
                      label="Địa chỉ email"
                      error={modalErrors?.email}
                    >
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="nhanvien@qlpk.vn"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField
                      label="Ngày sinh"
                      error={modalErrors?.date_of_birth}
                    >
                      <input
                        type="date"
                        value={formData.date_of_birth || ''}
                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField
                      label="Giới tính"
                      required
                      error={modalErrors?.gender}
                    >
                      <select
                        value={formData.gender || 'MALE'}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' | 'OTHER' })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </FormField>
                  </div>
                </FormSection>

                {/* Nhóm 2: Vị trí công tác */}
                <FormSection
                  title="Vị trí công tác & Phòng ban"
                  description="Bộ phận, chức danh và tình trạng công tác"
                  icon={Briefcase}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Phòng ban"
                      error={modalErrors?.department}
                    >
                      <input
                        type="text"
                        list="dept-list"
                        value={formData.department || ''}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="VD: Khám bệnh, Dược..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <datalist id="dept-list">
                        {DEPARTMENTS.slice(1).map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </FormField>

                    <FormField
                      label="Chức vụ / Chức danh"
                      error={modalErrors?.position}
                    >
                      <input
                        type="text"
                        value={formData.position || ''}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        placeholder="VD: Bác sĩ chuyên khoa, Điều dưỡng, Dược sĩ..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField
                      label="Ngày vào làm"
                      error={modalErrors?.hire_date}
                    >
                      <input
                        type="date"
                        value={formData.hire_date || ''}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField
                      label="Trạng thái làm việc"
                      required
                      error={modalErrors?.status}
                    >
                      <select
                        value={formData.status || 'ACTIVE'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as EmployeeStatus })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="ACTIVE">Đang làm việc</option>
                        <option value="INACTIVE">Tạm nghỉ</option>
                        <option value="LOCKED">Đã nghỉ việc</option>
                      </select>
                    </FormField>
                  </div>
                </FormSection>

                {/* Nhóm 3: Ghi chú */}
                <FormSection
                  title="Ghi chú hồ sơ"
                  description="Thông tin chứng chỉ hành nghề, bằng cấp chuyên môn nếu có"
                  icon={FileText}
                >
                  <FormField
                    label="Ghi chú bổ sung"
                    error={modalErrors?.notes}
                  >
                    <textarea
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Ghi chú về văn bằng, chứng chỉ hành nghề CCHN, phân công đặc thù..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>
                </FormSection>
              </div>

              {/* STICKY FOOTER - LUÔN HIỂN THỊ CỐ ĐỊNH Ở DƯỚI */}
              <div className="sticky bottom-0 z-20 shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <FormSubmitButton
                  isSubmitting={isSubmitting}
                  loadingText="Đang lưu nhân sự..."
                  submitText="Tạo nhân viên"
                />
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE EMPLOYEE CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={!!deleteEmployeeItem}
        onOpenChange={(open) => {
          if (!open && !isDeletingEmployee) setDeleteEmployeeItem(null);
        }}
        title="Xác nhận xóa hồ sơ nhân viên"
        description={
          deleteEmployeeItem ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa hồ sơ nhân viên{' '}
                <strong className="text-slate-900 dark:text-white">&ldquo;{deleteEmployeeItem.full_name}&rdquo;</strong>{' '}
                (Mã NV: <span className="font-mono text-blue-600 font-semibold">{deleteEmployeeItem.employee_code}</span>)?
              </p>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                ⚠️ Cảnh báo: Thao tác này sẽ xóa hồ sơ nhân sự và vô hiệu hóa các liên kết phân công làm việc.
              </div>
            </div>
          ) : null
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="destructive"
        isLoading={isDeletingEmployee}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteEmployeeItem(null)}
      />
    </div>
  );
}
