'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { getVisit } from '@/lib/api/visits';
import {
  createVisitMedicalRecord,
  getVisitMedicalRecord,
  getVisitMedicalRecordHistory,
  updateVisitMedicalRecord,
} from '@/lib/api/medical-records';
import { getEmployees } from '@/lib/api/employees';
import { Visit, VISIT_STATUS_MAP } from '@/types/visit';
import {
  CreateMedicalRecordInput,
  MedicalRecord,
  MedicalRecordAuditLog,
  UpdateMedicalRecordInput,
} from '@/types/medical-record';
import { Employee } from '@/types/employee';
import { toast } from '@/components/ui/toast';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HeartPulse,
  Pill,
  Printer,
  RefreshCw,
  Save,
  ShieldAlert,
  Stethoscope,
  User,
  FolderOpen,
} from 'lucide-react';
import { PatientFileManager } from '@/components/patient-files';


interface PageProps {
  params: Promise<{ id: string }>;
}

const COMMON_SYMPTOMS = [
  'Sốt cao (>38.5°C)',
  'Ho có đờm',
  'Ho khan kéo dài',
  'Khó thở nhẹ khi gắng sức',
  'Đau tức ngực',
  'Đau vùng thượng vị',
  'Chóng mặt, hoa mắt',
  'Đau đầu âm ỉ',
  'Mệt mỏi, chán ăn',
  'Dị ứng nổi mề đay',
];

const COMMON_DIAGNOSES = [
  'Viêm họng cấp (J02)',
  'Viêm phế quản cấp (J20)',
  'Viêm amidan cấp (J03)',
  'Trào ngược dạ dày thực quản (K21)',
  'Viêm dạ dày tá tràng cấp (K29)',
  'Tăng huyết áp nguyên phát (I10)',
  'Rối loạn tiền đình (H81)',
  'Nhiễm khuẩn đường hô hấp trên cấp (J06)',
  'Viêm mũi xoang cấp tính (J01)',
  'Rối loạn tiêu hóa chức năng (K59)',
];

const COMMON_INDICATIONS = [
  'Tổng phân tích tế bào máu ngoại vi (CBC)',
  'Sinh hóa máu: Glucose, AST, ALT, Creatinine, Ure',
  'X-quang ngực thẳng (PA)',
  'Siêu âm tổng quát ổ bụng',
  'Nội soi tai mũi họng',
  'Điện tâm đồ thông thường (ECG 12 chuyển đạo)',
  'Xét nghiệm nước tiểu 10 thông số',
];

const COMMON_ADVICES = [
  'Nghỉ ngơi hợp lý, tránh thức khuya, uống nhiều nước ấm (> 2 lít/ngày).',
  'Kiêng đồ ăn cay nóng, nhiều dầu mỡ, hạn chế rượu bia và thuốc lá.',
  'Uống thuốc đúng liều lượng và thời gian theo chỉ dẫn của bác sĩ.',
  'Tái khám ngay lập tức nếu xuất hiện dấu hiệu: sốt cao liên tục không hạ, khó thở hoặc đau ngực dữ dội.',
];

function MedicalRecordContent({ visitId }: { visitId: string }) {
  const router = useRouter();
  const { hasPermission, hasRole, user } = useAuth();

  // Permissions
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

  // State
  const [visit, setVisit] = useState<Visit | null>(null);
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
  const [doctors, setDoctors] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'consultation' | 'preview' | 'history' | 'files'>('consultation');

  // Audit Trail History State
  const [auditHistory, setAuditHistory] = useState<MedicalRecordAuditLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [editReason, setEditReason] = useState('');

  // Form Fields
  const [formData, setFormData] = useState<CreateMedicalRecordInput>({
    doctor_id: null,
    medical_history: '',
    diagnosis: '',
    indication: '',
    result: '',
    treatment: '',
    follow_up_date: '',
  });

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load Audit Trail History
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getVisitMedicalRecordHistory(visitId);
      setAuditHistory(res.data || []);
    } catch (err) {
      console.warn('Could not load medical record audit history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load Visit, Medical Record & Doctors
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Load Visit
      const visitRes = await getVisit(visitId);
      const visitData = visitRes.data;
      setVisit(visitData);

      // 2. Load Medical Record
      let recordData: MedicalRecord | null = null;
      try {
        const recordRes = await getVisitMedicalRecord(visitId);
        recordData = recordRes.data;
        setMedicalRecord(recordData);
        loadHistory();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setMedicalRecord(null);
        } else {
          console.warn('Could not fetch existing medical record:', err);
        }
      }

      // 3. Load Doctors list
      try {
        const empRes = await getEmployees({ per_page: 100, status: 'ACTIVE' });
        setDoctors(empRes.data || []);
      } catch (err) {
        console.warn('Could not fetch doctors list:', err);
      }

      // 4. Initialize Form Data
      if (recordData) {
        setFormData({
          doctor_id: recordData.doctor_id || visitData.employee_id || null,
          medical_history: recordData.medical_history || '',
          diagnosis: recordData.diagnosis || '',
          indication: recordData.indication || '',
          result: recordData.result || '',
          treatment: recordData.treatment || '',
          follow_up_date: recordData.follow_up_date || '',
        });
      } else {
        setFormData({
          doctor_id: visitData.employee_id || user?.employee?.id || null,
          medical_history: '',
          diagnosis: '',
          indication: '',
          result: '',
          treatment: '',
          follow_up_date: '',
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Không thể tải thông tin lượt khám y tế.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  // Helpers to append chips
  const appendToField = (
    field: keyof CreateMedicalRecordInput,
    text: string
  ) => {
    setFormData((prev) => {
      const current = (prev[field] as string) || '';
      if (!current.trim()) {
        return { ...prev, [field]: text };
      }
      if (current.includes(text)) {
        return prev;
      }
      return { ...prev, [field]: `${current.trim()}\n- ${text}` };
    });
  };

  const setFollowUpDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setFormData((prev) => ({ ...prev, follow_up_date: `${yyyy}-${mm}-${dd}` }));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.diagnosis.trim()) {
      setErrors({ diagnosis: 'Vui lòng nhập chẩn đoán bệnh của bác sĩ.' });
      toast.error('Chẩn đoán bệnh là thông tin bắt buộc.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (medicalRecord) {
        // Update existing record
        const payload: UpdateMedicalRecordInput = {
          doctor_id: formData.doctor_id || null,
          diagnosis: formData.diagnosis.trim(),
          medical_history: formData.medical_history?.trim() || null,
          indication: formData.indication?.trim() || null,
          result: formData.result?.trim() || null,
          treatment: formData.treatment?.trim() || null,
          follow_up_date: formData.follow_up_date || null,
          edit_reason: editReason.trim() || undefined,
        };
        const res = await updateVisitMedicalRecord(visitId, payload);
        setMedicalRecord(res.data);
        loadHistory();
        toast.success('Đã cập nhật hồ sơ bệnh án thành công (đã ghi nhận Audit Log).');
      } else {
        // Create new record
        const payload: CreateMedicalRecordInput = {
          doctor_id: formData.doctor_id || null,
          diagnosis: formData.diagnosis.trim(),
          medical_history: formData.medical_history?.trim() || null,
          indication: formData.indication?.trim() || null,
          result: formData.result?.trim() || null,
          treatment: formData.treatment?.trim() || null,
          follow_up_date: formData.follow_up_date || null,
        };
        const res = await createVisitMedicalRecord(visitId, payload);
        setMedicalRecord(res.data);
        loadHistory();
        // Automatically syncs visit status to COMPLETED
        if (visit) {
          setVisit({ ...visit, status: 'COMPLETED' });
        }
        toast.success('Đã lưu hồ sơ bệnh án và hoàn tất lượt khám thành công.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || 'Lỗi khi lưu hồ sơ bệnh án.');
        if (err.errors) {
          const fieldErrors: Record<string, string> = {};
          Object.entries(err.errors).forEach(([k, v]) => {
            fieldErrors[k] = Array.isArray(v) ? v[0] : String(v);
          });
          setErrors(fieldErrors);
        }
      } else {
        toast.error('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const calculateAge = (dobString?: string | null) => {
    if (!dobString) return '—';
    try {
      const birth = new Date(dobString);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
      return `${age} tuổi`;
    } catch {
      return '—';
    }
  };

  if (!canViewMedical) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Quyền truy cập Bệnh án bị giới hạn
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Tài khoản của bạn không có thẩm quyền chuyên môn y tế (<code>medical_records.view</code>).
          Chỉ có Bác sĩ và Quản trị viên phòng khám mới được phép xem và ghi nhận bệnh án điện tử.
        </p>
        <div className="pt-2">
          <Link
            href={`/visits/${visitId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại chi tiết lượt khám</span>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Đang khởi tạo không gian khám bệnh điện tử (EMR)...
        </p>
      </div>
    );
  }

  if (errorMessage || !visit) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-2xl text-center space-y-4">
        <div className="text-4xl text-rose-500">⚠️</div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Không tìm thấy thông tin lượt khám
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {errorMessage || 'Lượt khám không tồn tại hoặc đã bị xóa.'}
        </p>
        <Link
          href="/visits"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về danh sách lượt khám</span>
        </Link>
      </div>
    );
  }

  const statusInfo = VISIT_STATUS_MAP[visit.status] || {
    label: visit.status,
    badgeClass: 'bg-slate-100 text-slate-700',
    icon: '•',
  };

  const selectedDoctor =
    doctors.find((d) => d.id === formData.doctor_id) || visit.employee;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={`/visits/${visit.id}`}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            title="Quay lại lượt khám"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                {visit.visit_code}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}
              >
                <span>{statusInfo.icon}</span>
                <span>{statusInfo.label}</span>
              </span>
              {medicalRecord ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Đã có bệnh án</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <span>Chờ lập bệnh án</span>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-blue-600" />
              <span>Phòng Khám Bệnh Án Điện Tử (EMR)</span>
            </h1>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('consultation')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'consultation'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Khám & Nhập liệu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Xem trước Phiếu Khám
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                loadHistory();
              }}
              className={`px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>📜</span>
              <span>Lịch sử sửa {auditHistory.length > 0 && `(${auditHistory.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Tệp y tế & X-quang</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            title="In phiếu khám bệnh"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>In Phiếu</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 rounded-lg text-xs shadow-sm"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Patient Information Clinical Banner (Print Header & Display) */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800/80 border border-blue-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-2 flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {visit.patient?.full_name || 'Bệnh nhân chưa định danh'}
                </span>
                <span className="px-2 py-0.5 font-mono text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300 rounded">
                  {visit.patient?.patient_code}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Giới tính:{' '}
                  <strong>
                    {visit.patient?.gender === 'MALE'
                      ? 'Nam'
                      : visit.patient?.gender === 'FEMALE'
                        ? 'Nữ'
                        : 'Khác'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Tuổi: <strong>{calculateAge(visit.patient?.date_of_birth)}</strong>
                </span>
                <span>•</span>
                <span>
                  SĐT: <strong>{visit.patient?.phone || 'Chưa có'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Service & Clinical Details */}
          <div className="text-xs space-y-1 border-t md:border-t-0 md:border-l border-blue-200/60 dark:border-slate-700 md:pl-4">
            <span className="text-slate-400 block">Dịch vụ khám chỉ định:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {visit.service?.name || `DV #${visit.service_id}`}
            </span>
            <div className="text-slate-500 font-mono mt-0.5">
              Thời gian tiếp nhận: {new Date(visit.visit_date).toLocaleString('vi-VN')}
            </div>
          </div>

          <div className="text-xs space-y-1 border-t md:border-t-0 md:border-l border-blue-200/60 dark:border-slate-700 md:pl-4">
            <span className="text-slate-400 block">Bác sĩ phụ trách:</span>
            <span className="font-semibold text-blue-700 dark:text-blue-400 text-sm flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4" />
              <span>{selectedDoctor?.full_name || `BS #${visit.employee_id}`}</span>
            </span>
            <div className="text-slate-500">
              {selectedDoctor?.department || 'Chuyên khoa Đa khoa'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab 1: Doctor Consultation Form */}
      {activeTab === 'consultation' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Symptoms & Clinical History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  1. Tiền sử bệnh & Triệu chứng lâm sàng
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-normal">
                Bấm vào nhãn triệu chứng để chèn nhanh
              </span>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_SYMPTOMS.map((symptom) => (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => appendToField('medical_history', symptom)}
                  className="px-2.5 py-1 text-xs rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all font-medium"
                >
                  + {symptom}
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={formData.medical_history || ''}
              onChange={(e) =>
                setFormData({ ...formData, medical_history: e.target.value })
              }
              placeholder="Nhập lý do đến khám, bệnh sử hiện tại, triệu chứng cơ năng, tiền sử dị ứng hoặc bệnh mạn tính..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Card 2: Objective Medical Diagnosis (REQUIRED) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Chẩn đoán y khoa sơ bộ / xác định <span className="text-rose-500">*</span>
                </h3>
              </div>
              <span className="text-xs text-rose-500 font-medium">Bắt buộc</span>
            </div>

            {/* Quick Diagnoses */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_DIAGNOSES.map((diag) => (
                <button
                  key={diag}
                  type="button"
                  onClick={() => appendToField('diagnosis', diag)}
                  className="px-2.5 py-1 text-xs rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all font-medium"
                >
                  + {diag}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={formData.diagnosis}
              onChange={(e) => {
                setFormData({ ...formData, diagnosis: e.target.value });
                if (errors.diagnosis) {
                  setErrors({ ...errors, diagnosis: '' });
                }
              }}
              placeholder="Nhập chẩn đoán xác định, mã ICD-10 hoặc chẩn đoán phân biệt..."
              className={`w-full text-sm rounded-lg border bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed ${
                errors.diagnosis
                  ? 'border-rose-500 ring-1 ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.diagnosis && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {errors.diagnosis}
              </p>
            )}
          </div>

          {/* Card 3: Paraclinical Indications & Results (2 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Indications */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardListIcon className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    3. Chỉ định cận lâm sàng
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_INDICATIONS.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => appendToField('indication', ind)}
                    className="px-2 py-0.5 text-xs rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium"
                  >
                    + {ind.split(' (')[0]}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={formData.indication || ''}
                onChange={(e) =>
                  setFormData({ ...formData, indication: e.target.value })
                }
                placeholder="Ghi nhận các chỉ định xét nghiệm, chụp phim X-quang, siêu âm, nội soi..."
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Results */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    4. Kết quả cận lâm sàng
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-400 pt-1">
                Tóm tắt các chỉ số bất thường hoặc kết luận hình ảnh học
              </p>

              <textarea
                rows={4}
                value={formData.result || ''}
                onChange={(e) =>
                  setFormData({ ...formData, result: e.target.value })
                }
                placeholder="Ví dụ: Bạch cầu 12.5 G/L, CRP 15 mg/L, Hình ảnh thâm nhiễm phế nang đáy phổi phải..."
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>
          </div>

          {/* Card 5: Treatment & Medical Advice */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  5. Phác đồ điều trị, đơn thuốc & Lời dặn
                </h3>
              </div>
            </div>

            {/* Quick Advices */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_ADVICES.map((adv, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => appendToField('treatment', adv)}
                  className="px-2.5 py-1 text-xs rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all font-medium text-left"
                >
                  + Lời dặn {idx + 1}
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              value={formData.treatment || ''}
              onChange={(e) =>
                setFormData({ ...formData, treatment: e.target.value })
              }
              placeholder="Nhập tên thuốc, liều dùng, đường dùng, thời gian dùng thuốc và chế độ chăm sóc dinh dưỡng sinh hoạt..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Card 6: Follow-up & Doctor Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Follow-up date */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  6. Ngày hẹn tái khám (Follow-up)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setFollowUpDays(3)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold"
                >
                  +3 ngày
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDays(5)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold"
                >
                  +5 ngày
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDays(7)}
                  className="px-2.5 py-1 text-xs rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800"
                >
                  +1 tuần
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDays(14)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold"
                >
                  +2 tuần
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDays(30)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold"
                >
                  +1 tháng
                </button>
              </div>

              <div className="pt-1">
                <input
                  type="date"
                  value={formData.follow_up_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, follow_up_date: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Audit Trail Note & Reason (When editing existing record) */}
            {medicalRecord && (
              <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Kiểm toán Y bạ & Lý do sửa đổi (Audit Trail)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      loadHistory();
                    }}
                    className="text-xs text-amber-700 dark:text-amber-300 font-semibold underline hover:no-underline"
                  >
                    Xem toàn bộ lịch sử sửa →
                  </button>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Lượt khám này đã có bệnh án. Mọi nội dung cập nhật sẽ được lưu vết kiểm toán vĩnh viễn theo chuẩn an toàn hồ sơ y khoa.
                </p>
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lý do chỉnh sửa bệnh án:
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="VD: Điều chỉnh phác đồ theo kết quả xét nghiệm máu ngày..."
                    className="w-full text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Doctor in charge */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <User className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Bác sĩ khám & Ký xác nhận
                </h3>
              </div>

              <div className="pt-3">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Bác sĩ thực hiện khám:
                </label>
                <select
                  value={formData.doctor_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      doctor_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Mặc định theo lượt khám --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.full_name} ({doc.employee_code} - {doc.position || 'Bác sĩ'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">
                  Lưu ý: Mọi thao tác lưu bệnh án được lưu vết kiểm toán (Audit Trail) gắn liền với tài khoản bác sĩ.
                </p>
              </div>
            </div>
          </div>

          {/* Sticky Form Action Footer */}
          <div className="sticky bottom-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4">
            <Link
              href={`/visits/${visit.id}`}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Hủy bỏ & Quay lại
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
              >
                Xem trước phiếu khám
              </button>

              {(medicalRecord ? canUpdateMedical : canCreateMedical) && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md hover:shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu bệnh án...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>
                        {medicalRecord
                          ? 'Cập nhật hồ sơ bệnh án'
                          : 'Lưu bệnh án & Kết thúc khám'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Main Tab 2: Standard Printable Medical Record Sheet */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>In Phiếu Khám Bệnh Này</span>
            </button>
          </div>

          <div
            id="printable-record"
            className="bg-white text-slate-900 border border-slate-200 p-8 sm:p-12 rounded-2xl shadow-sm max-w-4xl mx-auto space-y-8 print:border-none print:shadow-none print:p-0"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wide text-blue-900">
                  Phòng Khám Đa Khoa QLPK Clinic
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Địa chỉ: Khu Công nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh
                </p>
                <p className="text-xs text-slate-600">Hotline cấp cứu: 1900 8888 • Email: clinic@qlpk.vn</p>
              </div>
              <div className="text-right text-xs">
                <div className="font-mono font-bold text-sm text-slate-900">
                  Mã lượt: {visit.visit_code}
                </div>
                <div className="font-mono text-slate-500">
                  Mã BN: {visit.patient?.patient_code}
                </div>
                <div className="text-slate-500 mt-1">
                  Ngày in: {new Date().toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
                Phiếu Khám Bệnh Điện Tử
              </h1>
              <p className="text-xs text-slate-500 italic">
                (Lưu hành nội bộ & Cung cấp hồ sơ ngoại trú cho bệnh nhân)
              </p>
            </div>

            {/* Patient Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-y-2 text-xs">
              <div>
                Họ và tên bệnh nhân: <strong className="text-sm uppercase">{visit.patient?.full_name}</strong>
              </div>
              <div>
                Ngày sinh / Tuổi:{' '}
                <strong>
                  {visit.patient?.date_of_birth
                    ? new Date(visit.patient.date_of_birth).toLocaleDateString('vi-VN')
                    : '—'}{' '}
                  ({calculateAge(visit.patient?.date_of_birth)})
                </strong>
              </div>
              <div>
                Giới tính:{' '}
                <strong>
                  {visit.patient?.gender === 'MALE'
                    ? 'Nam'
                    : visit.patient?.gender === 'FEMALE'
                      ? 'Nữ'
                      : 'Khác'}
                </strong>
              </div>
              <div>
                Số điện thoại: <strong>{visit.patient?.phone || '—'}</strong>
              </div>
              <div className="col-span-2">
                Địa chỉ: <strong>{visit.patient?.address || 'TP. Hồ Chí Minh'}</strong>
              </div>
            </div>

            {/* Medical Content Blocks */}
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1">
                  I. Tiền sử & Diễn biến lâm sàng
                </h4>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed pl-2">
                  {formData.medical_history || 'Chưa ghi nhận tiền sử đặc biệt.'}
                </p>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1">
                  II. Chẩn đoán y khoa
                </h4>
                <p className="whitespace-pre-line font-bold text-slate-900 text-sm leading-relaxed pl-2">
                  {formData.diagnosis || 'Chưa hoàn tất chẩn đoán.'}
                </p>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1">
                  III. Cận lâm sàng & Kết quả
                </h4>
                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div>
                    <span className="font-semibold text-slate-600 block">Chỉ định:</span>
                    <p className="whitespace-pre-line text-slate-800">
                      {formData.indication || 'Không có chỉ định bổ sung.'}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600 block">Kết quả ghi nhận:</span>
                    <p className="whitespace-pre-line text-slate-800">
                      {formData.result || 'Trong giới hạn bình thường.'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1">
                  IV. Hướng điều trị & Đơn thuốc
                </h4>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed pl-2 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {formData.treatment || 'Nghỉ ngơi, theo dõi sức khỏe tại nhà.'}
                </p>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-1">
                  V. Hẹn tái khám
                </h4>
                <p className="pl-2 font-semibold text-slate-900">
                  {formData.follow_up_date
                    ? `Tái khám vào ngày: ${new Date(formData.follow_up_date).toLocaleDateString('vi-VN')}`
                    : 'Tái khám khi có dấu hiệu bất thường.'}
                </p>
              </div>
            </div>

            {/* Signature Block */}
            <div className="pt-8 grid grid-cols-2 text-center text-xs">
              <div>
                <p className="font-semibold text-slate-700">Người bệnh / Thân nhân</p>
                <p className="text-slate-400 italic text-[11px]">(Ký và ghi rõ họ tên)</p>
              </div>
              <div className="space-y-14">
                <div>
                  <p className="text-slate-500 italic">
                    TP. Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </p>
                  <p className="font-bold text-slate-800 uppercase mt-1">Bác sĩ khám bệnh</p>
                </div>
                <div className="font-bold text-sm text-slate-900">
                  {selectedDoctor?.full_name || 'Bác sĩ phụ trách'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 3: Medical Record Audit Trail (P3-012) */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📜</span>
                  <span>Nhật ký Kiểm toán & Lịch sử Chỉnh sửa Bệnh án</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Truy vết toàn vẹn dữ liệu lâm sàng y tế, lưu lại mọi lần tạo mới và cập nhật chẩn đoán/phác đồ của bác sĩ.
                </p>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                disabled={isLoadingHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Tải lại</span>
              </button>
            </div>

            <div className="py-6">
              {isLoadingHistory ? (
                <div className="py-12 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent mx-auto"></div>
                  <p className="mt-2 text-xs text-slate-500">Đang tải lịch sử lưu vết kiểm toán...</p>
                </div>
              ) : auditHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Chưa có dữ liệu ghi nhận lưu vết nào cho bệnh án này.
                </div>
              ) : (
                <div className="space-y-6">
                  {auditHistory.map((item) => {
                    const isCreate = item.action === 'create';
                    return (
                      <div
                        key={item.id}
                        className="relative pl-6 sm:pl-8 before:absolute before:left-2 sm:before:left-3 before:top-3 before:bottom-0 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 last:before:hidden"
                      >
                        <div
                          className={`absolute left-0 sm:left-1 top-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 ${
                            isCreate
                              ? 'bg-emerald-500 border-emerald-200'
                              : 'bg-amber-500 border-amber-200'
                          }`}
                        />
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shadow-sm space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] ${
                                  isCreate
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {item.action_label || item.action}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {item.user_name}
                              </span>
                              {item.user_role && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                                  {item.user_role}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-500 text-xs">
                              {new Date(item.created_at).toLocaleString('vi-VN')}
                              {item.ip_address && ` • IP: ${item.ip_address}`}
                            </div>
                          </div>

                          {item.edit_reason && (
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
                              <span className="font-bold">Lý do điều chỉnh:</span> {item.edit_reason}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {item.new_values?.diagnosis && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="block font-bold text-blue-700 dark:text-blue-400 mb-1">
                                  Chẩn đoán xác định:
                                </span>
                                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                                  {item.new_values.diagnosis}
                                </span>
                              </div>
                            )}

                            {item.new_values?.treatment && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                                  Phác đồ & Đơn thuốc:
                                </span>
                                <span className="text-slate-900 dark:text-slate-100 whitespace-pre-line">
                                  {item.new_values.treatment}
                                </span>
                              </div>
                            )}

                            {item.new_values?.indication && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="block font-bold text-purple-700 dark:text-purple-400 mb-1">
                                  Chỉ định cận lâm sàng:
                                </span>
                                <span className="text-slate-900 dark:text-slate-100 whitespace-pre-line">
                                  {item.new_values.indication}
                                </span>
                              </div>
                            )}

                            {item.new_values?.result && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="block font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                                  Kết quả lâm sàng:
                                </span>
                                <span className="text-slate-900 dark:text-slate-100 whitespace-pre-line">
                                  {item.new_values.result}
                                </span>
                              </div>
                            )}

                            {item.new_values?.follow_up_date && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 md:col-span-2">
                                <span className="font-bold text-amber-700 dark:text-amber-400 mr-2">
                                  📅 Hẹn tái khám:
                                </span>
                                <span className="text-slate-900 dark:text-white font-semibold">
                                  {new Date(item.new_values.follow_up_date).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 4: Clinical Files & X-Rays */}
      {activeTab === 'files' && visit && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <PatientFileManager
            patientId={visit.patient_id}
            patientName={visit.patient?.full_name}
            visitId={visit.id}
            title={`Tệp y tế & Chẩn đoán hình ảnh — Ca khám ${visit.visit_code}`}
            canUpload={visit.status !== 'CANCELLED'}
            canDelete={canUpdateMedical || hasRole('ADMIN')}
            canView={true}
          />
        </div>
      )}
    </div>
  );
}

function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

export default function MedicalRecordPage({ params }: PageProps) {
  const resolvedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="py-24 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-2 text-sm text-slate-500">Đang tải bệnh án...</p>
        </div>
      }
    >
      <MedicalRecordContent visitId={resolvedParams.id} />
    </Suspense>
  );
}
