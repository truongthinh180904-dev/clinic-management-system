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
import { getInvoices, createInvoice, updateInvoice } from '@/lib/api/invoices';
import { createInventoryTransaction, getProducts } from '@/lib/api/inventory';
import { getPatientTimeline } from '@/lib/api/patients';
import { Visit, VISIT_STATUS_MAP } from '@/types/visit';
import {
  CreateMedicalRecordInput,
  MedicalRecord,
  MedicalRecordAuditLog,
  UpdateMedicalRecordInput,
} from '@/types/medical-record';
import { Employee } from '@/types/employee';
import { PatientTimelineItem } from '@/types/patient';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileCheck,
  FileText,
  HeartPulse,
  History,
  Minus,
  Pill,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Trash2,
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

export interface ClinicMedication {
  id: string;
  product_code: string;
  name: string;
  unit: string;
  unit_price: number;
  current_stock: number;
  category: string;
  default_dosage: string;
  indication: string;
}

export interface PrescribedDrug {
  id: string;
  product_code: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  dosage: string;
  notes?: string;
}

export const CLINIC_MEDICATIONS: ClinicMedication[] = [
  {
    id: 'MED-001',
    product_code: 'PRD-000001',
    name: 'Paracetamol 500mg (Hạ sốt, giảm đau)',
    unit: 'Viên',
    unit_price: 1500,
    current_stock: 450,
    category: 'Hạ sốt & Giảm đau',
    default_dosage: 'Uống 1 viên khi sốt > 38.5°C hoặc đau nhức, cách 4-6 tiếng (tối đa 4 viên/ngày)',
    indication: 'Hạ sốt cảm cúm, giảm đau đầu, đau cơ',
  },
  {
    id: 'MED-002',
    product_code: 'PRD-000002',
    name: 'Augmentin 1g (Amoxicillin + Clavulanate)',
    unit: 'Viên',
    unit_price: 18000,
    current_stock: 120,
    category: 'Kháng sinh',
    default_dosage: 'Uống 1 viên x 2 lần/ngày sau ăn (sáng 1 viên - tối 1 viên, cách 12 giờ)',
    indication: 'Nhiễm khuẩn đường hô hấp trên/dưới, viêm xoang, viêm họng',
  },
  {
    id: 'MED-003',
    product_code: 'PRD-000003',
    name: 'Amoxicillin 500mg',
    unit: 'Viên',
    unit_price: 2500,
    current_stock: 320,
    category: 'Kháng sinh',
    default_dosage: 'Uống 1 viên x 3 lần/ngày sau các bữa ăn chính',
    indication: 'Viêm họng cấp, viêm amidan, nhiễm khuẩn răng miệng',
  },
  {
    id: 'MED-004',
    product_code: 'PRD-000004',
    name: 'Alpha Choay (Chymotrypsin kháng viêm phù nề)',
    unit: 'Viên',
    unit_price: 4000,
    current_stock: 260,
    category: 'Kháng viêm',
    default_dosage: 'Ngậm dưới lưỡi 2 viên x 2 lần/ngày sau các bữa ăn',
    indication: 'Giảm phù nề, sưng đau sau chấn thương, viêm đường hô hấp',
  },
  {
    id: 'MED-005',
    product_code: 'PRD-000005',
    name: 'Ibuprofen 400mg (Giảm đau, kháng viêm NSAID)',
    unit: 'Viên',
    unit_price: 3000,
    current_stock: 190,
    category: 'Hạ sốt & Giảm đau',
    default_dosage: 'Uống 1 viên x 2 lần/ngày sau khi ăn no (sáng 1 - chiều 1)',
    indication: 'Giảm đau răng, đau khớp, đau cơ, chống viêm',
  },
  {
    id: 'MED-006',
    product_code: 'PRD-000006',
    name: 'Omeprazole 20mg (Ức chế acid dạ dày)',
    unit: 'Viên',
    unit_price: 3500,
    current_stock: 215,
    category: 'Dạ dày & Tiêu hóa',
    default_dosage: 'Uống 1 viên vào buổi sáng trước khi ăn 30 phút',
    indication: 'Trào ngược dạ dày thực quản (GERD), viêm loét dạ dày tá tràng',
  },
  {
    id: 'MED-007',
    product_code: 'PRD-000007',
    name: 'Phosphalugel (Gel nhôm phosphat chữ P)',
    unit: 'Gói',
    unit_price: 6000,
    current_stock: 95,
    category: 'Dạ dày & Tiêu hóa',
    default_dosage: 'Uống 1 gói khi đau rát thượng vị hoặc trước bữa ăn 30 phút',
    indication: 'Bảo vệ niêm mạc dạ dày, giảm ợ chua, nóng rát thượng vị',
  },
  {
    id: 'MED-008',
    product_code: 'PRD-000008',
    name: 'Cetirizine 10mg (Chống dị ứng, kháng Histamin)',
    unit: 'Viên',
    unit_price: 2000,
    current_stock: 180,
    category: 'Dị ứng & Da liễu',
    default_dosage: 'Uống 1 viên vào buổi tối sau ăn hoặc trước khi ngủ',
    indication: 'Viêm mũi dị ứng, nổi mề đay, ngứa phát ban',
  },
  {
    id: 'MED-009',
    product_code: 'PRD-000009',
    name: 'Dextromethorphan 15mg (Giảm ho khan)',
    unit: 'Viên',
    unit_price: 2000,
    current_stock: 140,
    category: 'Hô hấp & Trị ho',
    default_dosage: 'Uống 1 viên x 3 lần/ngày sau các bữa ăn',
    indication: 'Trị ho khan do cảm cúm, kích ứng phế quản',
  },
  {
    id: 'MED-010',
    product_code: 'PRD-000010',
    name: 'Men vi sinh Enterogermina (2 tỷ bào tử)',
    unit: 'Ống',
    unit_price: 12000,
    current_stock: 85,
    category: 'Dạ dày & Tiêu hóa',
    default_dosage: 'Uống 1 ống x 2 lần/ngày sau bữa ăn chính',
    indication: 'Hỗ trợ rối loạn tiêu hóa, phục hồi hệ khuẩn ruột sau kháng sinh',
  },
  {
    id: 'MED-011',
    product_code: 'PRD-000011',
    name: 'Bột pha bù nước Oresol 245mg',
    unit: 'Gói',
    unit_price: 5000,
    current_stock: 350,
    category: 'Bù nước & Điện giải',
    default_dosage: 'Pha 1 gói với 200ml nước ấm đun sôi để nguội, uống rải rác trong ngày',
    indication: 'Bù nước và chất điện giải khi sốt cao, tiêu chảy hoặc nôn',
  },
  {
    id: 'MED-012',
    product_code: 'PRD-000012',
    name: 'Nước súc miệng Chlorhexidine 0.12%',
    unit: 'Chai',
    unit_price: 45000,
    current_stock: 45,
    category: 'Nha khoa',
    default_dosage: 'Súc miệng 15ml nguyên chất trong 30 giây x 2 lần/ngày sau đánh răng',
    indication: 'Sát khuẩn khoang miệng, chống viêm nướu, sau lấy cao răng',
  },
  {
    id: 'MED-013',
    product_code: 'PRD-000013',
    name: 'Vitamin C 500mg (Tăng sức đề kháng)',
    unit: 'Viên',
    unit_price: 1000,
    current_stock: 500,
    category: 'Vitamin & Bổ dưỡng',
    default_dosage: 'Uống 1 viên vào buổi sáng sau bữa ăn no',
    indication: 'Tăng cường sức đề kháng và phục hồi thể trạng',
  },
  {
    id: 'MED-014',
    product_code: 'PRD-000014',
    name: 'Spiramycin + Metronidazole (Rodogyl)',
    unit: 'Viên',
    unit_price: 4500,
    current_stock: 110,
    category: 'Nha khoa',
    default_dosage: 'Uống 2 viên x 2 lần/ngày sau bữa ăn chính',
    indication: 'Nhiễm trùng răng miệng, viêm nha chu, sau nhổ răng',
  },
];

export const CLINIC_RX_PRESETS = [
  {
    name: 'Cảm cúm & Sốt siêu vi',
    category: 'Hô hấp',
    drugs: [
      { code: 'PRD-000001', qty: 10, dosage: 'Uống 1 viên khi sốt > 38.5°C hoặc đau nhức, cách 4-6 tiếng' },
      { code: 'PRD-000008', qty: 7, dosage: 'Uống 1 viên vào buổi tối trước khi đi ngủ' },
      { code: 'PRD-000013', qty: 10, dosage: 'Uống 1 viên vào buổi sáng sau bữa ăn no' },
      { code: 'PRD-000011', qty: 3, dosage: 'Pha 1 gói với 200ml nước ấm uống rải rác trong ngày' },
    ],
  },
  {
    name: 'Viêm họng & Nhiễm khuẩn hô hấp',
    category: 'Hô hấp',
    drugs: [
      { code: 'PRD-000002', qty: 14, dosage: 'Uống 1 viên x 2 lần/ngày sau ăn (sáng 1 - tối 1, cách 12h)' },
      { code: 'PRD-000004', qty: 20, dosage: 'Ngậm dưới lưỡi 2 viên x 2 lần/ngày sau ăn' },
      { code: 'PRD-000001', qty: 10, dosage: 'Uống 1 viên khi đau họng nhiều hoặc sốt > 38.5°C' },
    ],
  },
  {
    name: 'Viêm dạ dày & Trào ngược (GERD)',
    category: 'Tiêu hóa',
    drugs: [
      { code: 'PRD-000006', qty: 14, dosage: 'Uống 1 viên vào buổi sáng trước khi ăn 30 phút' },
      { code: 'PRD-000007', qty: 14, dosage: 'Uống 1 gói khi đau rát thượng vị hoặc trước bữa ăn 30 phút' },
      { code: 'PRD-000010', qty: 10, dosage: 'Uống 1 ống x 2 lần/ngày sau bữa ăn' },
    ],
  },
  {
    name: 'Nha khoa / Sau lấy cao răng, nhổ răng',
    category: 'Nha khoa',
    drugs: [
      { code: 'PRD-000014', qty: 20, dosage: 'Uống 2 viên x 2 lần/ngày sau bữa ăn chính' },
      { code: 'PRD-000005', qty: 10, dosage: 'Uống 1 viên sau khi ăn no khi đau buốt' },
      { code: 'PRD-000012', qty: 1, dosage: 'Súc miệng 15ml x 2 lần/ngày sau khi đánh răng' },
    ],
  },
  {
    name: 'Dị ứng, mề đay & Ngứa da',
    category: 'Dị ứng',
    drugs: [
      { code: 'PRD-000008', qty: 10, dosage: 'Uống 1 viên vào buổi tối sau ăn hoặc trước khi ngủ' },
      { code: 'PRD-000013', qty: 10, dosage: 'Uống 1 viên vào buổi sáng sau ăn' },
    ],
  },
];

// Helper to parse treatment text back to PrescribedDrug[] and advice notes
function parsePrescriptionFromTreatment(treatmentText?: string | null): {
  drugs: PrescribedDrug[];
  advice: string;
} {
  if (!treatmentText) return { drugs: [], advice: '' };

  const drugs: PrescribedDrug[] = [];
  let advice = '';

  if (treatmentText.includes('[LỜI DẶN BÁC SĨ]')) {
    const parts = treatmentText.split('[LỜI DẶN BÁC SĨ]');
    advice = parts[1]?.trim() || '';
  }

  const lines = treatmentText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Example: "1. Paracetamol 500mg (PRD-000001): 20 Viên x 1.500 ₫ = 30.000 ₫"
    const match = line.match(/^\d+\.\s+(.*?)\s+\((.*?)\):\s+(\d+)\s+(.*?)\s+x\s+([\d.,]+)\s*₫\s*=\s*([\d.,]+)\s*₫/);
    if (match) {
      const [, name, code, qtyStr, unit, priceStr, totalStr] = match;
      const unitPrice = Number(priceStr.replace(/\D/g, '')) || 0;
      const qty = Number(qtyStr) || 1;
      const totalPrice = Number(totalStr.replace(/\D/g, '')) || qty * unitPrice;

      let dosage = 'Theo chỉ dẫn của bác sĩ';
      if (i + 1 < lines.length && lines[i + 1].includes('Liều dùng:')) {
        dosage = lines[i + 1].replace(/.*Liều dùng:\s*/, '').trim();
      }

      drugs.push({
        id: `rx-loaded-${Date.now()}-${drugs.length}`,
        product_code: code,
        name,
        unit,
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        dosage,
      });
    }
  }

  return { drugs, advice };
}

function MedicalRecordContent({ visitId }: { visitId: string }) {
  const router = useRouter();
  const { hasPermission, hasRole, user } = useAuth();

  // State
  const [visit, setVisit] = useState<Visit | null>(null);
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
  const [doctors, setDoctors] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'consultation' | 'preview' | 'history' | 'files' | 'past_visits'>('consultation');

  // Visit Invoice & Paid Lock
  const [visitInvoice, setVisitInvoice] = useState<any>(null);
  const [isRecordLocked, setIsRecordLocked] = useState(false);

  // Patient Longitudinal Clinical Timeline
  const [patientTimeline, setPatientTimeline] = useState<PatientTimelineItem[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Doctor Isolation & Clinical Permissions
  const isSuperUser = hasRole('ADMIN') || hasRole('MANAGER') || Boolean((user as any)?.is_super_admin);
  const isAssignedDoctor = !visit?.employee_id || !user?.employee?.id || (Number(user.employee.id) === Number(visit.employee_id));
  const canDoctorOperate = isSuperUser || isAssignedDoctor;

  const canViewMedical =
    hasPermission('medical_records.view') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR');
  const canCreateMedical =
    (hasPermission('medical_records.create') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR')) && canDoctorOperate;
  const canUpdateMedical =
    (hasPermission('medical_records.update') ||
    hasRole('ADMIN') ||
    hasRole('DOCTOR')) && canDoctorOperate;

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

  // Load Patient Clinical Timeline
  const loadPatientTimelineData = async (patientId: number | string) => {
    setIsLoadingTimeline(true);
    try {
      const res = await getPatientTimeline(patientId);
      setPatientTimeline(res.data?.timeline || []);
    } catch (err) {
      console.warn('Could not load patient timeline:', err);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  // Re-prescribe: 1-Click Copy Prescription from Past Visit into Current Visit
  const handleCopyPrescriptionFromPastVisit = (pastVisit: PatientTimelineItem) => {
    if (isRecordLocked) {
      toast.error('Ca khám hiện tại đã khóa do đã tất toán viện phí (PAID), không thể chỉnh sửa đơn thuốc.');
      return;
    }
    const parsed = parsePrescriptionFromTreatment(pastVisit.medical_record?.treatment);
    if (!parsed.drugs || parsed.drugs.length === 0) {
      toast.warning('Lần khám này không có thông tin đơn thuốc để sao chép.');
      return;
    }
    setPrescribedDrugs(parsed.drugs);
    if (parsed.advice) {
      setDoctorAdviceNotes(parsed.advice);
    }
    syncTreatmentFromTable(parsed.drugs, parsed.advice || doctorAdviceNotes);
    setActiveTab('consultation');
    toast.success(`Đã sao chép thành công ${parsed.drugs.length} loại thuốc từ ca khám ngày ${pastVisit.visit_date} vào đơn hiện tại!`);
  };

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

      // Check invoice status to enforce paid locking
      try {
        const invRes = await getInvoices({ visit_id: Number(visitId) });
        const activeInv = invRes.data?.find((i) => i.status !== 'CANCELLED');
        setVisitInvoice(activeInv || null);
        if ((activeInv?.status === 'PAID' || visitData.payment_status === 'PAID') && !isSuperUser) {
          setIsRecordLocked(true);
        }
      } catch (invErr) {
        console.warn('Could not check invoice for paid status lock:', invErr);
      }

      // Load patient longitudinal timeline
      if (visitData.patient_id) {
        loadPatientTimelineData(visitData.patient_id);
      }

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

      // 3b. Load live warehouse products to sync real stock into clinic medications
      try {
        const prodRes = await getProducts({ per_page: 100, status: 'ACTIVE' });
        const liveProducts = prodRes.data || [];
        if (liveProducts.length > 0) {
          setMedicationsList((prev) => {
            return prev.map((med) => {
              const matched = liveProducts.find(
                (p) =>
                  p.product_code === med.product_code ||
                  p.name.toLowerCase().includes(med.name.toLowerCase().split(' ')[0])
              );
              if (matched) {
                return {
                  ...med,
                  id: String(matched.id),
                  unit: matched.unit || med.unit,
                  current_stock: Number(matched.current_stock ?? 0),
                };
              }
              return med;
            });
          });
        }
      } catch (prodErr) {
        console.warn('Could not load warehouse products:', prodErr);
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

        // Restore prescribed drugs and advice notes if treatment is available
        if (recordData.treatment) {
          const parsed = parsePrescriptionFromTreatment(recordData.treatment);
          if (parsed.drugs.length > 0) {
            setPrescribedDrugs(parsed.drugs);
          }
          if (parsed.advice) {
            setDoctorAdviceNotes(parsed.advice);
          }
        }
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

  // Dedicated Prescription Table State & Handlers
  const [medicationsList, setMedicationsList] = useState<ClinicMedication[]>(CLINIC_MEDICATIONS);
  const [prescribedDrugs, setPrescribedDrugs] = useState<PrescribedDrug[]>([]);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [selectedMedCategory, setSelectedMedCategory] = useState<string>('ALL');
  const [doctorAdviceNotes, setDoctorAdviceNotes] = useState<string>('');
  const [isDrugPickerOpen, setIsDrugPickerOpen] = useState(true);

  // Helper to sync table changes into the treatment text field
  const syncTreatmentFromTable = (
    drugs: PrescribedDrug[],
    advice: string = doctorAdviceNotes
  ) => {
    let text = '';
    if (drugs.length > 0) {
      const totalRxPrice = drugs.reduce((sum, d) => sum + (d.total_price || 0), 0);
      const drugLines = drugs.map(
        (d, idx) =>
          `${idx + 1}. ${d.name} (${d.product_code}): ${d.quantity} ${d.unit} x ${formatCurrency(d.unit_price)} = ${formatCurrency(d.total_price)}\n   — Liều dùng: ${d.dosage}`
      );
      text += `[BẢNG ĐƠN THUỐC ĐIỀU TRỊ]\n${drugLines.join('\n')}\n=> TỔNG CỘNG TIỀN THUỐC: ${formatCurrency(totalRxPrice)}`;
    }
    if (advice.trim()) {
      text += text ? `\n\n[LỜI DẶN BÁC SĨ]\n${advice.trim()}` : `[LỜI DẶN BÁC SĨ]\n${advice.trim()}`;
    }
    setFormData((prev) => ({ ...prev, treatment: text }));
  };

  // Add drug from clinic catalog into table
  const handleAddMedicationToRx = (med: ClinicMedication, qty = 10) => {
    if (med.current_stock <= 0) {
      toast.warning(`Thuốc "${med.name}" hiện đã hết hàng trong kho dược! Vui lòng liên hệ Dược sĩ kiểm tra nhập thêm.`);
    }

    const existingIndex = prescribedDrugs.findIndex((d) => d.product_code === med.product_code);
    let updated: PrescribedDrug[];
    if (existingIndex >= 0) {
      updated = [...prescribedDrugs];
      const newQty = updated[existingIndex].quantity + qty;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        total_price: newQty * updated[existingIndex].unit_price,
      };
      toast.success(`Đã tăng ${med.name} lên ${newQty} ${med.unit}!`);
    } else {
      const newDrug: PrescribedDrug = {
        id: `rx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product_code: med.product_code,
        name: med.name,
        unit: med.unit,
        quantity: qty,
        unit_price: med.unit_price,
        total_price: qty * med.unit_price,
        dosage: med.default_dosage,
      };
      updated = [...prescribedDrugs, newDrug];
      toast.success(`Đã thêm ${med.name} (${qty} ${med.unit}) vào bảng đơn thuốc!`);
    }
    setPrescribedDrugs(updated);
    syncTreatmentFromTable(updated);
  };

  // Change drug quantity in table
  const handleUpdateDrugQuantity = (id: string, deltaOrValue: number, isAbsolute = false) => {
    const updated = prescribedDrugs.map((d) => {
      if (d.id !== id) return d;
      const nextQty = isAbsolute ? Math.max(1, deltaOrValue) : Math.max(1, d.quantity + deltaOrValue);
      return {
        ...d,
        quantity: nextQty,
        total_price: nextQty * d.unit_price,
      };
    });
    setPrescribedDrugs(updated);
    syncTreatmentFromTable(updated);
  };

  // Change drug dosage in table
  const handleUpdateDrugDosage = (id: string, newDosage: string) => {
    const updated = prescribedDrugs.map((d) =>
      d.id === id ? { ...d, dosage: newDosage } : d
    );
    setPrescribedDrugs(updated);
    syncTreatmentFromTable(updated);
  };

  // Remove drug row from table
  const handleRemoveDrug = (id: string) => {
    const target = prescribedDrugs.find((d) => d.id === id);
    const updated = prescribedDrugs.filter((d) => d.id !== id);
    setPrescribedDrugs(updated);
    syncTreatmentFromTable(updated);
    if (target) {
      toast.info(`Đã xóa ${target.name} khỏi đơn thuốc.`);
    }
  };

  // 1-Click Clinical Preset Loader
  const handleApplyPreset = (preset: (typeof CLINIC_RX_PRESETS)[0]) => {
    const newItems: PrescribedDrug[] = preset.drugs.map((p, idx) => {
      const found = CLINIC_MEDICATIONS.find((m) => m.product_code === p.code);
      const name = found ? found.name : `Thuốc #${p.code}`;
      const unit = found ? found.unit : 'Viên';
      const price = found ? found.unit_price : 3000;
      return {
        id: `rx-preset-${Date.now()}-${idx}`,
        product_code: p.code,
        name,
        unit,
        quantity: p.qty,
        unit_price: price,
        total_price: p.qty * price,
        dosage: p.dosage,
      };
    });

    setPrescribedDrugs(newItems);
    syncTreatmentFromTable(newItems);
    toast.success(`Đã tải toàn bộ ${newItems.length} thuốc của "${preset.name}" vào bảng!`);
  };

  // Clear all drugs
  const handleClearPrescription = () => {
    setPrescribedDrugs([]);
    syncTreatmentFromTable([], doctorAdviceNotes);
    toast.info('Đã xóa trắng danh sách thuốc.');
  };

  // Update doctor advice
  const handleUpdateDoctorAdvice = (text: string) => {
    setDoctorAdviceNotes(text);
    syncTreatmentFromTable(prescribedDrugs, text);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (isRecordLocked) {
      toast.error('Ca khám này đã được tất toán viện phí (PAID). Bệnh án và đơn thuốc đã bị khóa để bảo vệ tính toàn vẹn số liệu.');
      return;
    }

    if (!canDoctorOperate) {
      toast.error('Ca khám này do bác sĩ khác phụ trách. Bạn không có quyền can thiệp hoặc lưu bệnh án.');
      return;
    }

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

        // Automatically sync or create Invoice for this visit (combining Service + Drugs)
        try {
          const invSubtotal = servicePrice + totalDrugPrice;
          const invDiscount = discountAmount;
          const invRes = await getInvoices({ visit_id: Number(visitId) });
          const existingInv = invRes.data?.find((i) => i.status !== 'CANCELLED');

          if (existingInv) {
            if (existingInv.status !== 'PAID') {
              await updateInvoice(existingInv.id, {
                subtotal_amount: invSubtotal,
                discount_amount: invDiscount,
              });
            }
          } else {
            await createInvoice({
              patient_id: visit?.patient_id || undefined,
              visit_id: Number(visitId),
              subtotal_amount: invSubtotal,
              discount_amount: invDiscount,
              issued_at: new Date().toISOString().slice(0, 10),
            });
          }
        } catch (invErr) {
          console.warn('Could not auto-sync invoice for visit:', invErr);
        }

        // Auto deduct stock in Pharmacy inventory for all prescribed drugs
        if (prescribedDrugs.length > 0) {
          try {
            for (const drug of prescribedDrugs) {
              const prodRes = await getProducts({ search: drug.product_code });
              let foundProduct = prodRes.data?.find((p) => p.product_code === drug.product_code);
              if (!foundProduct) {
                const byNameRes = await getProducts({ search: drug.name.split(' ')[0] });
                foundProduct = byNameRes.data?.[0];
              }
              if (foundProduct) {
                await createInventoryTransaction({
                  product_id: foundProduct.id,
                  transaction_type: 'OUT',
                  quantity: drug.quantity,
                  reference_type: 'PRESCRIPTION',
                  reference_id: Number(visitId),
                  transaction_date: new Date().toISOString(),
                });
              }
            }
          } catch (invErr) {
            console.warn('Lỗi xuất kho tự động cho đơn thuốc:', invErr);
          }
        }

        toast.success('Đã cập nhật bệnh án, đồng bộ viện phí & tự động cập nhật tồn kho thuốc!');
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

        // Automatically create Invoice for this visit (combining Service + Drugs)
        try {
          const invSubtotal = servicePrice + totalDrugPrice;
          const invDiscount = discountAmount;
          const invRes = await getInvoices({ visit_id: Number(visitId) });
          const existingInv = invRes.data?.find((i) => i.status !== 'CANCELLED');

          if (existingInv) {
            if (existingInv.status !== 'PAID') {
              await updateInvoice(existingInv.id, {
                subtotal_amount: invSubtotal,
                discount_amount: invDiscount,
              });
            }
          } else {
            await createInvoice({
              patient_id: visit?.patient_id || undefined,
              visit_id: Number(visitId),
              subtotal_amount: invSubtotal,
              discount_amount: invDiscount,
              issued_at: new Date().toISOString().slice(0, 10),
            });
          }
        } catch (invErr) {
          console.warn('Could not auto-create invoice for visit:', invErr);
        }

        // Auto deduct stock in Pharmacy inventory for all prescribed drugs
        if (prescribedDrugs.length > 0) {
          try {
            for (const drug of prescribedDrugs) {
              const prodRes = await getProducts({ search: drug.product_code });
              let foundProduct = prodRes.data?.find((p) => p.product_code === drug.product_code);
              if (!foundProduct) {
                const byNameRes = await getProducts({ search: drug.name.split(' ')[0] });
                foundProduct = byNameRes.data?.[0];
              }
              if (foundProduct) {
                await createInventoryTransaction({
                  product_id: foundProduct.id,
                  transaction_type: 'OUT',
                  quantity: drug.quantity,
                  reference_type: 'PRESCRIPTION',
                  reference_id: Number(visitId),
                  transaction_date: new Date().toISOString(),
                });
              }
            }
          } catch (invErr) {
            console.warn('Lỗi xuất kho tự động cho đơn thuốc:', invErr);
          }
        }

        toast.success('Đã lưu bệnh án, trừ kho thuốc & đồng bộ Hóa đơn viện phí sẵn sàng tại Quầy Thu Ngân!');
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

  // Real-time financial calculations (Service Fee + Prescription Drugs - Discount)
  const totalDrugPrice = prescribedDrugs.reduce((sum, d) => sum + (d.total_price || 0), 0);
  const isPackageVisit = Boolean(visit.patient_package_id);
  const servicePrice = isPackageVisit
    ? 0
    : Number(visit.total_amount) || Number(visit.unit_price) || 0;
  const discountAmount = Number(visit.discount_amount) || 0;
  const grandTotalCost = Math.max(0, servicePrice + totalDrugPrice - discountAmount);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header Card: Title, Status, Action & Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 print:hidden">
        {/* Row 1: Back Button, Title, Status Badges & Quick Primary Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <Link
              href={`/visits/${visit.id}`}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors shadow-xs"
              title="Quay lại chi tiết ca khám"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Hồ Sơ Bệnh Án Điện Tử (EMR)
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                    {visit.visit_code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium ${statusInfo.badgeClass}`}
                  >
                    <span>{statusInfo.icon}</span>
                    <span>{statusInfo.label}</span>
                  </span>
                  {medicalRecord ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã có bệnh án</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Chờ bác sĩ khám & lập bệnh án</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Primary Actions: Quầy Thu Ngân, In Phiếu & Làm mới */}
          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
            <Link
              href={`/invoices?visit_id=${visit.id}&patient_id=${visit.patient_id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs hover:shadow transition-all"
              title="Chuyển sang Quầy Thu Ngân để thu tiền viện phí ca khám này"
            >
              <Receipt className="w-4 h-4" />
              <span>Quầy Thu Ngân</span>
            </Link>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs hover:shadow transition-all"
              title="In phiếu khám bệnh / Xuất PDF"
            >
              <Printer className="w-4 h-4" />
              <span>In Phiếu Khám (PDF)</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs shadow-xs transition-colors"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Modern Segmented Tab Navigation */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('consultation')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'consultation'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Khám & Nhập liệu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Xem trước Phiếu Khám</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                loadHistory();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Lịch sử sửa</span>
              {auditHistory.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  {auditHistory.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'files'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Tệp y tế & Chẩn đoán hình ảnh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('past_visits');
                if (visit?.patient_id) {
                  loadPatientTimelineData(visit.patient_id);
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'past_visits'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4 text-indigo-500" />
              <span>Lịch sử các lần khám cũ</span>
              {patientTimeline.filter((v) => v.id !== Number(visitId)).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold">
                  {patientTimeline.filter((v) => v.id !== Number(visitId)).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Patient Information Clinical Banner (Web Only) */}
      <div className="bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 border border-blue-100/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-2 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
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
          <div className="text-xs space-y-1 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 md:pl-4">
            <span className="text-slate-400 block font-medium">Dịch vụ khám chỉ định:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {visit.service?.name || `DV #${visit.service_id}`}
            </span>
            <div className="text-slate-500 font-mono text-[11px]">
              Tiếp nhận: {new Date(visit.visit_date).toLocaleString('vi-VN')}
            </div>
          </div>

          <div className="text-xs space-y-1 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 md:pl-4">
            <span className="text-slate-400 block font-medium">Bác sĩ phụ trách:</span>
            <span className="font-semibold text-blue-700 dark:text-blue-400 text-sm flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
              <span>{selectedDoctor?.full_name || `BS #${visit.employee_id}`}</span>
            </span>
            <div className="text-slate-500 text-[11px]">
              {selectedDoctor?.department || 'Khoa Nội Tổng Quát'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab 1: Doctor Consultation Form */}
      {activeTab === 'consultation' && (
        <form onSubmit={handleSubmit} className="space-y-6 print:hidden">
          {/* PAID RECORD LOCKED BANNER */}
          {isRecordLocked && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
              <span className="text-2xl mt-0.5">🔒</span>
              <div className="text-sm">
                <p className="font-bold text-base mb-1">
                  HỒ SƠ BỆNH ÁN & ĐƠN THUỐC ĐÃ KHÓA (CHẾ ĐỘ CHỈ ĐỌC)
                </p>
                <p className="leading-relaxed">
                  Lượt khám này đã được quầy thu ngân tất toán viện phí ({visitInvoice?.status === 'PAID' ? 'Hóa đơn đã thanh toán' : 'Trạng thái ca khám: Đã thanh toán'}). Bác sĩ không thể sửa đổi chẩn đoán hoặc đơn thuốc đã thu tiền để đảm bảo tính toàn vẹn số liệu tài chính và kho dược.
                </p>
              </div>
            </div>
          )}

          {/* DOCTOR ISOLATION WARNING BANNER */}
          {!canDoctorOperate && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
              <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-bold text-base mb-1">
                  🔒 Giới hạn quyền chuyên môn theo Bác sĩ phụ trách
                </p>
                <p className="leading-relaxed">
                  Ca khám này được chỉ định riêng cho <strong>{selectedDoctor?.full_name || `Bác sĩ #${visit.employee_id}`}</strong>.
                  Theo quy định của phòng khám, mỗi bác sĩ chỉ được thăm khám và lập bệnh án cho bệnh nhân do mình phụ trách.
                  Tài khoản của bạn hiện ở chế độ <strong>Chỉ xem thông tin</strong>, không thể sửa đổi hoặc lưu bệnh án của bác sĩ khác.
                </p>
              </div>
            </div>
          )}

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
                  disabled={isRecordLocked}
                  onClick={() => appendToField('medical_history', symptom)}
                  className="px-2.5 py-1 text-xs rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-800 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {symptom}
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              disabled={isRecordLocked}
              value={formData.medical_history || ''}
              onChange={(e) =>
                setFormData({ ...formData, medical_history: e.target.value })
              }
              placeholder="Nhập lý do đến khám, bệnh sử hiện tại, triệu chứng cơ năng, tiền sử dị ứng hoặc bệnh mạn tính..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
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
                  disabled={isRecordLocked}
                  onClick={() => appendToField('diagnosis', diag)}
                  className="px-2.5 py-1 text-xs rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {diag}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              disabled={isRecordLocked}
              value={formData.diagnosis}
              onChange={(e) => {
                setFormData({ ...formData, diagnosis: e.target.value });
                if (errors.diagnosis) {
                  setErrors({ ...errors, diagnosis: '' });
                }
              }}
              placeholder="Nhập chẩn đoán xác định, mã ICD-10 hoặc chẩn đoán phân biệt..."
              className={`w-full text-sm rounded-lg border bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed ${
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
                    disabled={isRecordLocked}
                    onClick={() => appendToField('indication', ind)}
                    className="px-2 py-0.5 text-xs rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + {ind.split(' (')[0]}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                disabled={isRecordLocked}
                value={formData.indication || ''}
                onChange={(e) =>
                  setFormData({ ...formData, indication: e.target.value })
                }
                placeholder="Ghi nhận các chỉ định xét nghiệm, chụp phim X-quang, siêu âm, nội soi..."
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
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
                disabled={isRecordLocked}
                value={formData.result || ''}
                onChange={(e) =>
                  setFormData({ ...formData, result: e.target.value })
                }
                placeholder="Ví dụ: Bạch cầu 12.5 G/L, CRP 15 mg/L, Hình ảnh thâm nhiễm phế nang đáy phổi phải..."
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Card 5: Dedicated Interactive Prescription Table & Medical Advice */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>5. Bảng Kê Đơn Thuốc Ngoại Trú (Rx Table)</span>
                    <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {prescribedDrugs.length} loại thuốc
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tra cứu thuốc từ kho dược, chọn toa mẫu hoặc thêm thuốc tùy chỉnh. Giá tiền và thành tiền tự động tính.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDrugPickerOpen(!isDrugPickerOpen)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isDrugPickerOpen ? 'Ẩn bộ tìm thuốc' : 'Mở tìm kiếm thuốc'}</span>
                </button>
                {prescribedDrugs.length > 0 && !isRecordLocked && (
                  <button
                    type="button"
                    onClick={handleClearPrescription}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa trắng đơn</span>
                  </button>
                )}
              </div>
            </div>

            {/* Toa Thuốc Mẫu Lâm Sàng (1-Click Clinical Presets) */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 dark:from-slate-800/60 dark:to-slate-900 border border-blue-100 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Toa thuốc mẫu lâm sàng (1 chạm lên toàn bộ đơn):</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bấm chọn để tải nhanh danh mục thuốc & liều lượng mẫu
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CLINIC_RX_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    disabled={isRecordLocked}
                    onClick={() => handleApplyPreset(preset)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all font-semibold flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>💊</span>
                    <span>Toa {preset.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({preset.drugs.length} vị)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drug Search & Catalog Selector */}
            {isDrugPickerOpen && (
              <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={drugSearchQuery}
                      onChange={(e) => setDrugSearchQuery(e.target.value)}
                      placeholder="Tìm thuốc theo tên, hoạt chất hoặc mã (vd: Paracetamol, Augmentin, Omeprazole, PRD...)..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                    {drugSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDrugSearchQuery('')}
                        className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtered Drug Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {medicationsList.filter((m) => {
                    const q = drugSearchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      m.name.toLowerCase().includes(q) ||
                      m.product_code.toLowerCase().includes(q) ||
                      m.category.toLowerCase().includes(q) ||
                      m.indication.toLowerCase().includes(q)
                    );
                  }).map((med) => {
                    const isAdded = prescribedDrugs.some((p) => p.product_code === med.product_code);
                    const isOutOfStock = med.current_stock <= 0;
                    return (
                      <div
                        key={med.id}
                        className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                          isAdded
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-900 dark:text-white leading-tight">
                              {med.name}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              {med.unit}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={med.indication}>
                            {med.indication}
                          </div>
                          {/* Live Warehouse Stock Badge */}
                          <div className="flex items-center gap-1.5 text-[11px] mt-1 pt-1 border-t border-slate-100/60 dark:border-slate-800/40">
                            <span className="text-slate-400">Kho dược:</span>
                            {med.current_stock > 10 ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                                📦 {med.current_stock} {med.unit}
                              </span>
                            ) : med.current_stock > 0 ? (
                              <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                                ⚠️ Còn {med.current_stock} {med.unit}
                              </span>
                            ) : (
                              <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/60 px-1 py-0.2 rounded text-[10px]">
                                🚫 Hết hàng
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              {formatCurrency(med.unit_price)}
                            </span>
                            <span className="text-[10px] text-slate-400">/{med.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddMedicationToRx(med)}
                            disabled={isOutOfStock || isRecordLocked}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                              isAdded
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isOutOfStock ? 'Hết hàng' : isAdded ? '+ Thêm SL' : '+ Kê thuốc'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* THE PRESCRIPTION TABLE (BẢNG KÊ ĐƠN THUỐC) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Danh sách thuốc trong đơn đã kê:</span>
                </span>
                {prescribedDrugs.length > 0 && (
                  <span className="text-xs text-slate-500">
                    Bác sĩ có thể chỉnh sửa trực tiếp số lượng, đơn vị và liều lượng trên từng dòng
                  </span>
                )}
              </div>

              {prescribedDrugs.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Pill className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Đơn thuốc hiện đang trống
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Tìm kiếm thuốc ở ô tra cứu bên trên hoặc chọn 1 Toa thuốc mẫu lâm sàng để hệ thống tự động đổ thuốc vào bảng.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3 w-10 text-center">STT</th>
                        <th className="py-2.5 px-3 min-w-44">Tên thuốc & Hoạt chất</th>
                        <th className="py-2.5 px-2 w-16 text-center">ĐVT</th>
                        <th className="py-2.5 px-3 w-32 text-center">Số lượng</th>
                        <th className="py-2.5 px-3 w-28 text-right">Đơn giá</th>
                        <th className="py-2.5 px-3 w-32 text-right">Thành tiền</th>
                        <th className="py-2.5 px-3 min-w-64">Liều dùng & Cách dùng</th>
                        <th className="py-2.5 px-2 w-12 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {prescribedDrugs.map((drug, index) => (
                        <tr key={drug.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {drug.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {drug.product_code}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                              {drug.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={isRecordLocked}
                                onClick={() => handleUpdateDrugQuantity(drug.id, -1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                disabled={isRecordLocked}
                                value={drug.quantity}
                                onChange={(e) =>
                                  handleUpdateDrugQuantity(drug.id, parseInt(e.target.value) || 1, true)
                                }
                                className="w-14 text-center font-bold font-mono py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                              />
                              <button
                                type="button"
                                disabled={isRecordLocked}
                                onClick={() => handleUpdateDrugQuantity(drug.id, 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(drug.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {formatCurrency(drug.total_price)}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              disabled={isRecordLocked}
                              value={drug.dosage}
                              onChange={(e) => handleUpdateDrugDosage(drug.id, e.target.value)}
                              placeholder="Nhập liều dùng, số lần uống, thời điểm uống..."
                              className="w-full px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              disabled={isRecordLocked}
                              onClick={() => handleRemoveDrug(drug.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Xóa thuốc này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                        <td colSpan={4} className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          Tổng số: <span className="text-blue-600">{prescribedDrugs.length}</span> loại thuốc
                        </td>
                        <td className="py-3 px-3 text-right uppercase text-slate-500 text-[11px]">
                          Tổng tiền thuốc:
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(prescribedDrugs.reduce((sum, d) => sum + (d.total_price || 0), 0))}
                        </td>
                        <td colSpan={2} className="py-3 px-3 text-slate-500 text-[11px] italic">
                          (Đã tính theo số lượng & đơn vị)
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Real-time Combined Financial Breakdown for the Visit */}
            <div className="p-4 bg-gradient-to-r from-slate-50 via-blue-50/40 to-emerald-50/40 dark:from-slate-900 dark:via-slate-800/60 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Tổng kết viện phí toàn ca khám (Tiền dịch vụ + Tiền thuốc)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Trạng thái ca khám:
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px]">1. Tiền dịch vụ khám:</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5 truncate" title={visit.service?.name}>
                    {visit.service?.name || 'Khám bệnh'}
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200 mt-1 block">
                    {isPackageVisit ? (
                      <span className="text-purple-600 dark:text-purple-400 text-xs font-semibold">
                        0 ₫ (Khấu trừ Gói)
                      </span>
                    ) : (
                      formatCurrency(servicePrice)
                    )}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px]">2. Tiền thuốc kê đơn:</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                    {prescribedDrugs.length} loại thuốc
                  </span>
                  <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatCurrency(totalDrugPrice)}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px]">3. Giảm giá / Miễn trừ:</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Ưu đãi ca khám</span>
                  <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400 mt-1 block">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                  <span className="text-blue-900 dark:text-blue-300 font-bold block text-[11px] uppercase">
                    TỔNG CỘNG THANH TOÁN:
                  </span>
                  <span className="font-mono font-black text-base text-blue-700 dark:text-blue-400 mt-0.5 block">
                    {formatCurrency(grandTotalCost)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    (Dịch vụ khám + Tiền thuốc)
                  </span>
                </div>
              </div>

              {/* Action notice for cashier / billing */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-slate-500 text-[11px] italic">
                  💡 Quy trình: Bác sĩ lưu bệnh án → Bệnh nhân cầm đơn ra Quầy Thu ngân để thanh toán viện phí & nhận thuốc tại kho dược.
                </span>
                <Link
                  href={`/invoices?visit_id=${visit.id}&patient_id=${visit.patient_id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors self-start sm:self-auto shrink-0"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Chuyển sang Quầy Thu Ngân (Thu tiền) →</span>
                </Link>
              </div>
            </div>

            {/* Lời dặn dinh dưỡng & sinh hoạt */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Lời dặn dinh dưỡng, kiêng cữ & sinh hoạt của bác sĩ:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ADVICES.map((adv, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isRecordLocked}
                    onClick={() => {
                      const current = doctorAdviceNotes.trim();
                      const updated = current ? `${current}\n- ${adv}` : `- ${adv}`;
                      handleUpdateDoctorAdvice(updated);
                    }}
                    className="px-2.5 py-1 text-xs rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 dark:bg-slate-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all font-medium text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Lời dặn {idx + 1}: {adv.slice(0, 32)}...
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                disabled={isRecordLocked}
                value={doctorAdviceNotes}
                onChange={(e) => handleUpdateDoctorAdvice(e.target.value)}
                placeholder="Nhập lời dặn thêm của bác sĩ: Chế độ ăn uống, tập luyện, kiêng cữ đồ cay nóng..."
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
              />
            </div>
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
                  disabled={isRecordLocked}
                  onClick={() => setFollowUpDays(3)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +3 ngày
                </button>
                <button
                  type="button"
                  disabled={isRecordLocked}
                  onClick={() => setFollowUpDays(5)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +5 ngày
                </button>
                <button
                  type="button"
                  disabled={isRecordLocked}
                  onClick={() => setFollowUpDays(7)}
                  className="px-2.5 py-1 text-xs rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +1 tuần
                </button>
                <button
                  type="button"
                  disabled={isRecordLocked}
                  onClick={() => setFollowUpDays(14)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +2 tuần
                </button>
                <button
                  type="button"
                  disabled={isRecordLocked}
                  onClick={() => setFollowUpDays(30)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +1 tháng
                </button>
              </div>

              <div className="pt-1">
                <input
                  type="date"
                  disabled={isRecordLocked}
                  value={formData.follow_up_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, follow_up_date: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
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
                    disabled={isRecordLocked}
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="VD: Điều chỉnh phác đồ theo kết quả xét nghiệm máu ngày..."
                    className="w-full text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
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
                  disabled={isRecordLocked}
                  value={formData.doctor_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      doctor_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
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

              {!canDoctorOperate && (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg border border-amber-300 dark:border-amber-700">
                  🔒 Chỉ bác sĩ phụ trách mới có quyền lưu bệnh án
                </span>
              )}

              {isRecordLocked ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg border border-slate-300 dark:border-slate-700">
                  🔒 Bệnh án đã khóa (Đã tất toán viện phí)
                </span>
              ) : (
                canDoctorOperate && (medicalRecord ? canUpdateMedical : canCreateMedical) && (
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
                )
              )}
            </div>
          </div>
        </form>
      )}

      {/* Main Tab 2: Standard Printable Medical Record Sheet (EMR A4) */}
      <div
        className={
          activeTab === 'preview'
            ? 'space-y-4'
            : 'hidden print:block'
        }
      >
        {activeTab === 'preview' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 p-4 rounded-2xl print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Xem trước Phiếu Khám Bệnh & Kê Đơn (Khổ A4 Chuẩn)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bản in hồ sơ ngoại trú chuẩn hóa, ẩn hoàn toàn giao diện web khi xuất PDF hoặc gửi máy in.
                </p>
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow transition-all shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>In Phiếu Khám Này (PDF)</span>
            </button>
          </div>
        )}

        <div
          id="printable-record"
          className="bg-white text-slate-900 border border-slate-200 p-8 sm:p-12 rounded-2xl shadow-sm max-w-4xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:text-black font-sans"
        >
          {/* Header 2 columns: Cơ sở y tế & Quốc hiệu tiêu ngữ */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-slate-900">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Sở Y Tế TP. Hồ Chí Minh
              </p>
              <h2 className="text-base font-extrabold uppercase text-blue-900 tracking-wide mt-0.5">
                Phòng Khám Đa Khoa QLPK Clinic
              </h2>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                Địa chỉ: Khu Công nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh
              </p>
              <p className="text-[11px] text-slate-600 leading-snug">
                Hotline cấp cứu: <strong>1900 8888</strong> • Website: clinic.qlpk.vn
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam
              </p>
              <p className="text-[11px] font-semibold italic text-slate-700">
                Độc lập - Tự do - Hạnh phúc
              </p>
              <div className="w-24 h-0.5 bg-slate-400 mx-auto mr-0 my-1"></div>
              <div className="text-xs space-y-0.5 mt-2">
                <div className="font-mono font-bold text-slate-900">
                  Mã ca khám: <span className="text-blue-700">{visit.visit_code}</span>
                </div>
                <div className="font-mono text-slate-600">
                  Mã BN: {visit.patient?.patient_code || '---'}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Thời gian: {new Date(visit.visit_date).toLocaleString('vi-VN')}
                </div>
              </div>
            </div>
          </div>

          {/* Tiêu đề phiếu */}
          <div className="text-center space-y-1 py-1">
            <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
              Phiếu Khám Bệnh & Đơn Thuốc Ngoại Trú
            </h1>
            <p className="text-xs text-slate-500 italic">
              (Hồ sơ bệnh án điện tử EMR — Cung cấp cho bệnh nhân theo dõi điều trị)
            </p>
          </div>

          {/* I. THÔNG TIN HÀNH CHÍNH BỆNH NHÂN */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-200 mb-2.5">
              I. Thông tin hành chính
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2.5 gap-x-4">
              <div className="sm:col-span-2">
                Họ và tên người bệnh:{' '}
                <strong className="text-sm uppercase text-slate-900 font-extrabold">
                  {visit.patient?.full_name || 'Bệnh nhân chưa định danh'}
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
                Ngày sinh / Tuổi:{' '}
                <strong>
                  {visit.patient?.date_of_birth
                    ? new Date(visit.patient.date_of_birth).toLocaleDateString('vi-VN')
                    : '—'}{' '}
                  ({calculateAge(visit.patient?.date_of_birth)})
                </strong>
              </div>
              <div>
                Số điện thoại: <strong>{visit.patient?.phone || '—'}</strong>
              </div>
              <div>
                Dịch vụ chỉ định: <strong>{visit.service?.name || `DV #${visit.service_id}`}</strong>
              </div>
              <div className="sm:col-span-2">
                Địa chỉ cư trú:{' '}
                <strong>{visit.patient?.address || 'TP. Hồ Chí Minh'}</strong>
              </div>
              <div>
                Bác sĩ phụ trách:{' '}
                <strong className="text-blue-900">
                  {selectedDoctor?.full_name || 'BS phụ trách'}
                </strong>
              </div>
            </div>
          </div>

          {/* II. LÂM SÀNG & CHẨN ĐOÁN */}
          <div className="space-y-4 text-xs">
            <div className="border-l-4 border-blue-600 pl-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                II. Tiền sử & Diễn biến lâm sàng
              </h4>
              <p className="whitespace-pre-line text-slate-800 leading-relaxed mt-1">
                {formData.medical_history || 'Chưa ghi nhận tiền sử dị ứng, tiền sử bệnh lý mạn tính đặc biệt.'}
              </p>
            </div>

            <div className="border-l-4 border-rose-600 pl-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                III. Chẩn đoán y khoa xác định
              </h4>
              <p className="whitespace-pre-line font-bold text-slate-900 text-sm leading-relaxed mt-1">
                {formData.diagnosis || 'Chưa hoàn tất chẩn đoán lâm sàng.'}
              </p>
            </div>

            <div className="border-l-4 border-indigo-600 pl-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                IV. Chỉ định cận lâm sàng & Kết quả
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Chỉ định:</span>
                  <p className="whitespace-pre-line text-slate-800">
                    {formData.indication || 'Không có chỉ định bổ sung.'}
                  </p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Kết quả ghi nhận:</span>
                  <p className="whitespace-pre-line text-slate-800">
                    {formData.result || 'Trong giới hạn bình thường.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-l-4 border-emerald-600 pl-3 space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                V. Phác đồ điều trị & Đơn thuốc ngoại trú
              </h4>

              {prescribedDrugs.length > 0 ? (
                <div className="space-y-2.5">
                  <table className="w-full text-[11px] border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold">
                        <th className="border border-slate-400 px-2 py-1.5 text-center w-8">STT</th>
                        <th className="border border-slate-400 px-2 py-1.5 text-left">Tên thuốc & Hoạt chất</th>
                        <th className="border border-slate-400 px-2 py-1.5 text-center w-14">ĐVT</th>
                        <th className="border border-slate-400 px-2 py-1.5 text-center w-14">SL</th>
                        <th className="border border-slate-400 px-2 py-1.5 text-right w-20">Đơn giá</th>
                        <th className="border border-slate-400 px-2 py-1.5 text-right w-24">Thành tiền</th>
                        <th className="border border-slate-400 px-2 py-1.5 text-left min-w-40">Cách dùng & Liều lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescribedDrugs.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-300">
                          <td className="border border-slate-300 px-2 py-1 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-900">{item.name}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center">{item.unit}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold font-mono">{item.quantity}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">{formatCurrency(item.total_price)}</td>
                          <td className="border border-slate-300 px-2 py-1 text-slate-800 italic">{item.dosage}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={5} className="border border-slate-400 px-2 py-1.5 text-right uppercase text-[10px]">
                          Tổng cộng tiền thuốc ({prescribedDrugs.length} loại):
                        </td>
                        <td className="border border-slate-400 px-2 py-1.5 text-right font-mono text-blue-900 text-xs">
                          {formatCurrency(prescribedDrugs.reduce((sum, d) => sum + (d.total_price || 0), 0))}
                        </td>
                        <td className="border border-slate-400 px-2 py-1 text-slate-500 text-[10px] italic">
                          (Đã bao gồm đơn giá & số lượng)
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {doctorAdviceNotes && (
                    <div className="bg-slate-50 p-2 rounded border border-slate-300 text-[11px]">
                      <span className="font-bold text-slate-800">Lời dặn sinh hoạt: </span>
                      <span className="whitespace-pre-line text-slate-700">{doctorAdviceNotes}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-800 text-xs whitespace-pre-line leading-relaxed">
                  {formData.treatment || 'Nghỉ ngơi, ăn uống điều độ, theo dõi diễn biến sức khỏe tại nhà.'}
                </div>
              )}
            </div>

            {/* VI. BẢNG TỔNG HỢP CHI PHÍ KHÁM & TIỀN THUỐC */}
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
                <span className="font-bold uppercase tracking-wider text-slate-800">
                  VI. Bảng kê viện phí ca khám (Dịch vụ + Tiền thuốc)
                </span>
                <span className="text-[10px] text-slate-500 italic">
                  (Bệnh nhân vui lòng mang phiếu này đến Quầy Thu Ngân để thanh toán & nhận thuốc)
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center pt-1">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">1. Phí dịch vụ khám:</span>
                  <span className="font-bold text-slate-900 block truncate" title={visit.service?.name}>
                    {visit.service?.name || 'Khám bệnh'}
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] mt-0.5 block">
                    {isPackageVisit ? (
                      <span className="text-purple-700">0 ₫ (Khấu trừ Gói)</span>
                    ) : (
                      formatCurrency(servicePrice)
                    )}
                  </span>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">2. Tiền thuốc ({prescribedDrugs.length} loại):</span>
                  <span className="font-bold text-slate-900 block">Đơn ngoại trú</span>
                  <span className="font-mono font-bold text-emerald-700 text-[11px] mt-0.5 block">
                    {formatCurrency(totalDrugPrice)}
                  </span>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">3. Giảm trừ / Ưu đãi:</span>
                  <span className="font-bold text-slate-900 block">Miễn giảm</span>
                  <span className="font-mono font-bold text-rose-700 text-[11px] mt-0.5 block">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>

                <div className="bg-emerald-50 p-2 rounded border border-emerald-300">
                  <span className="text-[10px] text-emerald-800 font-semibold block">4. TỔNG CỘNG THANH TOÁN:</span>
                  <span className="font-bold text-emerald-950 block">Tổng viện phí</span>
                  <span className="font-mono font-extrabold text-emerald-800 text-xs mt-0.5 block">
                    {formatCurrency(grandTotalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* VII. LỜI DẶN CỦA BÁC SĨ & HẸN TÁI KHÁM */}
            <div className="border-l-4 border-amber-600 pl-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                VII. Lời dặn của bác sĩ & Hẹn tái khám
              </h4>
              <p className="text-slate-800 font-semibold mt-1">
                {formData.follow_up_date
                  ? `Hẹn tái khám vào ngày: ${new Date(formData.follow_up_date).toLocaleDateString('vi-VN')} (hoặc tái khám ngay khi có dấu hiệu bất thường)`
                  : 'Tái khám ngay khi các triệu chứng diễn biến tăng hoặc có dấu hiệu bất thường.'}
              </p>
            </div>
          </div>

          {/* VIII. CHỮ KÝ XÁC NHẬN */}
          <div className="pt-6 grid grid-cols-2 text-center text-xs">
            <div>
              <p className="font-bold text-slate-800 uppercase">Bệnh nhân / Thân nhân</p>
              <p className="text-slate-500 italic text-[11px] mt-0.5">(Ký và ghi rõ họ tên)</p>
            </div>
            <div className="space-y-12">
              <div>
                <p className="text-slate-600 italic">
                  TP. Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </p>
                <p className="font-bold text-slate-900 uppercase mt-1">Bác sĩ khám bệnh</p>
                <p className="text-slate-500 italic text-[11px]">(Ký, ghi rõ họ tên & đóng dấu)</p>
              </div>
              <div className="font-bold text-sm text-slate-900">
                {selectedDoctor?.full_name || 'Bác sĩ phụ trách'}
              </div>
            </div>
          </div>

          {/* Footer ghi chú */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 italic">
            * Phiếu khám bệnh có giá trị theo dõi chuyên môn. Quý khách vui lòng mang theo phiếu này khi tái khám.
          </div>
        </div>
      </div>

      {/* Main Tab 3: Medical Record Audit Trail (P3-012) */}
      {activeTab === 'history' && (
        <div className="space-y-6 print:hidden">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:hidden">
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

      {/* Main Tab 5: Patient Longitudinal History (Lịch sử các lần khám trước) */}
      {activeTab === 'past_visits' && visit && (
        <div className="space-y-6 print:hidden">
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lịch Sử Các Lần Khám Cũ của Bệnh Nhân
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toàn bộ hồ sơ các lần khám trước, phác đồ điều trị và tính năng 1-Click sao chép đơn thuốc cũ.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => visit.patient_id && loadPatientTimelineData(visit.patient_id)}
              disabled={isLoadingTimeline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTimeline ? 'animate-spin' : ''}`} />
              <span>Tải lại lịch sử</span>
            </button>
          </div>

          {/* Loading State */}
          {isLoadingTimeline ? (
            <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-xs font-medium text-slate-500">
                Đang tải toàn bộ hồ sơ lâm sàng các lần khám trước...
              </p>
            </div>
          ) : (
            (() => {
              const pastVisits = patientTimeline.filter((v) => v.id !== Number(visitId));
              if (pastVisits.length === 0) {
                return (
                  <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                      🏥
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Chưa có lịch sử các lần khám trước
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Đây là lượt khám đầu tiên của bệnh nhân <strong>{visit.patient?.full_name}</strong> tại phòng khám. Khi bệnh nhân quay lại tái khám hoặc khám lần sau, các hồ sơ cũ sẽ xuất hiện đầy đủ tại đây.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-5">
                  <div className="text-xs font-semibold text-slate-500 px-1">
                    Tìm thấy <span className="font-bold text-indigo-600">{pastVisits.length}</span> ca khám trước đây của bệnh nhân:
                  </div>

                  {pastVisits.map((pv, idx) => {
                    const parsedRx = parsePrescriptionFromTreatment(pv.medical_record?.treatment);
                    const hasDrugs = parsedRx.drugs.length > 0;

                    return (
                      <div
                        key={pv.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all"
                      >
                        {/* Header: Date, Code, Doctor, Badges & Copy Action */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="px-2.5 py-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                              Lần khám #{pastVisits.length - idx}
                            </span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              {new Date(pv.visit_date).toLocaleDateString('vi-VN')}
                            </span>
                            <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {pv.visit_code}
                            </span>
                            {pv.doctor && (
                              <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-blue-500" />
                                <span>BS: {pv.doctor.full_name}</span>
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pv.payment_status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200'
                              }`}
                            >
                              {pv.payment_status === 'PAID' ? 'Đã thu tiền' : 'Chưa thu tiền'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                            <Link
                              href={`/visits/${pv.id}`}
                              target="_blank"
                              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors inline-flex items-center gap-1"
                              title="Xem chi tiết ca khám này trong tab mới"
                            >
                              <span>Xem chi tiết</span>
                              <span>↗</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleCopyPrescriptionFromPastVisit(pv)}
                              disabled={isRecordLocked || !hasDrugs}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              title={
                                isRecordLocked
                                  ? 'Ca khám hiện tại đã khóa do đã tất toán viện phí'
                                  : !hasDrugs
                                    ? 'Lần khám này không có đơn thuốc để sao chép'
                                    : 'Sao chép toàn bộ đơn thuốc của lần này vào bảng đơn ca hiện tại'
                              }
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>📋 Sao chép đơn thuốc cũ</span>
                            </button>
                          </div>
                        </div>

                        {/* Clinical Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              🩺 Chẩn đoán bệnh:
                            </span>
                            <p className="text-slate-900 dark:text-slate-100 font-medium">
                              {pv.medical_record?.diagnosis || pv.notes || 'Chưa ghi nhận chẩn đoán'}
                            </p>
                          </div>

                          {pv.medical_record?.medical_history && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                📝 Triệu chứng lâm sàng / Bệnh sử:
                              </span>
                              <p className="text-slate-900 dark:text-slate-100">
                                {pv.medical_record.medical_history}
                              </p>
                            </div>
                          )}

                          {pv.medical_record?.indication && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                🔬 Chỉ định cận lâm sàng:
                              </span>
                              <p className="text-slate-900 dark:text-slate-100">
                                {pv.medical_record.indication}
                              </p>
                            </div>
                          )}

                          {pv.medical_record?.result && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                📑 Kết quả cận lâm sàng:
                              </span>
                              <p className="text-slate-900 dark:text-slate-100">
                                {pv.medical_record.result}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Past Prescription Table */}
                        {hasDrugs ? (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Pill className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Đơn thuốc đã kê ({parsedRx.drugs.length} loại thuốc):</span>
                              </span>
                              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                Tiền thuốc: {formatCurrency(parsedRx.drugs.reduce((s, d) => s + (d.total_price || 0), 0))}
                              </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                                  <tr>
                                    <th className="py-2 px-3">#</th>
                                    <th className="py-2 px-3">Tên thuốc & Hàm lượng</th>
                                    <th className="py-2 px-3 text-center">Đơn vị</th>
                                    <th className="py-2 px-3 text-center">Số lượng</th>
                                    <th className="py-2 px-3">Hướng dẫn liều dùng</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {parsedRx.drugs.map((d, dIdx) => (
                                    <tr key={dIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                      <td className="py-2 px-3 text-slate-400 font-mono">{dIdx + 1}</td>
                                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                                        {d.name}
                                        <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                                          ({d.product_code})
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-center font-medium text-slate-600 dark:text-slate-300">
                                        {d.unit}
                                      </td>
                                      <td className="py-2 px-3 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400">
                                        {d.quantity}
                                      </td>
                                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                        {d.dosage}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {parsedRx.advice && (
                              <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                                <span className="font-bold mr-1">💡 Lời dặn:</span>
                                <span>{parsedRx.advice}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          pv.medical_record?.treatment && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                💊 Hướng điều trị & Đơn thuốc:
                              </span>
                              <p className="text-slate-900 dark:text-slate-100 whitespace-pre-line font-mono text-[11px]">
                                {pv.medical_record.treatment}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
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
