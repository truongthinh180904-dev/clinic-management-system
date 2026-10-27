'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  checkDuplicatePatients,
  deletePatient,
  getPatient,
  updatePatient,
  updatePatientStatus,
} from '@/lib/api/patients';
import { getPatientPackages } from '@/lib/api/packages';
import { PatientPackage } from '@/types/package';
import {
  DuplicateWarning,
  Gender,
  Patient,
  PatientStatus,
  UpdatePatientInput,
} from '@/types/patient';

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

interface PageProps {
  params: Promise<{ id: string }>;
}

function PatientDetailContent({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { hasPermission, hasRole } = useAuth();

  const canUpdate = hasPermission('patients.update') || hasRole('ADMIN') || hasRole('RECEPTIONIST');
  const canDelete = hasPermission('patients.delete') || hasRole('ADMIN');
  const canViewMedical = hasPermission('medical_records.view') || hasRole('ADMIN') || hasRole('DOCTOR');
  const canViewPackages = hasPermission('patient_packages.view') || hasRole('ADMIN') || hasRole('RECEPTIONIST') || hasRole('DOCTOR');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'medical' | 'packages'>('profile');

  // Form State
  const [formData, setFormData] = useState<UpdatePatientInput>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(null);
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  const fetchPackages = async () => {
    setIsLoadingPackages(true);
    try {
      const res = await getPatientPackages(patientId);
      setPatientPackages(res.data);
    } catch {
      // ignore
    } finally {
      setIsLoadingPackages(false);
    }
  };

  const fetchDetail = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getPatient(patientId);
      setPatient(res.data);
      setFormData({
        patient_code: res.data.patient_code || '',
        full_name: res.data.full_name || '',
        date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.slice(0, 10) : '',
        gender: res.data.gender || 'MALE',
        phone: res.data.phone || '',
        email: res.data.email || '',
        address: res.data.address || '',
        emergency_contact_name: res.data.emergency_contact_name || '',
        emergency_contact_phone: res.data.emergency_contact_phone || '',
        status: res.data.status || 'ACTIVE',
        notes: res.data.notes || '',
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải thông tin bệnh nhân.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (activeTab === 'packages') {
      fetchPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, patientId]);

  // Pre-check duplicate records excluding current patient
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
        exclude_patient_id: Number(patientId),
      });

      if (res.data?.duplicate_warnings) {
        setDuplicateWarnings(res.data.duplicate_warnings);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdate) return;
    setIsSaving(true);
    setFormErrors(null);
    setFormGeneralError(null);
    setSaveSuccess(null);

    try {
      const payload: UpdatePatientInput = {
        patient_code: formData.patient_code?.trim() || undefined,
        full_name: formData.full_name?.trim() || '',
        date_of_birth: formData.date_of_birth || null,
        gender: (formData.gender as Gender) || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        address: formData.address?.trim() || null,
        emergency_contact_name: formData.emergency_contact_name?.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone?.trim() || null,
        status: formData.status as PatientStatus,
        notes: formData.notes?.trim() || null,
      };

      const res = await updatePatient(patientId, payload);
      setPatient(res.data);

      if (res.duplicate_warnings && res.duplicate_warnings.length > 0) {
        setDuplicateWarnings(res.duplicate_warnings);
        setSaveSuccess('Đã cập nhật hồ sơ bệnh nhân. Cảnh báo: Phát hiện thông tin trùng khớp với hồ sơ khác trong hệ thống.');
      } else {
        setDuplicateWarnings([]);
        setSaveSuccess('Đã cập nhật thông tin hồ sơ bệnh nhân thành công.');
        setTimeout(() => setSaveSuccess(null), 5000);
      }
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

  const handleStatusChange = async (newStatus: PatientStatus) => {
    if (!canUpdate || !patient) return;
    try {
      await updatePatientStatus(patient.id, newStatus);
      setPatient({ ...patient, status: newStatus });
      setFormData((prev) => ({ ...prev, status: newStatus }));
      setSaveSuccess(`Đã cập nhật trạng thái hồ sơ thành ${STATUS_MAP[newStatus]?.label || newStatus}.`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái.';
      alert(msg);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !patient) return;
    const confirmed = window.confirm(
      `CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân "${patient.full_name}" (${patient.patient_code})? Thao tác này sẽ bị chặn nếu bệnh nhân đã phát sinh lịch hẹn, lượt khám hoặc hóa đơn.`
    );
    if (!confirmed) return;

    try {
      await deletePatient(patient.id);
      alert('Đã xóa hồ sơ bệnh nhân thành công.');
      router.push('/patients');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa hồ sơ bệnh nhân.';
      alert(`Lỗi: ${msg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải hồ sơ bệnh nhân...</p>
      </div>
    );
  }

  if (errorMsg || !patient) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-950 p-8 border border-slate-200 dark:border-slate-800 text-center">
        <span className="text-4xl">⚠️</span>
        <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Không tìm thấy bệnh nhân</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {errorMsg || 'Hồ sơ bệnh nhân không tồn tại hoặc đã bị xóa khỏi hệ thống.'}
        </p>
        <Link
          href="/patients"
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ← Quay lại danh sách bệnh nhân
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[patient.status] || STATUS_MAP.ACTIVE;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/patients" className="hover:text-blue-600 dark:hover:text-blue-400">
            Bệnh nhân
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-900 dark:text-white">
            {patient.full_name} ({patient.patient_code})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/patients"
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ← Quay lại danh sách
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-2xl">
            {patient.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {patient.full_name}
              </h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>Mã BN: <strong className="text-blue-600 dark:text-blue-400">{patient.patient_code}</strong></span>
              <span>•</span>
              <span>Giới tính: {patient.gender ? GENDER_LABEL[patient.gender] || patient.gender : 'Chưa rõ'}</span>
              <span>•</span>
              <span>Ngày sinh: {patient.date_of_birth || 'Chưa cập nhật'}</span>
              <span>•</span>
              <span>SĐT: {patient.phone || 'Chưa có'}</span>
            </div>
          </div>
        </div>

        {canUpdate && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Trạng thái:</span>
            <select
              value={patient.status}
              onChange={(e) => handleStatusChange(e.target.value as PatientStatus)}
              aria-label="Cập nhật trạng thái bệnh nhân"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ACTIVE">Đang theo dõi</option>
              <option value="INACTIVE">Tạm ngưng</option>
              <option value="LOCKED">Đã khóa</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          📋 Thông tin hồ sơ & Liên hệ
        </button>
        <button
          onClick={() => setActiveTab('medical')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'medical'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>🩺 Lịch sử khám & Bệnh án</span>
          {!canViewMedical && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
              Bảo mật
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'packages'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          💊 Gói dịch vụ ({patient.patient_packages_count ?? 0})
        </button>
      </div>

      {/* Action Notification */}
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

      {/* Duplicate Warnings Alert */}
      {duplicateWarnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span>Cảnh báo: Trùng khớp thông tin với hồ sơ bệnh nhân khác!</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Số điện thoại hoặc họ tên và ngày sinh của bệnh nhân này trùng với hồ sơ đã có trong hệ thống.
          </p>
          {duplicateWarnings.map((w, idx) => (
            <div key={idx} className="text-xs bg-amber-100/60 dark:bg-amber-900/40 p-3 rounded-lg space-y-1.5">
              <div className="font-semibold text-amber-900 dark:text-amber-200">• {w.message}</div>
              {w.matched_patients?.map((matched) => (
                <div key={matched.id} className="flex items-center justify-between pl-3 font-mono text-xs">
                  <span>
                    - Mã: <strong>{matched.patient_code}</strong> | {matched.full_name} | SĐT: {matched.phone || 'N/A'}
                  </span>
                  <Link
                    href={`/patients/${matched.id}`}
                    target="_blank"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                  >
                    Xem hồ sơ trùng ↗
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: Profile Edit */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Edit Form (2 cols) */}
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Cập nhật thông tin bệnh nhân
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên bệnh nhân <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canUpdate}
                    value={formData.full_name || ''}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    onBlur={handleCheckDuplicate}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                  {formErrors?.full_name && (
                    <p className="mt-1 text-xs text-rose-500">{formErrors.full_name[0]}</p>
                  )}
                </div>

                {/* Patient Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã bệnh nhân
                  </label>
                  <input
                    type="text"
                    disabled={!canUpdate}
                    value={formData.patient_code || ''}
                    onChange={(e) => setFormData({ ...formData, patient_code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 font-mono"
                  />
                  {formErrors?.patient_code && (
                    <p className="mt-1 text-xs text-rose-500">{formErrors.patient_code[0]}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Số điện thoại
                    </label>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={handleCheckDuplicate}
                        disabled={isCheckingDuplicate || !formData.phone}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                      >
                        {isCheckingDuplicate ? 'Kiểm tra...' : '🔍 Tra cứu trùng'}
                      </button>
                    )}
                  </div>
                  <input
                    type="tel"
                    disabled={!canUpdate}
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={handleCheckDuplicate}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                  {formErrors?.phone && (
                    <p className="mt-1 text-xs text-rose-500">{formErrors.phone[0]}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Địa chỉ email
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
                    onBlur={handleCheckDuplicate}
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

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Địa chỉ thường trú
                  </label>
                  <input
                    type="text"
                    disabled={!canUpdate}
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                {/* Emergency Contact Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Người liên hệ khẩn cấp
                  </label>
                  <input
                    type="text"
                    disabled={!canUpdate}
                    value={formData.emergency_contact_name || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                {/* Emergency Contact Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SĐT người liên hệ khẩn cấp
                  </label>
                  <input
                    type="tel"
                    disabled={!canUpdate}
                    value={formData.emergency_contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái hồ sơ
                  </label>
                  <select
                    disabled={!canUpdate}
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PatientStatus })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
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
                  Tiền sử bệnh & Ghi chú tiếp đón
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

          {/* Right Column: Statistics & Danger Zone */}
          <div className="space-y-6">
            {/* Quick Stats Card */}
            <div className="rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📊</span>
                <span>Thống kê hoạt động</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {patient.visits_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lượt khám</div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {patient.appointments_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lịch hẹn</div>
                </div>

                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {patient.patient_packages_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gói dịch vụ</div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {patient.invoices_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hóa đơn</div>
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between">
                  <span>Khám lần đầu:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {patient.first_visit_date || 'Chưa khám'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Khám gần nhất:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {patient.last_visit_date || 'Chưa khám'}
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-white text-xs mb-2">
                Thời gian khởi tạo
              </h3>
              <div className="flex justify-between">
                <span>Ngày tạo hồ sơ:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {patient.created_at ? new Date(patient.created_at).toLocaleString('vi-VN') : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cập nhật cuối:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {patient.updated_at ? new Date(patient.updated_at).toLocaleString('vi-VN') : '—'}
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
                  Xóa vĩnh viễn hồ sơ bệnh nhân này. Nếu bệnh nhân đã có dữ liệu lịch hẹn, lượt khám, gói hoặc hóa đơn, hệ thống sẽ từ chối để bảo toàn tính toàn vẹn y tế.
                </p>
                <button
                  onClick={handleDelete}
                  className="w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors"
                >
                  Xóa hồ sơ bệnh nhân này
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Medical & Clinical Records (Strict Privacy Protection) */}
      {activeTab === 'medical' && (
        <div className="rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          {!canViewMedical ? (
            /* Acceptance Criterion 2: Do NOT show sensitive medical records to non-clinical roles */
            <div className="p-8 text-center max-w-xl mx-auto space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-2xl font-bold">
                🔒
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Dữ liệu bệnh án được bảo mật
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Tài khoản của bạn không có quyền xem thông tin bệnh án chuyên môn y tế (<code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">medical_records.view</code>).
                Thông tin chẩn đoán, diễn tiến bệnh và chỉ định y khoa chỉ được phép hiển thị cho Bác sĩ điều trị và Quản lý phòng khám nhằm tuân thủ quy định bảo mật hồ sơ sức khỏe.
              </p>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                Nếu bạn cần tiếp nhận bệnh nhân hoặc lập phiếu thu, vui lòng sử dụng quyền Tiếp nhận hoặc Thu ngân tương ứng.
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Hồ sơ bệnh án & Lịch sử khám bệnh
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Khu vực chuyên môn dành cho Bác sĩ và nhân sự y tế có thẩm quyền
                  </p>
                </div>

                <Link
                  href={`/visits?patient_id=${patient.id}`}
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  + Khám bệnh / Tạo lượt khám
                </Link>
              </div>

              {/* Clinical summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Tổng số lượt khám</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {patient.visits_count ?? 0} lượt
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Lần đầu: {patient.first_visit_date || 'N/A'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Lần khám gần nhất</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {patient.last_visit_date || 'Chưa khám'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    Hồ sơ: {patient.patient_code}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Tiền sử / Dị ứng ghi nhận</div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {patient.notes || 'Không ghi nhận tiền sử đặc biệt'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Cập nhật bởi bác sĩ/tiếp đón</div>
                </div>
              </div>

              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-3xl">🩺</span>
                <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  Lịch sử thăm khám bệnh nhân {patient.full_name}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Toàn bộ chẩn đoán ICD, phác đồ điều trị và toa thuốc được quản lý tập trung theo từng lượt khám.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Link
                    href={`/visits?patient_id=${patient.id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Xem danh sách lượt khám của bệnh nhân
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Packages */}
      {activeTab === 'packages' && (
        <div className="rounded-xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Gói dịch vụ đã cấp cho bệnh nhân
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý các gói liệu trình nhiều buổi và số buổi còn lại
              </p>
            </div>

            {canViewPackages && (
              <Link
                href={`/packages?patient_id=${patient.id}`}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                + Cấp gói dịch vụ mới
              </Link>
            )}
          </div>

          {isLoadingPackages ? (
            <div className="p-8 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="mt-2 text-xs text-slate-400">Đang tải danh sách gói của bệnh nhân...</p>
            </div>
          ) : patientPackages.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-3xl">💊</span>
              <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                Chưa có gói dịch vụ nào
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Bệnh nhân chưa đăng ký gói liệu trình nào tại phòng khám.
              </p>
              {canViewPackages && (
                <div className="mt-4">
                  <Link
                    href={`/packages?patient_id=${patient.id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    + Cấp gói đầu tiên cho bệnh nhân
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patientPackages.map((pp) => (
                <div
                  key={pp.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                        {pp.package?.name || `Gói #${pp.package_id}`}
                      </h4>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {pp.package?.package_code}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        pp.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : pp.status === 'COMPLETED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {pp.status === 'ACTIVE'
                        ? 'Đang áp dụng'
                        : pp.status === 'COMPLETED'
                        ? 'Đã hết buổi'
                        : pp.status}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600 dark:text-slate-400">
                        Đã dùng: {pp.used_sessions} / {pp.total_sessions} buổi
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Còn lại: {pp.remaining_sessions} buổi
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (pp.used_sessions / pp.total_sessions) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-slate-800 pt-2">
                    <div>
                      Ngày mua:{' '}
                      <span className="text-slate-900 dark:text-white font-medium">
                        {pp.purchase_date}
                      </span>
                    </div>
                    <div>
                      Hạn dùng:{' '}
                      <span className="text-slate-900 dark:text-white font-medium">
                        {pp.expiry_date}
                      </span>
                    </div>
                    <div className="col-span-2">
                      Giá chốt cấp:{' '}
                      <span className="text-slate-900 dark:text-white font-mono font-medium">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                          pp.price
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PatientDetailResolver({ params }: PageProps) {
  const resolvedParams = use(params);
  return <PatientDetailContent patientId={resolvedParams.id} />;
}

export default function PatientDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải hồ sơ bệnh nhân...</p>
        </div>
      }
    >
      <PatientDetailResolver params={params} />
    </Suspense>
  );
}
