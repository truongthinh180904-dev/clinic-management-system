'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  checkDuplicatePatients,
  createPatient,
  deletePatient,
  getPatients,
  updatePatientStatus,
} from '@/lib/api/patients';
import {
  CreatePatientInput,
  DuplicateWarning,
  Gender,
  Patient,
  PatientStatus,
} from '@/types/patient';
import { PaginationMeta } from '@/types/auth';
import { toast } from '@/components/ui/toast';
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
import { User, Phone, FileHeart, Users, UserCheck, UserX, UserMinus, Search, X } from 'lucide-react';

const STATUS_MAP: Record<PatientStatus, { label: string; badgeClass: string }> = {
  ACTIVE: {
    label: 'Đang theo dõi',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  INACTIVE: {
    label: 'Tạm ngưng',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  LOCKED: {
    label: 'Đã khóa',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  },
};

const GENDER_LABEL: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

export default function PatientsPage() {
  const { hasPermission, hasRole } = useAuth();
  const canCreate = hasPermission('patients.create') || hasRole('ADMIN') || hasRole('RECEPTIONIST');
  const canUpdate = hasPermission('patients.update') || hasRole('ADMIN') || hasRole('RECEPTIONIST');
  const canDelete = hasPermission('patients.delete') || hasRole('ADMIN');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    from: 0,
    last_page: 1,
    per_page: 10,
    to: 0,
    total: 0,
  });

  const [search, setSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notification banners
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [persistedWarnings, setPersistedWarnings] = useState<DuplicateWarning[] | null>(null);
  const [, startTransition] = useTransition();

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [modalErrors, setModalErrors] = useState<Record<string, string[]> | null>(null);
  const [modalGeneralError, setModalGeneralError] = useState<string | null>(null);
  const [modalDuplicateWarnings, setModalDuplicateWarnings] = useState<DuplicateWarning[]>([]);

  const [formData, setFormData] = useState<CreatePatientInput>({
    patient_code: '',
    full_name: '',
    date_of_birth: '',
    gender: 'MALE',
    phone: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    status: 'ACTIVE',
    notes: '',
  });

  const fetchPatients = async (currentPage = page) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getPatients({
        search: search.trim() || undefined,
        gender: selectedGender || undefined,
        status: selectedStatus || undefined,
        page: currentPage,
        per_page: 10,
      });
      setPatients(res.data || []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải danh sách bệnh nhân.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedGender, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPatients(1);
  };

  const handleStatusChange = async (patient: Patient, newStatus: PatientStatus) => {
    if (!canUpdate) return;
    try {
      await updatePatientStatus(patient.id, newStatus);
      const msg = `Đã cập nhật trạng thái bệnh nhân "${patient.full_name}" thành ${STATUS_MAP[newStatus]?.label || newStatus}.`;
      setActionSuccess(msg);
      toast.success(msg, 'Cập nhật trạng thái');
      setPatients((prev) =>
        prev.map((item) => (item.id === patient.id ? { ...item, status: newStatus } : item))
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái bệnh nhân.';
      toast.error(msg, 'Lỗi cập nhật');
    }
  };

  const handleDelete = async (patient: Patient) => {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân "${patient.full_name}" (${patient.patient_code})?`
    );
    if (!confirmed) return;

    try {
      await deletePatient(patient.id);
      const msg = `Đã xóa thành công hồ sơ bệnh nhân "${patient.full_name}".`;
      setActionSuccess(msg);
      toast.success(msg, 'Xóa bệnh nhân');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPatients(page);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa hồ sơ bệnh nhân.';
      toast.error(msg, 'Lỗi xóa bệnh nhân');
    }
  };

  // Pre-check duplicate records
  const handleCheckDuplicate = async () => {
    const phone = formData.phone?.trim();
    const fullName = formData.full_name?.trim();
    const dob = formData.date_of_birth || undefined;

    if (!phone && (!fullName || !dob)) {
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      const res = await checkDuplicatePatients({
        phone: phone || null,
        full_name: fullName || null,
        date_of_birth: dob || null,
      });

      if (res.data?.duplicate_warnings) {
        setModalDuplicateWarnings(res.data.duplicate_warnings);
      }
    } catch {
      // Non-blocking check error
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      patient_code: '',
      full_name: '',
      date_of_birth: '',
      gender: 'MALE',
      phone: '',
      email: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      status: 'ACTIVE',
      notes: '',
    });
    setModalErrors(null);
    setModalGeneralError(null);
    setModalDuplicateWarnings([]);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalErrors(null);
    setModalGeneralError(null);

    try {
      const payload: CreatePatientInput = {
        patient_code: formData.patient_code?.trim() || undefined,
        full_name: formData.full_name.trim(),
        date_of_birth: formData.date_of_birth || null,
        gender: (formData.gender as Gender) || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        address: formData.address?.trim() || null,
        emergency_contact_name: formData.emergency_contact_name?.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone?.trim() || null,
        status: formData.status || 'ACTIVE',
        notes: formData.notes?.trim() || null,
      };

      const res = await createPatient(payload);
      setIsModalOpen(false);

      if (res.duplicate_warnings && res.duplicate_warnings.length > 0) {
        setPersistedWarnings(res.duplicate_warnings);
        const msg = `Đã tạo hồ sơ bệnh nhân "${res.data.full_name}" (${res.data.patient_code}). Lưu ý: Có cảnh báo trùng lặp thông tin với hồ sơ khác.`;
        setActionSuccess(msg);
        toast.warning(msg, 'Cảnh báo trùng lặp thông tin');
      } else {
        setPersistedWarnings(null);
        const msg = `Đã tạo thành công hồ sơ bệnh nhân "${res.data.full_name}" (Mã BN: ${res.data.patient_code}).`;
        setActionSuccess(msg);
        toast.success(msg, 'Thêm bệnh nhân thành công');
        setTimeout(() => setActionSuccess(null), 5000);
      }

      setPage(1);
      fetchPatients(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setModalGeneralError(err.message);
        toast.error(err.message, 'Lỗi tạo hồ sơ');
        if (err.errors) {
          setModalErrors(err.errors);
        }
      } else {
        setModalGeneralError('Đã xảy ra lỗi không xác định.');
        toast.error('Đã xảy ra lỗi không xác định.', 'Lỗi kết nối');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Block 3: Summary Statistics
  const summaryStats = useMemo(() => {
    const total = meta.total || patients.length;
    const active = patients.filter((p) => p.status === 'ACTIVE').length;
    const inactive = patients.filter((p) => p.status === 'INACTIVE').length;
    const locked = patients.filter((p) => p.status === 'LOCKED').length;
    return [
      {
        title: 'Tổng số bệnh nhân',
        value: total,
        icon: Users,
        variant: 'primary' as const,
        description: 'Tổng hồ sơ trong hệ thống',
      },
      {
        title: 'Đang theo dõi',
        value: active,
        icon: UserCheck,
        variant: 'success' as const,
        description: 'Bệnh nhân đang hoạt động',
      },
      {
        title: 'Tạm ngưng',
        value: inactive,
        icon: UserMinus,
        variant: 'warning' as const,
        description: 'Tạm dừng thăm khám',
      },
      {
        title: 'Đã khóa',
        value: locked,
        icon: UserX,
        variant: 'destructive' as const,
        description: 'Hồ sơ đã khóa',
      },
    ];
  }, [meta.total, patients]);

  const hasActiveFilters = Boolean(search || selectedGender || selectedStatus);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedGender('');
    setSelectedStatus('');
    setPage(1);
    startTransition(() => {
      fetchPatients(1);
    });
  };

  return (
    <div className="space-y-6">
      {/* Block 1 & 2: Page Header & Action Buttons */}
      <PageHeader
        title="Quản lý Bệnh nhân"
        description="Tra cứu thông tin, thêm mới hồ sơ bệnh nhân và theo dõi lịch sử khám bệnh"
        actions={
          canCreate ? (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span>+</span>
              <span>Thêm bệnh nhân mới</span>
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

      {/* Persisted Duplicate Warnings Notification */}
      {persistedWarnings && persistedWarnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <span>⚠️</span>
              <span>Cảnh báo trùng lặp hồ sơ được ghi nhận</span>
            </div>
            <button
              onClick={() => setPersistedWarnings(null)}
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
            >
              Ẩn cảnh báo
            </button>
          </div>
          {persistedWarnings.map((w, idx) => (
            <div key={idx} className="text-xs pl-6 space-y-1">
              <p className="font-medium">• {w.message}</p>
              {w.matched_patients && w.matched_patients.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {w.matched_patients.map((matched) => (
                    <Link
                      key={matched.id}
                      href={`/patients/${matched.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 hover:bg-amber-200 transition-colors font-mono"
                    >
                      <span>🔗 {matched.patient_code} - {matched.full_name}</span>
                      {matched.phone && <span>(SĐT: {matched.phone})</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Block 4 & 5: Thanh tìm kiếm & Bộ lọc đa cấp */}
      <div className="rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm mã BN, họ tên, số điện thoại, email..."
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

          <div className="sm:col-span-2">
            <select
              value={selectedGender}
              onChange={(e) => {
                setSelectedGender(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả giới tính</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
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
              <option value="ACTIVE">Đang theo dõi</option>
              <option value="INACTIVE">Tạm ngưng</option>
              <option value="LOCKED">Đã khóa</option>
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

      {/* Block 6, 7 & 8: Main Table Content, Pagination & States */}
      <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách bệnh nhân...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6">
            <ErrorState message={errorMsg} onRetry={() => fetchPatients(page)} />
          </div>
        ) : patients.length === 0 ? (
          <div className="p-6">
            {hasActiveFilters ? (
              <EmptySearchState query={search} onReset={handleResetFilters} />
            ) : (
              <EmptyDataState
                title="Chưa có hồ sơ bệnh nhân nào"
                description="Chưa có dữ liệu bệnh nhân nào trong cơ sở dữ liệu. Bắt đầu bằng cách thêm hồ sơ bệnh nhân đầu tiên."
                createLabel="+ Thêm bệnh nhân đầu tiên"
                onCreate={canCreate ? handleOpenCreateModal : undefined}
                icon={Users}
              />
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[120px]">Mã BN</th>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[180px]">Họ và tên</th>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[150px]">Số điện thoại / Email</th>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[180px]">Địa chỉ</th>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">Lần khám gần nhất</th>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[120px]">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[180px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {patients.map((patient) => {
                    const statusInfo = STATUS_MAP[patient.status] || STATUS_MAP.ACTIVE;
                    return (
                      <tr
                        key={patient.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Patient Code */}
                        <td className="py-3.5 px-4 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          <Link href={`/patients/${patient.id}`} className="hover:underline">
                            {patient.patient_code}
                          </Link>
                        </td>

                        {/* Full Name & Gender & DOB */}
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/patients/${patient.id}`}
                            className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {patient.full_name}
                          </Link>
                          <div className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">
                            {patient.gender ? GENDER_LABEL[patient.gender] || patient.gender : '—'}
                            {patient.date_of_birth && ` • ${patient.date_of_birth}`}
                          </div>
                        </td>

                        {/* Phone & Email */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="font-mono font-medium">{patient.phone || '—'}</div>
                          {patient.email && (
                            <div className="text-xs text-slate-400">{patient.email}</div>
                          )}
                        </td>

                        {/* Address */}
                        <td
                          className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate"
                          title={patient.address || undefined}
                        >
                          {patient.address || '—'}
                        </td>

                        {/* Last Visit */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                          {patient.last_visit_date || patient.first_visit_date || 'Chưa khám'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <Link
                              href={`/patients/${patient.id}`}
                              className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            >
                              Chi tiết
                            </Link>

                            {canUpdate && (
                              <select
                                value={patient.status}
                                onChange={(e) =>
                                  handleStatusChange(patient, e.target.value as PatientStatus)
                                }
                                aria-label="Đổi trạng thái bệnh nhân"
                                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <option value="ACTIVE">Theo dõi</option>
                                <option value="INACTIVE">Tạm ngưng</option>
                                <option value="LOCKED">Khóa</option>
                              </select>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => handleDelete(patient)}
                                title="Xóa hồ sơ bệnh nhân"
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
                fetchPatients(p);
              }}
              itemLabel="bệnh nhân"
            />
          </>
        )}
      </div>

      {/* Modal: Thêm bệnh nhân mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Thêm hồ sơ bệnh nhân mới
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              {modalGeneralError && (
                <FormAlert
                  type="error"
                  title="Không thể tạo hồ sơ bệnh nhân"
                  message={modalGeneralError}
                  onDismiss={() => setModalGeneralError(null)}
                />
              )}

              {/* Duplicate Warnings Banner in Modal */}
              {modalDuplicateWarnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-4 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                    <span>⚠️</span>
                    <span>Cảnh báo: Hồ sơ trùng lặp có thể đã tồn tại!</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Hệ thống phát hiện các hồ sơ có số điện thoại hoặc họ tên và ngày sinh tương đồng. Bạn vẫn có thể tiếp tục bấm &ldquo;Tạo hồ sơ bệnh nhân&rdquo; nếu đây là bệnh nhân riêng biệt.
                  </p>
                  {modalDuplicateWarnings.map((w, idx) => (
                    <div key={idx} className="text-xs bg-amber-100/60 dark:bg-amber-900/40 p-2.5 rounded-lg space-y-1">
                      <div className="font-medium text-amber-900 dark:text-amber-200">• {w.message}</div>
                      {w.matched_patients?.map((matched) => (
                        <div key={matched.id} className="pl-3 font-mono text-xs text-amber-800 dark:text-amber-300">
                          - Mã: <strong>{matched.patient_code}</strong> | Tên: {matched.full_name} | SĐT: {matched.phone || 'N/A'} | Ngày sinh: {matched.date_of_birth || 'N/A'}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Nhóm 1: Thông tin cá nhân cơ bản */}
              <FormSection
                title="Thông tin định danh cơ bản"
                description="Họ tên, ngày sinh và giới tính phục vụ hồ sơ khám chữa bệnh"
                icon={User}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Họ và tên bệnh nhân"
                    required
                    error={modalErrors?.full_name}
                  >
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      onBlur={handleCheckDuplicate}
                      placeholder="Nguyễn Văn A"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="Mã bệnh nhân"
                    hint="Để trống hệ thống sẽ tự sinh BNxxxxxx"
                    error={modalErrors?.patient_code}
                  >
                    <input
                      type="text"
                      value={formData.patient_code || ''}
                      onChange={(e) => setFormData({ ...formData, patient_code: e.target.value })}
                      placeholder="BN000001"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
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
                      onBlur={handleCheckDuplicate}
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
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </FormField>

                  <FormField
                    label="Trạng thái hồ sơ"
                    required
                    error={modalErrors?.status}
                  >
                    <select
                      value={formData.status || 'ACTIVE'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as PatientStatus })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ACTIVE">Đang theo dõi</option>
                      <option value="INACTIVE">Tạm ngưng</option>
                      <option value="LOCKED">Đã khóa</option>
                    </select>
                  </FormField>
                </div>
              </FormSection>

              {/* Nhóm 2: Thông tin liên hệ & Cư trú */}
              <FormSection
                title="Thông tin liên lạc & Địa chỉ"
                description="Số điện thoại dùng để nhận tin nhắn lịch hẹn và đối chiếu"
                icon={Phone}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Số điện thoại"
                    error={modalErrors?.phone}
                    hint={
                      <button
                        type="button"
                        onClick={handleCheckDuplicate}
                        disabled={isCheckingDuplicate || !formData.phone}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                      >
                        {isCheckingDuplicate ? 'Đang kiểm tra...' : '🔍 Tra cứu trùng số điện thoại'}
                      </button>
                    }
                  >
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      onBlur={handleCheckDuplicate}
                      placeholder="0987654321"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="Email"
                    error={modalErrors?.email}
                  >
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="benhnhan@gmail.com"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="Địa chỉ thường trú"
                    className="sm:col-span-2"
                    error={modalErrors?.address}
                  >
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>
                </div>
              </FormSection>

              {/* Nhóm 3: Người thân & Ghi chú y tế */}
              <FormSection
                title="Người thân khẩn cấp & Tiền sử bệnh"
                description="Thông tin hỗ trợ trường hợp cần báo tin khẩn cấp và dị ứng"
                icon={FileHeart}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Người liên hệ khẩn cấp"
                    error={modalErrors?.emergency_contact_name}
                  >
                    <input
                      type="text"
                      value={formData.emergency_contact_name || ''}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      placeholder="Họ tên người thân (bố/mẹ/vợ/chồng...)"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="SĐT người liên hệ khẩn cấp"
                    error={modalErrors?.emergency_contact_phone}
                  >
                    <input
                      type="tel"
                      value={formData.emergency_contact_phone || ''}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                      placeholder="0912345678"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="Tiền sử dị ứng & Ghi chú chung"
                    className="sm:col-span-2"
                    error={modalErrors?.notes}
                  >
                    <textarea
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Tiền sử dị ứng thuốc (Penicillin, NSAID...), bệnh nền mãn tính, lưu ý tiếp đón..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </FormField>
                </div>
              </FormSection>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
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
                  loadingText="Đang lưu hồ sơ..."
                  submitText="Tạo hồ sơ bệnh nhân"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
