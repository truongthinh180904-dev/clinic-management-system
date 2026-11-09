'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  assignPackageToPatient,
  createServicePackage,
  deleteServicePackage,
  getAllPatientPackages,
  getServicePackages,
  updatePatientPackageStatus,
  updateServicePackage,
  updateServicePackageStatus,
} from '@/lib/api/packages';
import { getPatients } from '@/lib/api/patients';
import {
  AssignPackageInput,
  CreatePackageInput,
  PackageStatus,
  PatientPackage,
  PatientPackageStatus,
  ServicePackage,
} from '@/types/package';
import { Patient } from '@/types/patient';
import { PaginationMeta } from '@/types/auth';
import { toast } from '@/components/ui/toast';
import { FormField, FormSubmitButton, FormAlert } from '@/components/ui/form-field';

const PACKAGE_STATUS_MAP: Record<PackageStatus, { label: string; badgeClass: string }> = {
  ACTIVE: {
    label: 'Đang áp dụng',
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

const PATIENT_PACKAGE_STATUS_MAP: Record<PatientPackageStatus, { label: string; badgeClass: string }> = {
  ACTIVE: {
    label: 'Đang sử dụng',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  INACTIVE: {
    label: 'Tạm ngưng',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  COMPLETED: {
    label: 'Đã hết buổi',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  },
  EXPIRED: {
    label: 'Đã hết hạn',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  },
};

function PackagesContent() {
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patient_id');

  const { hasPermission, hasRole } = useAuth();
  const canManagePackages =
    hasPermission('service_packages.create') ||
    hasPermission('service_packages.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER');
  const canAssign =
    hasPermission('patient_packages.assign') ||
    hasPermission('patients.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST');

  // Tabs: 'assigned' (Patient Packages) or 'catalog' (Service Package Catalog)
  const [activeTab, setActiveTab] = useState<'assigned' | 'catalog'>(
    preselectedPatientId ? 'assigned' : 'assigned'
  );

  // Assigned patient packages list state
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [assignedPagination, setAssignedPagination] = useState<PaginationMeta | null>(null);
  const [assignedPage, setAssignedPage] = useState(1);
  const [assignedSearch, setAssignedSearch] = useState('');
  const [assignedStatus, setAssignedStatus] = useState<string>('');
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(true);

  // Catalog service packages state
  const [catalogPackages, setCatalogPackages] = useState<ServicePackage[]>([]);
  const [catalogPagination, setCatalogPagination] = useState<PaginationMeta | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogStatus, setCatalogStatus] = useState<PackageStatus | ''>('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const [globalError, setGlobalError] = useState<string | null>(null);

  // Modal: Assign Package to Patient
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(Boolean(preselectedPatientId));
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [assignFormData, setAssignFormData] = useState<AssignPackageInput>({
    package_id: 0,
    purchase_date: new Date().toISOString().split('T')[0],
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignErrors, setAssignErrors] = useState<Record<string, string[]> | null>(null);

  // Modal: Create/Edit Service Package in Catalog
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingCatalogPackage, setEditingCatalogPackage] = useState<ServicePackage | null>(null);
  const [catalogFormData, setCatalogFormData] = useState<CreatePackageInput>({
    package_code: '',
    name: '',
    description: '',
    price: 0,
    total_sessions: 10,
    validity_days: 90,
    status: 'ACTIVE',
  });
  const [catalogFormErrors, setCatalogFormErrors] = useState<Record<string, string[]> | null>(null);
  const [isCatalogSubmitting, setIsCatalogSubmitting] = useState(false);

  // Fetch assigned patient packages
  const fetchAssignedPackages = async () => {
    setIsLoadingAssigned(true);
    setGlobalError(null);
    try {
      const res = await getAllPatientPackages({
        search: assignedSearch,
        status: assignedStatus,
        patient_id: preselectedPatientId ? parseInt(preselectedPatientId, 10) : undefined,
        page: assignedPage,
        per_page: 10,
      });
      setPatientPackages(res.data);
      setAssignedPagination(res.meta);
    } catch (err) {
      if (err instanceof ApiError) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Không thể tải danh sách gói của bệnh nhân.');
      }
    } finally {
      setIsLoadingAssigned(false);
    }
  };

  // Fetch catalog packages
  const fetchCatalogPackages = async () => {
    setIsLoadingCatalog(true);
    setGlobalError(null);
    try {
      const res = await getServicePackages({
        search: catalogSearch,
        status: catalogStatus,
        page: catalogPage,
        per_page: 10,
      });
      setCatalogPackages(res.data);
      setCatalogPagination(res.meta);
    } catch (err) {
      if (err instanceof ApiError) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Không thể tải danh mục gói dịch vụ.');
      }
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    fetchAssignedPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedPage, assignedStatus]);

  useEffect(() => {
    fetchCatalogPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogPage, catalogStatus]);

  // Load patients list for assignment modal
  const searchPatientsForAssign = async (keyword: string) => {
    try {
      const res = await getPatients({ search: keyword, status: 'ACTIVE', per_page: 10 });
      setPatientsList(res.data);
      if (preselectedPatientId && !selectedPatient) {
        const found = res.data.find((p) => p.id === parseInt(preselectedPatientId, 10));
        if (found) setSelectedPatient(found);
      }
    } catch {
      // silently handle
    }
  };

  useEffect(() => {
    if (isAssignModalOpen) {
      searchPatientsForAssign(patientSearchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssignModalOpen, patientSearchTerm]);

  // Handle assign package submission
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setAssignErrors({ patient: ['Vui lòng chọn bệnh nhân cần cấp gói.'] });
      return;
    }
    if (!assignFormData.package_id) {
      setAssignErrors({ package_id: ['Vui lòng chọn gói dịch vụ.'] });
      return;
    }

    setIsAssigning(true);
    setAssignErrors(null);

    try {
      await assignPackageToPatient(selectedPatient.id, assignFormData);
      setIsAssignModalOpen(false);
      setSelectedPatient(null);
      setAssignFormData({
        package_id: 0,
        purchase_date: new Date().toISOString().split('T')[0],
      });
      toast.success(
        `Đã kích hoạt cấp gói dịch vụ thành công cho bệnh nhân "${selectedPatient.full_name}".`,
        'Cấp gói thành công'
      );
      setActiveTab('assigned');
      fetchAssignedPackages();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setAssignErrors(err.errors);
        toast.error(err.message, 'Lỗi cấp gói');
      } else if (err instanceof ApiError) {
        setAssignErrors({ general: [err.message] });
        toast.error(err.message, 'Lỗi cấp gói');
      } else {
        const msg = 'Có lỗi xảy ra khi cấp gói cho bệnh nhân.';
        setAssignErrors({ general: [msg] });
        toast.error(msg, 'Lỗi hệ thống');
      }
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle catalog package create/edit submit
  const handleCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCatalogSubmitting(true);
    setCatalogFormErrors(null);

    try {
      if (editingCatalogPackage) {
        await updateServicePackage(editingCatalogPackage.id, catalogFormData);
        toast.success(`Đã cập nhật gói dịch vụ "${catalogFormData.name}".`, 'Cập nhật thành công');
      } else {
        await createServicePackage(catalogFormData);
        toast.success(`Đã tạo gói dịch vụ mới "${catalogFormData.name}".`, 'Tạo gói thành công');
      }
      setIsCatalogModalOpen(false);
      fetchCatalogPackages();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setCatalogFormErrors(err.errors);
        toast.error(err.message || 'Dữ liệu không hợp lệ.', 'Lỗi xác thực');
      } else if (err instanceof ApiError) {
        setGlobalError(err.message);
        toast.error(err.message, 'Lỗi lưu gói');
      } else {
        const msg = 'Có lỗi xảy ra khi lưu thông tin gói dịch vụ.';
        setGlobalError(msg);
        toast.error(msg, 'Lỗi hệ thống');
      }
    } finally {
      setIsCatalogSubmitting(false);
    }
  };

  const handleOpenCreateCatalogModal = () => {
    setEditingCatalogPackage(null);
    setCatalogFormData({
      package_code: '',
      name: '',
      description: '',
      price: 0,
      total_sessions: 10,
      validity_days: 90,
      status: 'ACTIVE',
    });
    setCatalogFormErrors(null);
    setIsCatalogModalOpen(true);
  };

  const handleOpenEditCatalogModal = (pkg: ServicePackage) => {
    setEditingCatalogPackage(pkg);
    setCatalogFormData({
      package_code: pkg.package_code,
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price,
      total_sessions: pkg.total_sessions,
      validity_days: pkg.validity_days,
      status: pkg.status,
    });
    setCatalogFormErrors(null);
    setIsCatalogModalOpen(true);
  };

  const handleToggleCatalogStatus = async (pkg: ServicePackage) => {
    if (!canManagePackages) return;
    const nextStatus: PackageStatus = pkg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateServicePackageStatus(pkg.id, nextStatus);
      fetchCatalogPackages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái');
    }
  };

  const handleDeleteCatalogPackage = async (pkg: ServicePackage) => {
    if (!canManagePackages) return;
    if (!confirm(`Bạn có chắc muốn ngừng áp dụng gói "${pkg.name}"?`)) return;

    try {
      await deleteServicePackage(pkg.id);
      fetchCatalogPackages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể xóa gói');
    }
  };

  const handleUpdatePatientPackageStatus = async (pp: PatientPackage, newStatus: PatientPackageStatus) => {
    if (!canAssign) return;
    if (!confirm(`Bạn có chắc muốn đổi trạng thái gói sang ${newStatus}?`)) return;

    try {
      await updatePatientPackageStatus(pp.id, newStatus);
      fetchAssignedPackages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể đổi trạng thái');
    }
  };

  // Find currently selected package details for assign modal calculation
  const selectedPackageForAssign = catalogPackages.find(
    (p) => p.id === Number(assignFormData.package_id)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Gói dịch vụ & Liệu trình
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cấu hình danh mục gói khám, cấp gói cho bệnh nhân và theo dõi số buổi liệu trình đã sử dụng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/services"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            💊 Quản lý Dịch vụ lẻ
          </Link>
          {canAssign && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span>+</span>
              <span>Cấp gói cho bệnh nhân</span>
            </button>
          )}
        </div>
      </div>

      {/* Global alert error if any */}
      {globalError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{globalError}</span>
          <button
            onClick={() => {
              fetchAssignedPackages();
              fetchCatalogPackages();
            }}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
        <button
          onClick={() => setActiveTab('assigned')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'assigned'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🧑‍🤝‍🧑 Gói đã cấp cho bệnh nhân</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
            {assignedPagination?.total ?? patientPackages.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📦 Danh mục gói dịch vụ</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
            {catalogPagination?.total ?? catalogPackages.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Assigned Patient Packages */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAssignedPage(1);
                fetchAssignedPackages();
              }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo tên bệnh nhân, số điện thoại, mã gói..."
                  value={assignedSearch}
                  onChange={(e) => setAssignedSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={assignedStatus}
                  onChange={(e) => {
                    setAssignedStatus(e.target.value);
                    setAssignedPage(1);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang sử dụng</option>
                  <option value="COMPLETED">Đã hết buổi</option>
                  <option value="EXPIRED">Đã hết hạn</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>

                <button
                  type="submit"
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Lọc
                </button>
              </div>
            </form>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
            {isLoadingAssigned ? (
              <div className="p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách gói đã cấp...</p>
              </div>
            ) : patientPackages.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl">🧑‍⚕️</span>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                  Chưa có gói nào được cấp
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Hiện chưa có bệnh nhân nào đăng ký gói liệu trình phù hợp với bộ lọc tìm kiếm.
                </p>
                {canAssign && (
                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    + Cấp gói cho bệnh nhân ngay
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Bệnh nhân</th>
                      <th className="py-3 px-4">Gói dịch vụ</th>
                      <th className="py-3 px-4 text-center">Tiến độ buổi</th>
                      <th className="py-3 px-4 text-right">Giá chốt cấp</th>
                      <th className="py-3 px-4 text-center">Ngày mua / Hạn dùng</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {patientPackages.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          {item.patient ? (
                            <Link
                              href={`/patients/${item.patient.id}`}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {item.patient.full_name}
                            </Link>
                          ) : (
                            <span className="text-slate-400">BN #{item.patient_id}</span>
                          )}
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {item.patient?.patient_code || ''} {item.patient?.phone ? `• ${item.patient.phone}` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {item.package?.name || `Gói #${item.package_id}`}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {item.package?.package_code || ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-medium">
                            <span className="text-blue-600 dark:text-blue-400">{item.used_sessions}</span>
                            <span className="text-slate-400">/</span>
                            <span>{item.total_sessions} buổi</span>
                          </div>
                          <div className="mt-1 w-24 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(100, (item.used_sessions / item.total_sessions) * 100)}%`,
                              }}
                            ></div>
                          </div>
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Còn {item.remaining_sessions} buổi
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium font-mono text-slate-900 dark:text-white">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                            item.price
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs">
                          <div className="text-slate-900 dark:text-white font-medium">
                            {item.purchase_date}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                            Hết hạn: {item.expiry_date}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              PATIENT_PACKAGE_STATUS_MAP[item.status]?.badgeClass || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {PATIENT_PACKAGE_STATUS_MAP[item.status]?.label || item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {item.status === 'ACTIVE' && canAssign && (
                              <button
                                onClick={() => handleUpdatePatientPackageStatus(item, 'CANCELLED')}
                                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                              >
                                Hủy gói
                              </button>
                            )}
                            {item.status === 'CANCELLED' && canAssign && (
                              <button
                                onClick={() => handleUpdatePatientPackageStatus(item, 'ACTIVE')}
                                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                Kích hoạt lại
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {assignedPagination && assignedPagination.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Trang {assignedPagination.current_page} / {assignedPagination.last_page} (Tổng {assignedPagination.total} gói đã cấp)
                </span>
                <div className="inline-flex gap-2">
                  <button
                    disabled={assignedPage <= 1}
                    onClick={() => setAssignedPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <button
                    disabled={assignedPage >= assignedPagination.last_page}
                    onClick={() => setAssignedPage((p) => Math.min(assignedPagination.last_page, p + 1))}
                    className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Service Package Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCatalogPage(1);
                  fetchCatalogPackages();
                }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã gói, tên gói..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={catalogStatus}
                    onChange={(e) => {
                      setCatalogStatus(e.target.value as PackageStatus | '');
                      setCatalogPage(1);
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang áp dụng</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                    <option value="LOCKED">Đã khóa</option>
                  </select>

                  <button
                    type="submit"
                    className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Lọc
                  </button>
                </div>
              </form>
            </div>

            {canManagePackages && (
              <button
                onClick={handleOpenCreateCatalogModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                + Tạo gói danh mục mới
              </button>
            )}
          </div>

          {/* Catalog Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
            {isLoadingCatalog ? (
              <div className="p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh mục gói...</p>
              </div>
            ) : catalogPackages.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl">📦</span>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                  Chưa có gói dịch vụ nào
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Hãy thêm các gói điều trị nhiều buổi để áp dụng ưu đãi cho bệnh nhân.
                </p>
                {canManagePackages && (
                  <button
                    onClick={handleOpenCreateCatalogModal}
                    className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    + Tạo gói đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Mã gói</th>
                      <th className="py-3 px-4">Tên gói dịch vụ</th>
                      <th className="py-3 px-4 text-right">Giá niêm yết</th>
                      <th className="py-3 px-4 text-center">Số buổi</th>
                      <th className="py-3 px-4 text-center">Hạn dùng</th>
                      <th className="py-3 px-4 text-center">Đã cấp</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {catalogPackages.map((pkg) => (
                      <tr
                        key={pkg.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {pkg.package_code}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {pkg.name}
                          </div>
                          {pkg.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {pkg.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium font-mono text-slate-900 dark:text-white">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                            pkg.price
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-blue-600 dark:text-blue-400">
                          {pkg.total_sessions} buổi
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                          ⏱️ {pkg.validity_days} ngày
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                          {pkg.patient_packages_count ?? 0} BN
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              PACKAGE_STATUS_MAP[pkg.status]?.badgeClass || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {PACKAGE_STATUS_MAP[pkg.status]?.label || pkg.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {canAssign && pkg.status === 'ACTIVE' && (
                              <button
                                onClick={() => {
                                  setAssignFormData((prev) => ({ ...prev, package_id: pkg.id }));
                                  setIsAssignModalOpen(true);
                                }}
                                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                Cấp gói
                              </button>
                            )}
                            {canManagePackages && (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button
                                  onClick={() => handleOpenEditCatalogModal(pkg)}
                                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Sửa
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button
                                  onClick={() => handleToggleCatalogStatus(pkg)}
                                  className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline"
                                >
                                  {pkg.status === 'ACTIVE' ? 'Tạm ngưng' : 'Áp dụng'}
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button
                                  onClick={() => handleDeleteCatalogPackage(pkg)}
                                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                                >
                                  Ngừng
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Assign Package to Patient */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Cấp gói dịch vụ cho bệnh nhân
              </h2>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {assignErrors?.general && (
              <FormAlert
                type="error"
                title="Không thể cấp gói"
                message={assignErrors.general[0]}
                onDismiss={() => setAssignErrors(null)}
              />
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Patient Selection */}
              <FormField
                label="Chọn bệnh nhân thụ hưởng"
                required
                error={assignErrors?.patient}
              >
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                    <div>
                      <div className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                        {selectedPatient.full_name}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-400 font-mono">
                        {selectedPatient.patient_code} • {selectedPatient.phone || 'Chưa có SĐT'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="text-xs text-blue-700 underline font-medium hover:text-blue-900"
                    >
                      Đổi bệnh nhân
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Gõ tên hoặc SĐT để tìm bệnh nhân..."
                      value={patientSearchTerm}
                      onChange={(e) => setPatientSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      {patientsList.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Không tìm thấy bệnh nhân nào
                        </div>
                      ) : (
                        patientsList.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPatient(p)}
                            className="p-2.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex justify-between items-center"
                          >
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">{p.full_name}</span>
                              <span className="ml-2 font-mono text-slate-500">({p.patient_code})</span>
                            </div>
                            <span className="text-slate-500 font-mono">{p.phone}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </FormField>

              {/* Package Selection */}
              <FormField
                label="Chọn gói dịch vụ / Liệu trình"
                required
                error={assignErrors?.package_id}
              >
                <select
                  required
                  value={assignFormData.package_id || ''}
                  onChange={(e) =>
                    setAssignFormData({ ...assignFormData, package_id: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Chọn gói dịch vụ --</option>
                  {catalogPackages
                    .filter((p) => p.status === 'ACTIVE')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.total_sessions} buổi -{' '}
                        {new Intl.NumberFormat('vi-VN').format(p.price)} đ)
                      </option>
                    ))}
                </select>
              </FormField>

              {/* Package Details Preview */}
              {selectedPackageForAssign && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Giá niêm yết chốt cấp:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                        selectedPackageForAssign.price
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tổng số buổi:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedPackageForAssign.total_sessions} buổi (Còn lại {selectedPackageForAssign.total_sessions} buổi)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thời hạn áp dụng:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedPackageForAssign.validity_days} ngày kể từ ngày kích hoạt
                    </span>
                  </div>
                </div>
              )}

              {/* Purchase Date */}
              <FormField
                label="Ngày mua / Kích hoạt gói"
                required
              >
                <input
                  type="date"
                  value={assignFormData.purchase_date || ''}
                  onChange={(e) =>
                    setAssignFormData({ ...assignFormData, purchase_date: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={isAssigning}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Hủy
                </button>
                <FormSubmitButton
                  isSubmitting={isAssigning}
                  loadingText="Đang cấp gói..."
                  submitText="Xác nhận cấp gói"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Catalog Service Package */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingCatalogPackage ? 'Chỉnh sửa gói dịch vụ' : 'Tạo gói dịch vụ mới'}
              </h2>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCatalogSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Mã gói"
                  hint="PKG-0001 (tùy chọn)"
                  error={catalogFormErrors?.package_code}
                >
                  <input
                    type="text"
                    value={catalogFormData.package_code || ''}
                    onChange={(e) =>
                      setCatalogFormData({ ...catalogFormData, package_code: e.target.value })
                    }
                    placeholder="PKG-0001"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>

                <FormField
                  label="Trạng thái"
                  required
                >
                  <select
                    value={catalogFormData.status || 'ACTIVE'}
                    onChange={(e) =>
                      setCatalogFormData({
                        ...catalogFormData,
                        status: e.target.value as PackageStatus,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ACTIVE">Đang áp dụng</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                    <option value="LOCKED">Đã khóa</option>
                  </select>
                </FormField>
              </div>

              <FormField
                label="Tên gói dịch vụ"
                required
                error={catalogFormErrors?.name}
              >
                <input
                  type="text"
                  required
                  value={catalogFormData.name}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, name: e.target.value })}
                  placeholder="Ví dụ: Liệu trình trị mụn 10 buổi, Gói khám thai..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  label="Giá niêm yết"
                  required
                  error={catalogFormErrors?.price}
                >
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={catalogFormData.price}
                    onChange={(e) =>
                      setCatalogFormData({ ...catalogFormData, price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>

                <FormField
                  label="Tổng số buổi"
                  required
                  error={catalogFormErrors?.total_sessions}
                >
                  <input
                    type="number"
                    min="1"
                    required
                    value={catalogFormData.total_sessions}
                    onChange={(e) =>
                      setCatalogFormData({
                        ...catalogFormData,
                        total_sessions: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>

                <FormField
                  label="Hạn dùng (ngày)"
                  required
                  error={catalogFormErrors?.validity_days}
                >
                  <input
                    type="number"
                    min="1"
                    required
                    value={catalogFormData.validity_days}
                    onChange={(e) =>
                      setCatalogFormData({
                        ...catalogFormData,
                        validity_days: parseInt(e.target.value, 10) || 30,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>
              </div>

              <FormField
                label="Mô tả quyền lợi và điều kiện gói"
                error={catalogFormErrors?.description}
              >
                <textarea
                  rows={3}
                  value={catalogFormData.description || ''}
                  onChange={(e) =>
                    setCatalogFormData({ ...catalogFormData, description: e.target.value })
                  }
                  placeholder="Ghi chú các dịch vụ bao gồm trong gói, điều kiện hủy/hoàn buổi..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  disabled={isCatalogSubmitting}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Hủy
                </button>
                <FormSubmitButton
                  isSubmitting={isCatalogSubmitting}
                  loadingText="Đang lưu..."
                  submitText={editingCatalogPackage ? 'Lưu cập nhật' : 'Tạo gói'}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải giao diện gói dịch vụ...</p>
        </div>
      }
    >
      <PackagesContent />
    </Suspense>
  );
}
