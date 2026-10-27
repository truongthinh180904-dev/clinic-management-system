'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { createVisit } from '@/lib/api/visits';
import { getEmployees } from '@/lib/api/employees';
import { getPatients } from '@/lib/api/patients';
import { getServices } from '@/lib/api/services';
import { getPatientPackages } from '@/lib/api/packages';
import { Employee } from '@/types/employee';
import { Patient } from '@/types/patient';
import { Service } from '@/types/service';
import { PatientPackage } from '@/types/package';
import { CreateVisitInput, VisitPaymentStatus, VisitStatus } from '@/types/visit';

function CreateVisitContent() {
  const router = useRouter();
  const { hasPermission, hasRole } = useAuth();

  const canCreate =
    hasPermission('visits.create') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST') ||
    hasRole('DOCTOR');

  // Master References
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Patient Search State
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Patient Packages
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PatientPackage | null>(
    null
  );

  // Usage Mode: 'SINGLE' (Dịch vụ lẻ) or 'PACKAGE' (Sử dụng gói)
  const [usageMode, setUsageMode] = useState<'SINGLE' | 'PACKAGE'>('SINGLE');

  // Form Fields
  const nowStr = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [serviceId, setServiceId] = useState<number | ''>('');
  const [visitDate, setVisitDate] = useState<string>(nowStr);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [status, setStatus] = useState<VisitStatus>('SCHEDULED');
  const [paymentStatus, setPaymentStatus] =
    useState<VisitPaymentStatus>('UNPAID');
  const [notes, setNotes] = useState<string>('');

  // Form State & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);

  // Load Employees and Services
  useEffect(() => {
    async function loadRefs() {
      try {
        const [empRes, servRes] = await Promise.all([
          getEmployees({ per_page: 100 }),
          getServices({ per_page: 100 }),
        ]);
        setEmployees(empRes.data || []);
        setServices(servRes.data || []);
      } catch (err) {
        console.error('Failed to load initial data', err);
      }
    }
    loadRefs();
  }, []);

  // Search Patients
  useEffect(() => {
    if (!patientSearchTerm.trim()) {
      setPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const res = await getPatients({
          search: patientSearchTerm.trim(),
          per_page: 10,
        });
        setPatients(res.data || []);
      } catch (err) {
        console.error('Error searching patients', err);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearchTerm]);

  // Check package validity
  const handleSelectPackage = (pkg: PatientPackage) => {
    setSelectedPackage(pkg);
    setPackageError(null);

    const now = new Date();
    const expiry = new Date(pkg.expiry_date);
    const isExpired = expiry < now;

    if (pkg.status !== 'ACTIVE') {
      setPackageError(
        `Gói này đang ở trạng thái "${pkg.status}", không thể sử dụng để khám.`
      );
    } else if (pkg.remaining_sessions <= 0) {
      setPackageError(
        `Gói "${pkg.package?.name || pkg.id}" đã hết buổi (${pkg.used_sessions}/${pkg.total_sessions} buổi đã dùng). Vui lòng chọn gói khác hoặc dùng dịch vụ lẻ.`
      );
    } else if (isExpired) {
      setPackageError(
        `Gói "${pkg.package?.name || pkg.id}" đã hết hạn sử dụng vào ngày ${new Date(pkg.expiry_date).toLocaleDateString('vi-VN')}. Không thể trừ buổi.`
      );
    }

    // Filter service to package services if possible
    if (pkg.package?.services && pkg.package.services.length > 0) {
      // If current serviceId is not in package services, select the first one
      const inPkg = pkg.package.services.some((s) => s.id === Number(serviceId));
      if (!inPkg) {
        setServiceId(pkg.package.services[0].id);
      }
    }

    setUnitPrice(0);
    setDiscountAmount(0);
  };

  // Load Patient Packages when Patient is selected
  useEffect(() => {
    if (!selectedPatient) {
      setPatientPackages([]);
      setSelectedPackage(null);
      setPackageError(null);
      return;
    }

    async function fetchPackages() {
      if (!selectedPatient) return;
      setIsLoadingPackages(true);
      try {
        const res = await getPatientPackages(selectedPatient.id);
        const pkgs = res.data || [];
        setPatientPackages(pkgs);

        // If in package mode and there is an active package, auto-select it
        if (usageMode === 'PACKAGE' && pkgs.length > 0) {
          const activePkg = pkgs.find(
            (p) => p.status === 'ACTIVE' && p.remaining_sessions > 0
          );
          if (activePkg) {
            handleSelectPackage(activePkg);
          }
        }
      } catch (err) {
        console.error('Error fetching patient packages', err);
      } finally {
        setIsLoadingPackages(false);
      }
    }

    fetchPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);

  // Handle switching to Package mode
  const handleUsageModeChange = (mode: 'SINGLE' | 'PACKAGE') => {
    setUsageMode(mode);
    setPackageError(null);
    setErrorMessage(null);

    if (mode === 'SINGLE') {
      setSelectedPackage(null);
      // Reset unit price according to selected service
      if (serviceId) {
        const serv = services.find((s) => s.id === Number(serviceId));
        if (serv) setUnitPrice(serv.price);
      }
      setDiscountAmount(0);
      setPaymentStatus('UNPAID');
    } else {
      // Switched to Package mode
      if (patientPackages.length > 0) {
        const activePkg = patientPackages.find(
          (p) => p.status === 'ACTIVE' && p.remaining_sessions > 0
        );
        if (activePkg) {
          handleSelectPackage(activePkg);
        }
      }
      setUnitPrice(0);
      setDiscountAmount(0);
      setPaymentStatus('PAID');
    }
  };

  // Handle Service Change
  const handleServiceChange = (sId: number | '') => {
    setServiceId(sId);
    if (!sId) {
      setUnitPrice(0);
      return;
    }

    if (usageMode === 'SINGLE') {
      const serv = services.find((s) => s.id === Number(sId));
      if (serv) {
        setUnitPrice(serv.price);
      }
    } else {
      // In package mode, price is 0 (covered by package)
      setUnitPrice(0);
      setDiscountAmount(0);
    }
  };

  // Computed total
  const calculatedTotal = useMemo(() => {
    const raw = quantity * unitPrice - discountAmount;
    return Math.max(0, raw);
  }, [quantity, unitPrice, discountAmount]);

  // Available services based on usageMode & selectedPackage
  const availableServices = useMemo(() => {
    if (
      usageMode === 'PACKAGE' &&
      selectedPackage?.package?.services &&
      selectedPackage.package.services.length > 0
    ) {
      return selectedPackage.package.services;
    }
    return services;
  }, [usageMode, selectedPackage, services]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedPatient) {
      setErrorMessage('Vui lòng chọn bệnh nhân.');
      return;
    }

    if (!employeeId) {
      setErrorMessage('Vui lòng chọn bác sĩ / nhân viên phụ trách.');
      return;
    }

    if (!serviceId) {
      setErrorMessage('Vui lòng chọn dịch vụ.');
      return;
    }

    if (!visitDate) {
      setErrorMessage('Vui lòng chọn ngày giờ khám.');
      return;
    }

    // Package validations
    if (usageMode === 'PACKAGE') {
      if (!selectedPackage) {
        setErrorMessage('Vui lòng chọn gói dịch vụ của bệnh nhân để trừ buổi.');
        return;
      }

      if (selectedPackage.remaining_sessions < quantity) {
        setErrorMessage(
          `Gói dịch vụ chỉ còn ${selectedPackage.remaining_sessions} buổi, không đủ cho số lượng yêu cầu (${quantity}).`
        );
        return;
      }

      const now = new Date();
      const expiry = new Date(selectedPackage.expiry_date);
      if (expiry < now) {
        setErrorMessage(
          `Gói dịch vụ đã hết hạn sử dụng (${expiry.toLocaleDateString('vi-VN')}). Không thể tiếp nhận khám.`
        );
        return;
      }

      if (selectedPackage.status !== 'ACTIVE') {
        setErrorMessage(
          `Gói dịch vụ không ở trạng thái ACTIVE (hiện tại: ${selectedPackage.status}). Không thể trừ buổi.`
        );
        return;
      }
    }

    // Pricing validation
    if (usageMode === 'SINGLE' && discountAmount > quantity * unitPrice) {
      setErrorMessage('Số tiền giảm giá không được vượt quá thành tiền.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateVisitInput = {
        patient_id: selectedPatient.id,
        employee_id: Number(employeeId),
        service_id: Number(serviceId),
        patient_package_id:
          usageMode === 'PACKAGE' && selectedPackage ? selectedPackage.id : null,
        visit_date: visitDate,
        quantity: Number(quantity),
        unit_price: usageMode === 'PACKAGE' ? 0 : Number(unitPrice),
        discount_amount: usageMode === 'PACKAGE' ? 0 : Number(discountAmount),
        status: status,
        payment_status: usageMode === 'PACKAGE' ? 'PAID' : paymentStatus,
        notes: notes.trim() || undefined,
      };

      const res = await createVisit(payload);

      if (res.data?.id) {
        router.push(`/visits/${res.data.id}`);
      } else {
        router.push('/visits');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Lỗi xử lý tạo lượt khám.');
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định khi tạo lượt khám.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format currency
  const formatMoney = (val?: number | null) => {
    if (val === null || val === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val);
  };

  if (!canCreate) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="text-4xl mb-3">⛔</div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          Không có quyền truy cập
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Bạn không có quyền tạo lượt khám mới (visits.create).
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/visits" className="hover:underline">
              Lượt khám
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              Tạo mới
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tạo Lượt khám Mới
          </h1>
        </div>
        <Link
          href="/visits"
          className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Quay lại
        </Link>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-3">
          <span className="text-base">⚠️</span>
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 dark:text-rose-400 hover:underline text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Patient Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧑‍🤝‍🧑</span>
            <span>1. Chọn Bệnh nhân</span>
          </h2>

          {!selectedPatient ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Tìm kiếm bệnh nhân (theo tên, số điện thoại, mã bệnh nhân)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập tên, số điện thoại, mã bệnh nhân để tìm kiếm..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isSearchingPatients && (
                  <div className="absolute right-3 top-2.5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                )}
              </div>

              {/* Patient Suggestions Dropdown */}
              {patients.length > 0 && (
                <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 shadow-lg">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientSearchTerm('');
                        setPatients([]);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white text-sm">
                          {p.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.patient_code} • {p.phone || 'Chưa có SĐT'} • {p.gender}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        Chọn
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPatient.full_name}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {selectedPatient.patient_code}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  SĐT: {selectedPatient.phone || 'Không có'} • Giới tính: {selectedPatient.gender} • Ngày sinh:{' '}
                  {selectedPatient.date_of_birth || 'Không rõ'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setSelectedPackage(null);
                  setPatientPackages([]);
                }}
                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
              >
                Đổi bệnh nhân khác
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Choose Usage Mode (Single vs Package) */}
        {selectedPatient && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>💳</span>
              <span>2. Phương thức sử dụng dịch vụ</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleUsageModeChange('SINGLE')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  usageMode === 'SINGLE'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-600'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💊 Dịch vụ lẻ</span>
                  {usageMode === 'SINGLE' && (
                    <span className="text-xs text-blue-600">✓ Đang chọn</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Khám từng dịch vụ riêng lẻ theo bảng giá dịch vụ của phòng khám.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleUsageModeChange('PACKAGE')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  usageMode === 'PACKAGE'
                    ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 ring-2 ring-purple-600'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📦 Sử dụng gói dịch vụ</span>
                  {usageMode === 'PACKAGE' && (
                    <span className="text-xs text-purple-600">✓ Đang chọn</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Trừ buổi vào gói dịch vụ mà bệnh nhân đã mua trước đó.
                </p>
              </button>
            </div>

            {/* Package Selection Area */}
            {usageMode === 'PACKAGE' && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Gói dịch vụ của bệnh nhân ({patientPackages.length})
                  </label>
                  {isLoadingPackages && (
                    <span className="text-xs text-slate-500 animate-pulse">
                      Đang tải danh sách gói...
                    </span>
                  )}
                </div>

                {patientPackages.length === 0 ? (
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    ⚠️ Bệnh nhân này hiện chưa có gói dịch vụ nào. Vui lòng chuyển sang hình thức &quot;Dịch vụ lẻ&quot; hoặc gán gói cho bệnh nhân trước.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patientPackages.map((pkg) => {
                      const isSelected = selectedPackage?.id === pkg.id;
                      const isExpired = new Date(pkg.expiry_date) < new Date();
                      const isExhausted = pkg.remaining_sessions <= 0;
                      const isDisabled =
                        pkg.status !== 'ACTIVE' || isExpired || isExhausted;

                      return (
                        <div
                          key={pkg.id}
                          onClick={() => handleSelectPackage(pkg)}
                          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          } ${isDisabled ? 'opacity-70 bg-slate-50 dark:bg-slate-900/60' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{pkg.package?.name || `Gói #${pkg.package_id}`}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                                  pkg.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {pkg.status}
                              </span>
                            </div>
                            <div className="text-xs font-bold font-mono">
                              Còn {pkg.remaining_sessions} / {pkg.total_sessions} buổi
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                            <span>
                              Hạn dùng:{' '}
                              <strong
                                className={isExpired ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}
                              >
                                {new Date(pkg.expiry_date).toLocaleDateString('vi-VN')}
                              </strong>
                              {isExpired && ' (Đã hết hạn)'}
                            </span>
                            {isExhausted && (
                              <span className="text-rose-600 font-bold">
                                (Đã hết buổi khám)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Package Specific Error */}
                {packageError && (
                  <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium">
                    ⚠️ {packageError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 3: Visit & Doctor Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩺</span>
            <span>3. Thông tin khám & Bác sĩ phụ trách</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Doctor / Employee */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Bác sĩ / Nhân viên phụ trách <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) =>
                  setEmployeeId(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn bác sĩ phụ trách --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code}) - {emp.position || 'Bác sĩ'}
                  </option>
                ))}
              </select>
            </div>

            {/* Service */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Dịch vụ khám <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={serviceId}
                onChange={(e) =>
                  handleServiceChange(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn dịch vụ --</option>
                {availableServices.map((serv) => (
                  <option key={serv.id} value={serv.id}>
                    {serv.name} ({serv.service_code}) -{' '}
                    {usageMode === 'PACKAGE' ? 'Theo gói' : formatMoney(serv.price)}
                  </option>
                ))}
              </select>
            </div>

            {/* Visit Date */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Ngày giờ khám <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              </input>
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Trạng thái lượt khám
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VisitStatus)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SCHEDULED">SCHEDULED - Đã lên lịch tiếp nhận</option>
                <option value="IN_PROGRESS">IN_PROGRESS - Vào khám ngay</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Billing & Financials */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>💰</span>
            <span>4. Chi phí & Thanh toán</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Số lượng buổi/lượt
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Đơn giá (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                disabled={usageMode === 'PACKAGE'}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              {usageMode === 'PACKAGE' && (
                <span className="text-[11px] text-purple-600 font-medium">
                  Đã bao gồm trong gói dịch vụ (0 ₫)
                </span>
              )}
            </div>

            {/* Discount */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Giảm giá (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                disabled={usageMode === 'PACKAGE'}
                value={discountAmount}
                onChange={(e) =>
                  setDiscountAmount(Math.max(0, Number(e.target.value)))
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Payment Status */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Trạng thái thanh toán
              </label>
              <select
                disabled={usageMode === 'PACKAGE'}
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(e.target.value as VisitPaymentStatus)
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              >
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="PARTIALLY_PAID">Thanh toán một phần</option>
                <option value="PAID">Đã thanh toán đủ</option>
              </select>
            </div>

            {/* Total calculation banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Tổng tiền phải thu:</div>
                <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {formatMoney(calculatedTotal)}
                </div>
              </div>
              {usageMode === 'PACKAGE' && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-medium">
                  Trừ 1 buổi gói
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Ghi chú tiếp nhận (tùy chọn)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nhập lý do đến khám, triệu chứng ban đầu hoặc lưu ý tiếp nhận..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/visits"
            className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Hủy thao tác
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || Boolean(packageError)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Tạo lượt khám</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreateVisitPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
        </div>
      }
    >
      <CreateVisitContent />
    </Suspense>
  );
}
