'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  cancelVisit,
  getVisit,
  updateVisitStatus,
} from '@/lib/api/visits';
import {
  createVisitMedicalRecord,
  getVisitMedicalRecord,
  updateVisitMedicalRecord,
} from '@/lib/api/medical-records';
import {
  PAYMENT_STATUS_MAP,
  VISIT_STATUS_MAP,
  Visit,
  VisitStatus,
} from '@/types/visit';
import {
  CreateMedicalRecordInput,
  MedicalRecord,
  UpdateMedicalRecordInput,
} from '@/types/medical-record';

interface PageProps {
  params: Promise<{ id: string }>;
}

function VisitDetailContent({ visitId }: { visitId: string }) {
  const router = useRouter();
  const { hasPermission, hasRole, user } = useAuth();

  // Permissions
  const canUpdateVisit =
    hasPermission('visits.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('DOCTOR') ||
    hasRole('RECEPTIONIST');
  const canCancelVisit =
    hasPermission('visits.cancel') ||
    hasPermission('visits.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST');

  // Medical Record Permissions (Acceptance Criteria #2)
  const canViewMedical =
    hasPermission('medical_records.view') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR');
  const canCreateMedical =
    hasPermission('medical_records.create') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR');
  const canUpdateMedical =
    hasPermission('medical_records.update') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR');

  // Visit Data
  const [visit, setVisit] = useState<Visit | null>(null);
  const [isLoadingVisit, setIsLoadingVisit] = useState(true);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Medical Record Data
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
  const [isLoadingMedical, setIsLoadingMedical] = useState(false);
  const [medicalError, setMedicalError] = useState<string | null>(null);

  // Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<VisitStatus>('IN_PROGRESS');
  const [statusNote, setStatusNote] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Cancel Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Medical Record Form State (Create / Edit)
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [medicalFormData, setMedicalFormData] = useState<CreateMedicalRecordInput>({
    diagnosis: '',
    medical_history: '',
    indication: '',
    result: '',
    treatment: '',
    follow_up_date: '',
  });
  const [isSubmittingMedical, setIsSubmittingMedical] = useState(false);
  const [medicalFormError, setMedicalFormError] = useState<string | null>(null);

  // Load Visit Details
  const loadVisitData = async () => {
    setIsLoadingVisit(true);
    setVisitError(null);
    try {
      const res = await getVisit(visitId);
      setVisit(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setVisitError(err.message);
      } else {
        setVisitError('Không thể tải thông tin lượt khám.');
      }
    } finally {
      setIsLoadingVisit(false);
    }
  };

  // Load Medical Record Details (If user has medical_records.view permission)
  const loadMedicalRecordData = async () => {
    if (!canViewMedical) return;

    setIsLoadingMedical(true);
    setMedicalError(null);
    try {
      const res = await getVisitMedicalRecord(visitId);
      setMedicalRecord(res.data);
    } catch (err) {
      // 404 simply means no record exists yet
      if (err instanceof ApiError && err.status === 404) {
        setMedicalRecord(null);
      } else if (err instanceof ApiError && err.status === 403) {
        setMedicalError('Bạn không có quyền xem bệnh án (403).');
      } else {
        setMedicalRecord(null);
      }
    } finally {
      setIsLoadingMedical(false);
    }
  };

  useEffect(() => {
    loadVisitData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  useEffect(() => {
    if (visit) {
      loadMedicalRecordData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, canViewMedical]);

  // Handle Quick Status Change
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;
    setIsSubmittingStatus(true);
    try {
      await updateVisitStatus(visit.id, targetStatus, statusNote || undefined);
      setSuccessBanner(
        `Đã chuyển trạng thái lượt khám sang ${VISIT_STATUS_MAP[targetStatus]?.label || targetStatus}`
      );
      setIsStatusModalOpen(false);
      setStatusNote('');
      loadVisitData();
    } catch (err) {
      if (err instanceof ApiError) {
        alert(`Lỗi cập nhật: ${err.message}`);
      } else {
        alert('Cập nhật trạng thái thất bại.');
      }
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Handle Cancel Visit
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;
    setIsSubmittingCancel(true);
    try {
      await cancelVisit(visit.id, cancelReason || undefined);
      setSuccessBanner('Đã hủy lượt khám thành công.');
      setIsCancelModalOpen(false);
      setCancelReason('');
      loadVisitData();
    } catch (err) {
      if (err instanceof ApiError) {
        alert(`Lỗi hủy lượt khám: ${err.message}`);
      } else {
        alert('Hủy lượt khám thất bại.');
      }
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Open Create Medical Record Modal
  const handleOpenCreateMedical = () => {
    setIsEditingMedical(false);
    setMedicalFormError(null);
    setMedicalFormData({
      doctor_id: visit?.employee_id || user?.employee?.id || null,
      diagnosis: '',
      medical_history: '',
      indication: '',
      result: '',
      treatment: '',
      follow_up_date: '',
    });
    setIsMedicalModalOpen(true);
  };

  // Open Edit Medical Record Modal
  const handleOpenEditMedical = () => {
    if (!medicalRecord) return;
    setIsEditingMedical(true);
    setMedicalFormError(null);
    setMedicalFormData({
      doctor_id: medicalRecord.doctor_id || visit?.employee_id || null,
      diagnosis: medicalRecord.diagnosis || '',
      medical_history: medicalRecord.medical_history || '',
      indication: medicalRecord.indication || '',
      result: medicalRecord.result || '',
      treatment: medicalRecord.treatment || '',
      follow_up_date: medicalRecord.follow_up_date || '',
    });
    setIsMedicalModalOpen(true);
  };

  // Submit Medical Record
  const handleSubmitMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setMedicalFormError(null);

    if (!medicalFormData.diagnosis.trim()) {
      setMedicalFormError('Vui lòng nhập chẩn đoán bệnh.');
      return;
    }

    setIsSubmittingMedical(true);
    try {
      if (isEditingMedical) {
        const payload: UpdateMedicalRecordInput = {
          doctor_id: medicalFormData.doctor_id,
          diagnosis: medicalFormData.diagnosis.trim(),
          medical_history: medicalFormData.medical_history?.trim() || null,
          indication: medicalFormData.indication?.trim() || null,
          result: medicalFormData.result?.trim() || null,
          treatment: medicalFormData.treatment?.trim() || null,
          follow_up_date: medicalFormData.follow_up_date || null,
        };
        const res = await updateVisitMedicalRecord(visitId, payload);
        setMedicalRecord(res.data);
        setSuccessBanner('Đã cập nhật hồ sơ bệnh án thành công.');
      } else {
        const payload: CreateMedicalRecordInput = {
          doctor_id: medicalFormData.doctor_id,
          diagnosis: medicalFormData.diagnosis.trim(),
          medical_history: medicalFormData.medical_history?.trim() || null,
          indication: medicalFormData.indication?.trim() || null,
          result: medicalFormData.result?.trim() || null,
          treatment: medicalFormData.treatment?.trim() || null,
          follow_up_date: medicalFormData.follow_up_date || null,
        };
        const res = await createVisitMedicalRecord(visitId, payload);
        setMedicalRecord(res.data);
        setSuccessBanner('Đã tạo hồ sơ bệnh án thành công.');
      }
      setIsMedicalModalOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setMedicalFormError(err.message || 'Lỗi lưu hồ sơ bệnh án.');
      } else {
        setMedicalFormError('Không thể lưu hồ sơ bệnh án.');
      }
    } finally {
      setIsSubmittingMedical(false);
    }
  };

  // Currency Formatter
  const formatMoney = (val?: number | null) => {
    if (val === null || val === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val);
  };

  // Date Formatter
  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  if (isLoadingVisit) {
    return (
      <div className="p-16 flex flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500">Đang tải thông tin lượt khám...</p>
      </div>
    );
  }

  if (visitError || !visit) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Không tìm thấy lượt khám
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {visitError || 'Lượt khám không tồn tại hoặc đã bị xóa.'}
        </p>
        <Link
          href="/visits"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/visits" className="hover:underline">
              Lượt khám
            </Link>
            <span>/</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {visit.visit_code}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Chi tiết Lượt khám #{visit.visit_code}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}
            >
              <span>{statusInfo.icon}</span>
              <span>{statusInfo.label}</span>
            </span>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${paymentInfo.badgeClass}`}
            >
              {paymentInfo.label}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canUpdateVisit && visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED' && (
            <button
              onClick={() => {
                setTargetStatus(
                  visit.status === 'SCHEDULED' ? 'IN_PROGRESS' : 'COMPLETED'
                );
                setIsStatusModalOpen(true);
              }}
              className="px-3.5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Đổi trạng thái
            </button>
          )}

          {canCancelVisit && visit.status !== 'CANCELLED' && visit.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                setCancelReason('');
                setIsCancelModalOpen(true);
              }}
              className="px-3.5 py-2 text-sm font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-lg transition-colors"
            >
              Hủy lượt khám
            </button>
          )}

          <Link
            href="/visits"
            className="px-3.5 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Quay lại
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Patient & Visit Overview (1 col) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Patient Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span>🧑‍🤝‍🧑</span>
                <span>Thông tin Bệnh nhân</span>
              </h2>
              {visit.patient?.id && (
                <Link
                  href={`/patients/${visit.patient.id}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Xem hồ sơ →
                </Link>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-base">
                  {visit.patient?.full_name || `BN #${visit.patient_id}`}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Mã BN: {visit.patient?.patient_code}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <span className="block text-slate-400">Giới tính:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {visit.patient?.gender === 'MALE'
                      ? 'Nam'
                      : visit.patient?.gender === 'FEMALE'
                      ? 'Nữ'
                      : visit.patient?.gender || 'Khác'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Ngày sinh:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {visit.patient?.date_of_birth || 'Không rõ'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-slate-400">Số điện thoại:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {visit.patient?.phone || 'Chưa cập nhật'}
                  </span>
                </div>
                {visit.patient?.address && (
                  <div className="col-span-2">
                    <span className="block text-slate-400">Địa chỉ:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {visit.patient.address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attending Doctor / Staff Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span>🩺</span>
              <span>Bác sĩ phụ trách</span>
            </h2>

            <div className="space-y-1 text-sm">
              <div className="font-semibold text-slate-900 dark:text-white">
                {visit.employee?.full_name || `BS #${visit.employee_id}`}
              </div>
              <div className="text-xs text-slate-500">
                Mã NV: {visit.employee?.employee_code} • {visit.employee?.position || 'Bác sĩ'}
              </div>
              {visit.employee?.department && (
                <div className="text-xs text-slate-500">
                  Chuyên khoa / Khoa: {visit.employee.department}
                </div>
              )}
            </div>
          </div>

          {/* Package Info Card (if package is used) */}
          {visit.patient_package_id && (
            <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <span>📦</span>
                <span>Gói dịch vụ áp dụng</span>
              </h2>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {visit.patient_package?.package?.name || `Gói #${visit.patient_package_id}`}
              </div>
              <div className="text-xs text-purple-800 dark:text-purple-300 font-mono">
                Số buổi còn lại: {visit.patient_package?.remaining_sessions} /{' '}
                {visit.patient_package?.total_sessions} buổi
              </div>
              {visit.patient_package?.expiry_date && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Hạn sử dụng: {new Date(visit.patient_package.expiry_date).toLocaleDateString('vi-VN')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Visit Details & Medical Record (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Visit & Billing Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span>📋</span>
              <span>Thông tin Khám & Viện phí</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-400">Ngày giờ tiếp nhận:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(visit.visit_date)}
                </span>
              </div>

              <div>
                <span className="block text-xs text-slate-400">Dịch vụ:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {visit.service?.name || `DV #${visit.service_id}`}
                </span>
              </div>

              <div>
                <span className="block text-xs text-slate-400">Số lượng:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {visit.quantity} lượt/buổi
                </span>
              </div>

              <div>
                <span className="block text-xs text-slate-400">Đơn giá:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {formatMoney(visit.unit_price)}
                </span>
              </div>

              <div>
                <span className="block text-xs text-slate-400">Giảm giá:</span>
                <span className="font-mono text-rose-600">
                  {formatMoney(visit.discount_amount)}
                </span>
              </div>

              <div>
                <span className="block text-xs text-slate-400">Tổng thanh toán:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-base">
                  {formatMoney(visit.total_amount)}
                </span>
              </div>
            </div>

            {visit.notes && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-500">Ghi chú tiếp nhận: </span>
                <span className="text-slate-700 dark:text-slate-300">{visit.notes}</span>
              </div>
            )}
          </div>

          {/* Medical Record Section (CRITICAL ACCEPTANCE CRITERIA) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🩺</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Hồ sơ Bệnh án (Medical Record)
                </h2>
              </div>

              {/* Action buttons if user has medical permissions */}
              {canViewMedical && (
                <div>
                  {medicalRecord ? (
                    canUpdateMedical && (
                      <button
                        onClick={handleOpenEditMedical}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
                      >
                        ✏️ Chỉnh sửa bệnh án
                      </button>
                    )
                  ) : (
                    canCreateMedical && visit.status !== 'CANCELLED' && (
                      <button
                        onClick={handleOpenCreateMedical}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                      >
                        ➕ Lập hồ sơ bệnh án
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Privacy Check: Role without medical_records.view permission */}
            {!canViewMedical ? (
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <div className="text-3xl">🔒</div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Khu vực Bệnh án được bảo mật
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Tài khoản của bạn không có quyền y tế (<code>medical_records.view</code>). Dữ liệu chẩn đoán bệnh án, triệu chứng lâm sàng và chỉ định điều trị được bảo mật tuyệt đối theo chính sách phân quyền phòng khám.
                </p>
              </div>
            ) : isLoadingMedical ? (
              <div className="py-8 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto"></div>
                <p className="mt-2 text-xs text-slate-500">Đang tải hồ sơ bệnh án...</p>
              </div>
            ) : medicalError ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 text-xs">
                {medicalError}
              </div>
            ) : !medicalRecord ? (
              /* No record yet */
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-3xl">📝</div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Lượt khám này chưa có hồ sơ bệnh án
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {visit.status === 'CANCELLED'
                    ? 'Lượt khám đã hủy, không thể tạo hồ sơ bệnh án.'
                    : 'Bác sĩ phụ trách có thể nhấn nút "Lập hồ sơ bệnh án" để ghi nhận chẩn đoán và hướng điều trị cho bệnh nhân.'}
                </p>
                {canCreateMedical && visit.status !== 'CANCELLED' && (
                  <button
                    onClick={handleOpenCreateMedical}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <span>➕</span>
                    <span>Tạo hồ sơ bệnh án ngay</span>
                  </button>
                )}
              </div>
            ) : (
              /* Medical Record Display */
              <div className="space-y-4 text-sm">
                {/* Diagnosis Banner */}
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="block text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1">
                    Chẩn đoán xác định (Diagnosis)
                  </span>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {medicalRecord.diagnosis}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {medicalRecord.medical_history && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="block text-xs font-semibold text-slate-500 mb-1">
                        Tiền sử bệnh (Medical History)
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line text-xs">
                        {medicalRecord.medical_history}
                      </p>
                    </div>
                  )}

                  {medicalRecord.indication && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="block text-xs font-semibold text-slate-500 mb-1">
                        Chỉ định cận lâm sàng (Indication)
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line text-xs">
                        {medicalRecord.indication}
                      </p>
                    </div>
                  )}

                  {medicalRecord.result && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="block text-xs font-semibold text-slate-500 mb-1">
                        Kết quả khám / Xét nghiệm (Result)
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line text-xs">
                        {medicalRecord.result}
                      </p>
                    </div>
                  )}

                  {medicalRecord.treatment && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="block text-xs font-semibold text-slate-500 mb-1">
                        Hướng điều trị & Đơn thuốc (Treatment)
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line text-xs">
                        {medicalRecord.treatment}
                      </p>
                    </div>
                  )}
                </div>

                {/* Follow-up & Doctor Info */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                  <div>
                    {medicalRecord.follow_up_date ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                        <span>📅 Hẹn tái khám:</span>
                        <strong>
                          {new Date(medicalRecord.follow_up_date).toLocaleDateString('vi-VN')}
                        </strong>
                      </span>
                    ) : (
                      <span>Không hẹn ngày tái khám</span>
                    )}
                  </div>
                  <div className="font-mono">
                    Ghi nhận bởi: {medicalRecord.doctor?.full_name || 'Bác sĩ phụ trách'} •{' '}
                    {formatDate(medicalRecord.created_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Cập nhật trạng thái lượt khám #{visit.visit_code}
            </h3>
            <form onSubmit={handleConfirmStatusChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Trạng thái mới
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as VisitStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SCHEDULED">SCHEDULED - Đã lên lịch</option>
                  <option value="IN_PROGRESS">IN_PROGRESS - Đang khám</option>
                  <option value="COMPLETED">COMPLETED - Hoàn thành khám</option>
                  <option value="CANCELLED">CANCELLED - Hủy lượt khám</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Ghi chú cập nhật
                </label>
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Nhập ghi chú chuyển trạng thái nếu có..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmittingStatus ? 'Đang lưu...' : 'Lưu trạng thái'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Visit Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400 mb-2">
              Hủy lượt khám #{visit.visit_code}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Lưu ý: Nếu lượt khám có sử dụng gói dịch vụ, lượt sử dụng sẽ được hoàn trả tự động vào gói của bệnh nhân.
            </p>
            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Lý do hủy <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy lượt khám..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingCancel}
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel || !cancelReason.trim()}
                  className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmittingCancel ? 'Đang hủy...' : 'Xác nhận hủy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Medical Record Form Modal (Create or Edit) */}
      {isMedicalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {isEditingMedical ? 'Chỉnh sửa Hồ sơ Bệnh án' : 'Lập Hồ sơ Bệnh án Mới'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Lượt khám: #{visit.visit_code} • Bệnh nhân: {visit.patient?.full_name}
            </p>

            {medicalFormError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium">
                ⚠️ {medicalFormError}
              </div>
            )}

            <form onSubmit={handleSubmitMedicalRecord} className="space-y-4">
              {/* Diagnosis (Required) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Chẩn đoán xác định <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={medicalFormData.diagnosis}
                  onChange={(e) =>
                    setMedicalFormData({ ...medicalFormData, diagnosis: e.target.value })
                  }
                  placeholder="Nhập chẩn đoán y khoa, mã bệnh ICD hoặc kết luận lâm sàng..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Medical History */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Tiền sử bệnh & Triệu chứng khởi phát
                </label>
                <textarea
                  rows={2}
                  value={medicalFormData.medical_history || ''}
                  onChange={(e) =>
                    setMedicalFormData({
                      ...medicalFormData,
                      medical_history: e.target.value,
                    })
                  }
                  placeholder="Tiền sử dị ứng, bệnh mạn tính, diễn tiến triệu chứng..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Indication */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Chỉ định cận lâm sàng & Dịch vụ đi kèm
                </label>
                <textarea
                  rows={2}
                  value={medicalFormData.indication || ''}
                  onChange={(e) =>
                    setMedicalFormData({
                      ...medicalFormData,
                      indication: e.target.value,
                    })
                  }
                  placeholder="Chỉ định xét nghiệm máu, X-quang, siêu âm..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Result */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Kết quả khám & Cận lâm sàng
                </label>
                <textarea
                  rows={2}
                  value={medicalFormData.result || ''}
                  onChange={(e) =>
                    setMedicalFormData({
                      ...medicalFormData,
                      result: e.target.value,
                    })
                  }
                  placeholder="Ghi nhận các chỉ số sinh hiệu, kết quả hình ảnh hoặc xét nghiệm..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Treatment */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Hướng điều trị & Đơn thuốc
                </label>
                <textarea
                  rows={3}
                  value={medicalFormData.treatment || ''}
                  onChange={(e) =>
                    setMedicalFormData({
                      ...medicalFormData,
                      treatment: e.target.value,
                    })
                  }
                  placeholder="Phác đồ điều trị, danh mục thuốc kê đơn, liều lượng và lời dặn..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Ngày hẹn tái khám (tùy chọn)
                </label>
                <input
                  type="date"
                  value={medicalFormData.follow_up_date || ''}
                  onChange={(e) =>
                    setMedicalFormData({
                      ...medicalFormData,
                      follow_up_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingMedical}
                  onClick={() => setIsMedicalModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMedical}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingMedical ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Lưu hồ sơ bệnh án</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitDetailResolver({ params }: PageProps) {
  const resolvedParams = use(params);
  return <VisitDetailContent visitId={resolvedParams.id} />;
}

export default function VisitDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-16 flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
        </div>
      }
    >
      <VisitDetailResolver params={params} />
    </Suspense>
  );
}
