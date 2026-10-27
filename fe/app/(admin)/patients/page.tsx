'use client';

import React, { useEffect, useState, useTransition } from 'react';
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
      setActionSuccess(`Đã cập nhật trạng thái bệnh nhân "${patient.full_name}" thành ${STATUS_MAP[newStatus]?.label || newStatus}.`);
      setPatients((prev) =>
        prev.map((item) => (item.id === patient.id ? { ...item, status: newStatus } : item))
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái bệnh nhân.';
      alert(msg);
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
      setActionSuccess(`Đã xóa thành công hồ sơ bệnh nhân "${patient.full_name}".`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPatients(page);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa hồ sơ bệnh nhân.';
      alert(`Lỗi: ${msg}`);
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
        setActionSuccess(
          `Đã tạo hồ sơ bệnh nhân "${res.data.full_name}" (${res.data.patient_code}). Lưu ý: Có cảnh báo trùng lặp thông tin với hồ sơ khác.`
        );
      } else {
        setPersistedWarnings(null);
        setActionSuccess(`Đã tạo thành công hồ sơ bệnh nhân "${res.data.full_name}" (Mã BN: ${res.data.patient_code}).`);
        setTimeout(() => setActionSuccess(null), 5000);
      }

      setPage(1);
      fetchPatients(1);
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
            Quản lý Bệnh nhân
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tra cứu thông tin, thêm mới hồ sơ bệnh nhân và theo dõi lịch sử khám bệnh
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span>+</span>
            <span>Thêm bệnh nhân mới</span>
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

      {/* Search & Filters */}
      <div className="rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="Tìm kiếm mã BN, họ tên, số điện thoại, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
            {(search || selectedGender || selectedStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedGender('');
                  setSelectedStatus('');
                  setPage(1);
                  startTransition(() => {
                    fetchPatients(1);
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

      {/* Main Table Content */}
      <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách bệnh nhân...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xl font-bold">
              !
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">Không thể tải dữ liệu</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
            <button
              onClick={() => fetchPatients(page)}
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Thử lại
            </button>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl">🧑‍🤝‍🧑</span>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Không tìm thấy hồ sơ bệnh nhân nào
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {search || selectedGender || selectedStatus
                ? 'Không có kết quả nào khớp với bộ lọc hoặc từ khóa tìm kiếm.'
                : 'Chưa có dữ liệu bệnh nhân nào trong cơ sở dữ liệu.'}
            </p>
            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Thêm bệnh nhân đầu tiên
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Mã BN</th>
                    <th className="py-3.5 px-4">Họ và tên</th>
                    <th className="py-3.5 px-4">Số điện thoại / Email</th>
                    <th className="py-3.5 px-4">Địa chỉ</th>
                    <th className="py-3.5 px-4">Lần khám gần nhất</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
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
                        <td className="py-3.5 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">
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
                          <div className="text-xs text-slate-400 mt-0.5">
                            {patient.gender ? GENDER_LABEL[patient.gender] || patient.gender : '—'}
                            {patient.date_of_birth && ` • ${patient.date_of_birth}`}
                          </div>
                        </td>

                        {/* Phone & Email */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div className="font-mono font-medium">{patient.phone || '—'}</div>
                          {patient.email && (
                            <div className="text-xs text-slate-400">{patient.email}</div>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {patient.address || '—'}
                        </td>

                        {/* Last Visit */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                          {patient.last_visit_date || patient.first_visit_date || 'Chưa khám'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
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

            {/* Pagination Controls */}
            {meta.last_page > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  Hiển thị <span className="font-medium text-slate-700 dark:text-slate-200">{meta.from || 0}</span> -{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.to || 0}</span> trong tổng số{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.total}</span> bệnh nhân
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

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {modalGeneralError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3.5 border border-rose-200 dark:border-rose-900 text-sm text-rose-800 dark:text-rose-300">
                  {modalGeneralError}
                </div>
              )}

              {/* Duplicate Warnings Banner in Modal */}
              {modalDuplicateWarnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-4 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                    <span>⚠️</span>
                    <span>Cảnh báo: Hồ sơ trùng lặp có thể đã tồn tại!</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Hệ thống phát hiện các hồ sơ có số điện thoại hoặc họ tên và ngày sinh tương đồng. Bạn vẫn có thể tiếp tục bấm &ldquo;Tạo hồ sơ&rdquo; nếu đây là bệnh nhân riêng biệt.
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên bệnh nhân <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    onBlur={handleCheckDuplicate}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.full_name && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.full_name[0]}</p>
                  )}
                </div>

                {/* Patient Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã bệnh nhân (để trống tự sinh BNxxxxxx)
                  </label>
                  <input
                    type="text"
                    value={formData.patient_code || ''}
                    onChange={(e) => setFormData({ ...formData, patient_code: e.target.value })}
                    placeholder="BN000001"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  {modalErrors?.patient_code && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.patient_code[0]}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Số điện thoại
                    </label>
                    <button
                      type="button"
                      onClick={handleCheckDuplicate}
                      disabled={isCheckingDuplicate || !formData.phone}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                    >
                      {isCheckingDuplicate ? 'Đang kiểm tra...' : '🔍 Tra cứu trùng'}
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={handleCheckDuplicate}
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
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="benhnhan@gmail.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {modalErrors?.email && (
                    <p className="mt-1 text-xs text-rose-500">{modalErrors.email[0]}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    onBlur={handleCheckDuplicate}
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
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Địa chỉ thường trú
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Emergency Contact Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Người liên hệ khẩn cấp
                  </label>
                  <input
                    type="text"
                    value={formData.emergency_contact_name || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    placeholder="Họ tên người thân"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Emergency Contact Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SĐT người liên hệ khẩn cấp
                  </label>
                  <input
                    type="tel"
                    value={formData.emergency_contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái hồ sơ
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PatientStatus })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Đang theo dõi</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                    <option value="LOCKED">Đã khóa</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiền sử dị ứng & Ghi chú chung
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tiền sử dị ứng thuốc, bệnh lý nền mạn tính, lưu ý tiếp đón..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Modal Actions */}
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
                  <span>{isSubmitting ? 'Đang lưu...' : 'Tạo hồ sơ bệnh nhân'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
