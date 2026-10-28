'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  FileText,
  Activity,
  Heart,
  ShieldCheck,
  ShieldAlert,
  Stethoscope,
  ChevronRight,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  PlusCircle,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  checkDuplicatePatients,
  deletePatient,
  getPatient,
  getPatientTimeline,
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
  PatientTimelineItem,
  UpdatePatientInput,
} from '@/types/patient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const STATUS_MAP: Record<PatientStatus, { label: string; badgeClass: string }> = {
  ACTIVE: {
    label: 'Đang theo dõi',
    badgeClass:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  INACTIVE: {
    label: 'Tạm ngưng',
    badgeClass:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  LOCKED: {
    label: 'Đã khóa',
    badgeClass:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  },
};

const GENDER_LABEL: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const VISIT_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  SCHEDULED: {
    label: 'Đã đặt hẹn / Chờ khám',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dotClass: 'bg-amber-500 ring-amber-100 dark:ring-amber-950',
  },
  IN_PROGRESS: {
    label: 'Đang thực hiện khám',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    dotClass: 'bg-blue-500 ring-blue-100 dark:ring-blue-950',
  },
  COMPLETED: {
    label: 'Đã hoàn thành ca khám',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-950',
  },
  CANCELLED: {
    label: 'Đã hủy ca khám',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    dotClass: 'bg-rose-500 ring-rose-100 dark:ring-rose-950',
  },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  PAID: {
    label: 'Đã thanh toán',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  },
  PARTIALLY_PAID: {
    label: 'Thanh toán 1 phần',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  },
  UNPAID: {
    label: 'Chưa thanh toán',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  },
  REFUNDED: {
    label: 'Đã hoàn tiền',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  },
};

function calculateAge(dobString: string | null | undefined): string | null {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? `${age} tuổi` : null;
}

function extractBloodType(notes: string | null | undefined): string {
  if (!notes) return 'Chưa xác định';
  const match = notes.match(/nhóm máu\s*[:=]\s*([ABO\+\-]+)/i);
  if (match) return match[1].toUpperCase();
  return 'Chưa xác định';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function PatientDetailContent({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { hasPermission, hasRole } = useAuth();

  const canUpdate =
    hasPermission('patients.update') || hasRole('ADMIN') || hasRole('RECEPTIONIST');
  const canDelete = hasPermission('patients.delete') || hasRole('ADMIN');
  const canViewMedical =
    hasPermission('medical_records.view') || hasRole('ADMIN') || hasRole('DOCTOR');
  const canViewPackages =
    hasPermission('patient_packages.view') ||
    hasRole('ADMIN') ||
    hasRole('RECEPTIONIST') ||
    hasRole('DOCTOR');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab State: 'timeline' (Mặc định cho Bác sĩ) | 'profile' | 'packages'
  const [activeTab, setActiveTab] = useState<'timeline' | 'profile' | 'packages'>('timeline');

  // Form State
  const [formData, setFormData] = useState<UpdatePatientInput>({});
  const [bloodTypeInput, setBloodTypeInput] = useState<string>('Chưa xác định');
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(null);
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);

  // Timeline State
  const [timelineItems, setTimelineItems] = useState<PatientTimelineItem[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineFilterStatus, setTimelineFilterStatus] = useState<string>('ALL');
  const [timelineSearch, setTimelineSearch] = useState<string>('');

  // Packages State
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  // Delete Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Selected Medical Record Detail Modal
  const [selectedVisitRecord, setSelectedVisitRecord] = useState<PatientTimelineItem | null>(null);

  const fetchTimeline = async () => {
    setIsLoadingTimeline(true);
    setTimelineError(null);
    try {
      const res = await getPatientTimeline(patientId);
      if (res.data?.timeline) {
        setTimelineItems(res.data.timeline);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải trục thời gian khám.';
      setTimelineError(msg);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  const fetchPackages = async () => {
    setIsLoadingPackages(true);
    try {
      const res = await getPatientPackages(patientId);
      setPatientPackages(res.data);
    } catch {
      // Non-blocking
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
      setBloodTypeInput(extractBloodType(res.data.notes));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải thông tin bệnh nhân.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (activeTab === 'packages') {
      fetchPackages();
    } else if (activeTab === 'timeline') {
      fetchTimeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, patientId]);

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
      // Append or sync blood type into notes if modified
      let updatedNotes = formData.notes?.trim() || '';
      if (bloodTypeInput && bloodTypeInput !== 'Chưa xác định') {
        if (!updatedNotes.includes('Nhóm máu:')) {
          updatedNotes = updatedNotes ? `${updatedNotes}\nNhóm máu: ${bloodTypeInput}` : `Nhóm máu: ${bloodTypeInput}`;
        } else {
          updatedNotes = updatedNotes.replace(/nhóm máu\s*[:=]\s*[^\n\r]+/i, `Nhóm máu: ${bloodTypeInput}`);
        }
      }

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
        notes: updatedNotes || null,
      };

      const res = await updatePatient(patientId, payload);
      setPatient(res.data);
      setFormData((prev) => ({ ...prev, notes: updatedNotes }));

      if (res.duplicate_warnings && res.duplicate_warnings.length > 0) {
        setDuplicateWarnings(res.duplicate_warnings);
        setSaveSuccess('Đã cập nhật hồ sơ bệnh nhân. Cảnh báo: Phát hiện thông tin trùng khớp với hồ sơ khác.');
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
      setFormGeneralError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!canDelete || !patient) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);

    try {
      await deletePatient(patient.id);
      setIsDeleteDialogOpen(false);
      router.push('/patients');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa hồ sơ bệnh nhân.';
      setDeleteErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Đang tải hồ sơ bệnh nhân và lịch sử y tế...
        </p>
      </div>
    );
  }

  if (errorMsg || !patient) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-950 p-10 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 text-2xl font-bold">
          ⚠️
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          Không tìm thấy hồ sơ bệnh nhân
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {errorMsg || 'Hồ sơ bệnh nhân không tồn tại hoặc đã bị xóa khỏi hệ thống.'}
        </p>
        <div className="mt-6">
          <Link
            href="/patients"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách bệnh nhân</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[patient.status] || STATUS_MAP.ACTIVE;
  const patientAge = calculateAge(patient.date_of_birth);
  const patientBlood = extractBloodType(patient.notes);

  // Filtered timeline items
  const filteredTimeline = timelineItems.filter((item) => {
    const matchStatus =
      timelineFilterStatus === 'ALL' || item.status === timelineFilterStatus;
    const searchLower = timelineSearch.toLowerCase().trim();
    const matchSearch =
      !searchLower ||
      item.visit_code?.toLowerCase().includes(searchLower) ||
      item.service?.name?.toLowerCase().includes(searchLower) ||
      item.doctor?.full_name?.toLowerCase().includes(searchLower) ||
      item.medical_record?.diagnosis?.toLowerCase().includes(searchLower);

    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/patients" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Danh sách bệnh nhân</span>
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {patient.full_name}
          </span>
          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
            ({patient.patient_code})
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/visits?patient_id=${patient.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Tạo lượt khám mới</span>
          </Link>
          <Link
            href={`/appointments?patient_id=${patient.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Đặt lịch hẹn</span>
          </Link>
        </div>
      </div>

      {/* Medical Identity Header Banner */}
      <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left Column: Avatar & Primary Identification */}
          <div className="flex items-start gap-5">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-3xl shadow-md">
                {patient.full_name.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center text-[10px] text-white ${
                  patient.status === 'ACTIVE'
                    ? 'bg-emerald-500'
                    : patient.status === 'LOCKED'
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
                title={statusInfo.label}
              >
                ●
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {patient.full_name}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}>
                  {statusInfo.label}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Mã BN: {patient.patient_code}
                </span>
              </div>

              {/* Core Medical Demographic Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>Giới tính: <strong>{GENDER_LABEL[patient.gender || ''] || patient.gender || 'Chưa rõ'}</strong></span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Sinh: <strong>{patient.date_of_birth || 'Chưa rõ'}</strong>
                    {patientAge && <span className="ml-1 text-slate-500">({patientAge})</span>}
                  </span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-900/60">
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  <span>Nhóm máu: <strong>{patientBlood}</strong></span>
                </span>

                {patient.phone && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono">{patient.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Status Switcher & Medical Safeguard */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {canUpdate && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium pl-1">Trạng thái:</span>
                <select
                  value={patient.status}
                  onChange={(e) => handleStatusChange(e.target.value as PatientStatus)}
                  aria-label="Cập nhật trạng thái bệnh nhân"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ACTIVE">Đang theo dõi (ACTIVE)</option>
                  <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                  <option value="LOCKED">Đã khóa (LOCKED)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Alert Banner: Allergies & Medical Warnings */}
        {patient.notes && (
          <div className="mt-5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-300">
                Lưu ý y khoa & Tiền sử dị ứng:
              </span>
              <p className="mt-0.5 leading-relaxed whitespace-pre-line font-medium">
                {patient.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Trục thời gian lâm sàng ({timelineItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Hồ sơ & Thông tin liên hệ</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`pb-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'packages'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Heart className="h-4 w-4" />
          <span>Gói dịch vụ điều trị ({patient.patient_packages_count ?? 0})</span>
        </button>
      </div>

      {/* Action Notification */}
      {saveSuccess && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {formGeneralError && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-4 border border-rose-200 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-rose-600" />
          <span>{formGeneralError}</span>
        </div>
      )}

      {/* Duplicate Warnings Alert */}
      {duplicateWarnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
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
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs flex items-center gap-1"
                  >
                    <span>Xem hồ sơ trùng</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* TAB 1: CLINICAL CHRONOLOGICAL TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Timeline Filter and Search Toolbar */}
          <div className="rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
                Lọc trạng thái:
              </span>
              {[
                { key: 'ALL', label: `Tất cả (${timelineItems.length})` },
                { key: 'COMPLETED', label: 'Đã hoàn thành' },
                { key: 'IN_PROGRESS', label: 'Đang khám' },
                { key: 'SCHEDULED', label: 'Chờ khám' },
                { key: 'CANCELLED', label: 'Đã hủy' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setTimelineFilterStatus(btn.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    timelineFilterStatus === btn.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã khám, bác sĩ, chẩn đoán..."
                value={timelineSearch}
                onChange={(e) => setTimelineSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Timeline Content */}
          {isLoadingTimeline ? (
            <div className="rounded-xl bg-white dark:bg-slate-950 p-12 border border-slate-200 dark:border-slate-800 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Đang tải trục thời gian lịch sử khám bệnh...
              </p>
            </div>
          ) : timelineError ? (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-6 border border-rose-200 dark:border-rose-800 text-center text-rose-700 dark:text-rose-300 text-sm">
              <p>⚠️ {timelineError}</p>
              <button
                onClick={fetchTimeline}
                className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-rose-700"
              >
                Tải lại
              </button>
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-950 p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-2xl font-bold">
                🩺
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {timelineSearch || timelineFilterStatus !== 'ALL'
                  ? 'Không tìm thấy lượt khám phù hợp bộ lọc'
                  : 'Bệnh nhân chưa có lịch sử khám bệnh nào'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {timelineSearch || timelineFilterStatus !== 'ALL'
                  ? 'Vui lòng thay đổi từ khóa tìm kiếm hoặc bấm Tất cả để xem toàn bộ lịch sử.'
                  : 'Khi bệnh nhân đến tiếp đón hoặc hoàn thành các ca khám, toàn bộ chẩn đoán, phác đồ điều trị và toa thuốc sẽ được hiển thị trên trục thời gian này theo thứ tự giảm dần.'}
              </p>
              <div className="pt-2">
                <Link
                  href={`/visits?patient_id=${patient.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>+ Tiếp nhận lượt khám đầu tiên</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="relative pl-6 md:pl-8 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {filteredTimeline.map((item) => {
                const statusCfg =
                  VISIT_STATUS_CONFIG[item.status] || VISIT_STATUS_CONFIG.SCHEDULED;
                const paymentCfg =
                  PAYMENT_STATUS_CONFIG[item.payment_status] || PAYMENT_STATUS_CONFIG.UNPAID;

                return (
                  <div key={item.id} className="relative group">
                    {/* Timeline Node Marker */}
                    <div
                      className={`absolute -left-6 md:-left-8 top-1.5 h-6 w-6 rounded-full border-4 border-white dark:border-slate-950 ${statusCfg.dotClass} ring-4 transition-transform group-hover:scale-110 flex items-center justify-center text-[10px] text-white`}
                    />

                    {/* Timeline Event Card */}
                    <div className="rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4">
                      {/* Event Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-900 pb-3.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                            {item.visit_code}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badgeClass}`}>
                            {statusCfg.label}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${paymentCfg.badgeClass}`}>
                            {paymentCfg.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatDateTime(item.visit_date)}</span>
                        </div>
                      </div>

                      {/* Event Service & Doctor Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                            Dịch vụ thực hiện:
                          </span>
                          <div className="font-semibold text-slate-900 dark:text-white text-sm">
                            {item.service?.name || 'Khám tổng quát'}
                          </div>
                          <div className="text-slate-500 font-mono">
                            Mã DV: {item.service?.service_code || 'N/A'} • Chi phí:{' '}
                            <strong className="text-slate-700 dark:text-slate-300">
                              {formatCurrency(item.total_amount)}
                            </strong>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                            Bác sĩ phụ trách:
                          </span>
                          <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            <Stethoscope className="h-4 w-4 text-blue-500" />
                            <span>{item.doctor?.full_name || 'Chưa chỉ định bác sĩ'}</span>
                          </div>
                          <div className="text-slate-500 font-mono">
                            Mã NV: {item.doctor?.employee_code || 'N/A'}
                            {item.doctor?.phone && ` • SĐT: ${item.doctor.phone}`}
                          </div>
                        </div>
                      </div>

                      {/* Medical Record Diagnosis (Strict Privacy & Rich Clinical Display) */}
                      {item.medical_record ? (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border-l-4 border-l-blue-600 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 text-xs font-bold">
                                🩺
                              </span>
                              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                                Thông tin bệnh án chuyên môn
                              </span>
                            </div>

                            {item.medical_record.follow_up_date && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                <Calendar className="h-3 w-3" />
                                <span>Tái khám: {item.medical_record.follow_up_date}</span>
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                Chẩn đoán y khoa:
                              </span>
                              <p className="mt-0.5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                                {item.medical_record.diagnosis}
                              </p>
                            </div>

                            {item.medical_record.medical_history && (
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  Diễn tiến bệnh / Triệu chứng lâm sàng:
                                </span>
                                <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {item.medical_record.medical_history}
                                </p>
                              </div>
                            )}

                            {item.medical_record.treatment && (
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  Phác đồ điều trị & Đơn thuốc:
                                </span>
                                <p className="mt-0.5 text-slate-700 dark:text-slate-200 font-mono bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-line leading-relaxed">
                                  {item.medical_record.treatment}
                                </p>
                              </div>
                            )}

                            {item.medical_record.indication && (
                              <div className="text-[11px] text-slate-500">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  Chỉ định cận lâm sàng:
                                </span>{' '}
                                {item.medical_record.indication}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : !canViewMedical ? (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
                          <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <span>
                            Thông tin chẩn đoán và bệnh án được bảo mật. Yêu cầu quyền{' '}
                            <code className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                              medical_records.view
                            </code>{' '}
                            để xem chi tiết.
                          </span>
                        </div>
                      ) : item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS' ? (
                        <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/30 p-3 border border-blue-100 dark:border-blue-900/50 flex items-center justify-between text-xs">
                          <span className="text-blue-700 dark:text-blue-300">
                            Ca khám đang diễn ra, chưa có bệnh án kết luận.
                          </span>
                          <Link
                            href={`/visits?patient_id=${patient.id}`}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span>Vào khám ngay</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 text-xs text-slate-400 italic">
                          Chưa cập nhật bệnh án chi tiết cho lượt khám này.
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900 text-xs">
                        <div className="text-slate-400 font-mono text-[11px]">
                          {item.appointment && (
                            <span>Lịch hẹn liên kết: {item.appointment.appointment_code}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.medical_record && (
                            <button
                              onClick={() => setSelectedVisitRecord(item)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            >
                              Xem toàn văn bệnh án
                            </button>
                          )}
                          <Link
                            href={`/visits?patient_id=${patient.id}`}
                            className="rounded-lg bg-slate-100 dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                          >
                            <span>Chi tiết lượt khám</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROFILE EDIT FORM */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
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

                {/* Blood Type Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nhóm máu
                  </label>
                  <select
                    disabled={!canUpdate}
                    value={bloodTypeInput}
                    onChange={(e) => setBloodTypeInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 font-semibold text-rose-600"
                  >
                    <option value="Chưa xác định">Chưa xác định</option>
                    <option value="O+">O+ (Rh+)</option>
                    <option value="O-">O- (Rh-)</option>
                    <option value="A+">A+ (Rh+)</option>
                    <option value="A-">A- (Rh-)</option>
                    <option value="B+">B+ (Rh+)</option>
                    <option value="B-">B- (Rh-)</option>
                    <option value="AB+">AB+ (Rh+)</option>
                    <option value="AB-">AB- (Rh-)</option>
                  </select>
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
              </div>

              {/* Notes: Tiền sử & Dị ứng */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Tiền sử bệnh & Cảnh báo dị ứng</span>
                </label>
                <textarea
                  rows={4}
                  disabled={!canUpdate}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi rõ dị ứng thuốc (Penicillin, NSAID...), tiền sử tim mạch, huyết áp..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              {canUpdate && (
                <div className="pt-4 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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
            <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span>Thống kê hoạt động</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {patient.visits_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lượt khám</div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {patient.appointments_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lịch hẹn</div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {patient.patient_packages_count ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gói dịch vụ</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
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

            {/* Danger Zone */}
            {canDelete && (
              <div className="rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 p-6 border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>Vùng nguy hiểm</span>
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
                  Xóa vĩnh viễn hồ sơ bệnh nhân. Nếu bệnh nhân đã có dữ liệu lịch hẹn, ca khám, gói hoặc hóa đơn, thao tác sẽ bị chặn để bảo đảm tính toàn vẹn y tế.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="w-full rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
                >
                  Xóa hồ sơ bệnh nhân này
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PACKAGES */}
      {activeTab === 'packages' && (
        <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Gói dịch vụ đã cấp cho bệnh nhân
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý các gói liệu trình nhiều buổi và số buổi còn lại
              </p>
            </div>

            {canViewPackages && (
              <Link
                href={`/packages?patient_id=${patient.id}`}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
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
            <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <span className="text-3xl">💊</span>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Chưa có gói dịch vụ nào
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Bệnh nhân chưa đăng ký gói liệu trình nào tại phòng khám.
              </p>
              {canViewPackages && (
                <div className="pt-2">
                  <Link
                    href={`/packages?patient_id=${patient.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
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
                        {formatCurrency(pp.price)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Full Medical Record Detail Viewer */}
      {selectedVisitRecord && (
        <Dialog open={!!selectedVisitRecord} onOpenChange={(open) => !open && setSelectedVisitRecord(null)}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                <span>Chi tiết Bệnh án Ca khám {selectedVisitRecord.visit_code}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Thời gian khám: {formatDateTime(selectedVisitRecord.visit_date)} • Bác sĩ: {selectedVisitRecord.doctor?.full_name || 'N/A'}
              </DialogDescription>
            </DialogHeader>

            {selectedVisitRecord.medical_record && (
              <div className="space-y-4 py-2 text-xs">
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <span className="font-bold text-blue-900 dark:text-blue-200 uppercase text-[10px] tracking-wider">
                    Chẩn đoán xác định:
                  </span>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {selectedVisitRecord.medical_record.diagnosis}
                  </p>
                </div>

                {selectedVisitRecord.medical_record.medical_history && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Tiền sử & Triệu chứng lâm sàng:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-line">
                      {selectedVisitRecord.medical_record.medical_history}
                    </p>
                  </div>
                )}

                {selectedVisitRecord.medical_record.treatment && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Phác đồ điều trị & Toa thuốc:
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-mono leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-line">
                      {selectedVisitRecord.medical_record.treatment}
                    </p>
                  </div>
                )}

                {selectedVisitRecord.medical_record.indication && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Chỉ định cận lâm sàng:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400">
                      {selectedVisitRecord.medical_record.indication}
                    </p>
                  </div>
                )}

                {selectedVisitRecord.medical_record.result && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Kết quả xét nghiệm / chẩn đoán hình ảnh:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400">
                      {selectedVisitRecord.medical_record.result}
                    </p>
                  </div>
                )}

                {selectedVisitRecord.medical_record.follow_up_date && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                      Hẹn ngày tái khám:
                    </span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                      {selectedVisitRecord.medical_record.follow_up_date}
                    </span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setSelectedVisitRecord(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
              <Link
                href={`/visits?patient_id=${patient.id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Chuyển sang ca khám
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: Delete Patient Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              <span>Xác nhận xóa hồ sơ bệnh nhân</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Hành động này mang tính phá hủy và không thể khôi phục lại hồ sơ.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p>
              Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ bệnh nhân{' '}
              <strong className="text-slate-900 dark:text-white">
                {patient.full_name} ({patient.patient_code})
              </strong>
              ?
            </p>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
              Hệ thống sẽ từ chối xóa nếu bệnh nhân đã phát sinh lịch hẹn, lượt khám lâm sàng hoặc hóa đơn viện phí để bảo đảm tính toàn vẹn y bạ và kế toán.
            </div>

            {deleteErrorMessage && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                ❌ {deleteErrorMessage}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isDeleting && (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>{isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Đang khởi tạo hồ sơ bệnh nhân...</p>
        </div>
      }
    >
      <PatientDetailResolver params={params} />
    </Suspense>
  );
}
