'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  cancelVisit,
  getVisits,
  updateVisitStatus,
} from '@/lib/api/visits';
import { getEmployees } from '@/lib/api/employees';
import {
  PAYMENT_STATUS_MAP,
  VISIT_STATUS_MAP,
  Visit,
  VisitPaymentStatus,
  VisitStatus,
} from '@/types/visit';
import { PaginationMeta } from '@/types/auth';
import { Employee } from '@/types/employee';
import { toast } from '@/components/ui/toast';
import { FormField, FormSubmitButton } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { EmptySearchState, EmptyDataState, ErrorState } from '@/components/ui/empty-state';
import { Stethoscope, Activity, CheckCircle2, XCircle, Search, X } from 'lucide-react';

function VisitsListContent() {
  const { hasPermission, hasRole } = useAuth();

  const canCreate =
    hasPermission('visits.create') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST') ||
    hasRole('DOCTOR');
  const canUpdate =
    hasPermission('visits.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('DOCTOR') ||
    hasRole('RECEPTIONIST');
  const canCancel =
    hasPermission('visits.cancel') ||
    hasPermission('visits.update') ||
    hasRole('ADMIN') ||
    hasRole('MANAGER') ||
    hasRole('RECEPTIONIST');

  // List & pagination
  const [visits, setVisits] = useState<Visit[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<number | ''>('');
  const [patientFilter, setPatientFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<VisitStatus | ''>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    VisitPaymentStatus | ''
  >('');

  // Dropdown references
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Action Modals
  const [statusModalVisit, setStatusModalVisit] = useState<Visit | null>(null);
  const [targetStatus, setTargetStatus] = useState<VisitStatus>('IN_PROGRESS');
  const [statusNote, setStatusNote] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const [cancelModalVisit, setCancelModalVisit] = useState<Visit | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Load Reference Data
  useEffect(() => {
    async function loadRefs() {
      try {
        const empRes = await getEmployees({ per_page: 100 });
        setEmployees(empRes.data || []);
      } catch (err) {
        console.error('Failed to load employees reference', err);
      }
    }
    loadRefs();
  }, []);

  // Load Visits
  const loadVisits = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await getVisits({
        page: currentPage,
        per_page: perPage,
        search: searchTerm || undefined,
        visit_date: dateFilter || undefined,
        employee_id: employeeFilter || undefined,
        patient_id: patientFilter || undefined,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        sort_by: 'visit_date',
        order: 'desc',
      });
      setVisits(res.data || []);
      if (res.meta) {
        setPagination(res.meta);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setPageError(err.message);
      } else {
        setPageError('Không thể tải danh sách lượt khám.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    perPage,
    searchTerm,
    dateFilter,
    employeeFilter,
    patientFilter,
    statusFilter,
    paymentStatusFilter,
  ]);

  // Handle Quick Status Change
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalVisit) return;
    setIsSubmittingStatus(true);
    try {
      await updateVisitStatus(
        statusModalVisit.id,
        targetStatus,
        statusNote || undefined
      );
      const msg = `Đã cập nhật trạng thái lượt khám #${statusModalVisit.visit_code} sang ${VISIT_STATUS_MAP[targetStatus]?.label || targetStatus}`;
      setActionSuccess(msg);
      toast.success(msg, 'Cập nhật trạng thái');
      setStatusModalVisit(null);
      setStatusNote('');
      loadVisits();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Cập nhật trạng thái thất bại.';
      toast.error(msg, 'Lỗi cập nhật');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Handle Cancel Visit
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalVisit) return;
    setIsSubmittingCancel(true);
    try {
      await cancelVisit(cancelModalVisit.id, cancelReason || undefined);
      const msg = `Đã hủy lượt khám #${cancelModalVisit.visit_code} thành công.`;
      setActionSuccess(msg);
      toast.success(msg, 'Hủy lượt khám');
      setCancelModalVisit(null);
      setCancelReason('');
      loadVisits();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Hủy lượt khám thất bại.';
      toast.error(msg, 'Lỗi hủy lượt khám');
    } finally {
      setIsSubmittingCancel(false);
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

  // Format date
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

  // Block 3: Summary Statistics
  const summaryStats = useMemo(() => {
    const total = pagination?.total ?? visits.length;
    const inProgress = visits.filter((v) => v.status === 'IN_PROGRESS').length;
    const completed = visits.filter((v) => v.status === 'COMPLETED').length;
    const cancelled = visits.filter((v) => v.status === 'CANCELLED').length;
    return [
      {
        title: 'Tổng lượt khám',
        value: total,
        icon: Stethoscope,
        variant: 'primary' as const,
        description: 'Tổng lượt khám ghi nhận',
      },
      {
        title: 'Đang thực hiện',
        value: inProgress,
        icon: Activity,
        variant: 'warning' as const,
        description: 'Đang được bác sĩ thăm khám',
      },
      {
        title: 'Đã hoàn thành',
        value: completed,
        icon: CheckCircle2,
        variant: 'success' as const,
        description: 'Đã kết thúc lượt khám',
      },
      {
        title: 'Đã hủy',
        value: cancelled,
        icon: XCircle,
        variant: 'destructive' as const,
        description: 'Lượt khám bị hủy bỏ',
      },
    ];
  }, [pagination?.total, visits]);

  const hasActiveFilters = Boolean(
    searchTerm || dateFilter || employeeFilter || patientFilter || statusFilter || paymentStatusFilter
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setEmployeeFilter('');
    setPatientFilter('');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Block 1 & 2: Top Header & Actions */}
      <PageHeader
        title="Quản lý Lượt khám & Bệnh án"
        description="Theo dõi danh sách tiếp nhận, khám chữa bệnh, sử dụng gói và lập hồ sơ bệnh án"
        actions={
          canCreate ? (
            <Link
              href="/visits/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
              <span>➕</span>
              <span>Tạo lượt khám mới</span>
            </Link>
          ) : undefined
        }
      />

      {/* Block 3: Khối tóm tắt thống kê quan trọng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Error Notification */}
      {pageError && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{pageError}</span>
          </div>
          <button
            onClick={() => setPageError(null)}
            className="text-rose-600 dark:text-rose-400 hover:underline text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Block 4 & 5: Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Mã lượt khám, tên, SĐT, dịch vụ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Visit Date */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Ngày khám
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Trạng thái khám
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as VisitStatus | '');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="SCHEDULED">Đã lên lịch</option>
              <option value="IN_PROGRESS">Đang khám</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Thanh toán
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value as VisitPaymentStatus | '');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả thanh toán</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PARTIALLY_PAID">Thanh toán một phần</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
        </div>

        {/* Second Row Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Employee Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Bác sĩ / Nhân viên phụ trách
            </label>
            <select
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value ? Number(e.target.value) : '');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả bác sĩ / nhân viên</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code}) - {emp.position || 'Nhân viên'}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Clear Filter */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
                setEmployeeFilter('');
                setPatientFilter('');
                setStatusFilter('');
                setPaymentStatusFilter('');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Visits Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Đang tải danh sách lượt khám...
            </p>
          </div>
        ) : visits.length === 0 ? (
          <div className="p-6">
            {hasActiveFilters ? (
              <EmptySearchState query={searchTerm} onReset={handleResetFilters} />
            ) : (
              <EmptyDataState
                title="Chưa có lượt khám nào"
                description="Hệ thống chưa ghi nhận lượt khám nào phù hợp. Hãy tiếp đón bệnh nhân hoặc tạo lượt khám mới."
                createLabel="+ Tạo lượt khám mới"
                createHref={canCreate ? "/visits/new" : undefined}
                icon={Stethoscope}
              />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Mã lượt khám</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Bệnh nhân</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">Ngày khám</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">Dịch vụ / Gói</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">Bác sĩ</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">Thành tiền</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[120px]">Trạng thái</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Thanh toán</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap min-w-[180px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {visits.map((visit) => {
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
                    <tr
                      key={visit.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        <Link
                          href={`/visits/${visit.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span>{visit.visit_code}</span>
                        </Link>
                      </td>

                      {/* Patient */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {visit.patient?.full_name || `BN #${visit.patient_id}`}
                        </div>
                        <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                          {visit.patient?.patient_code}
                          {visit.patient?.phone && ` • ${visit.patient.phone}`}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <div>{formatDate(visit.visit_date)}</div>
                      </td>

                      {/* Service / Package */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {visit.service?.name || `DV #${visit.service_id}`}
                        </div>
                        {visit.patient_package_id && (
                          <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded text-xs whitespace-nowrap">
                            <span>📦 Gói dịch vụ</span>
                            {visit.patient_package?.package?.name && (
                              <span className="font-semibold">
                                ({visit.patient_package.package.name})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Doctor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {visit.employee?.full_name || `BS #${visit.employee_id}`}
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {visit.employee?.position || 'Bác sĩ phụ trách'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium font-mono text-slate-900 dark:text-slate-100">
                        {formatMoney(visit.total_amount)}
                        {visit.discount_amount > 0 && (
                          <div className="text-xs text-rose-500">
                            - {formatMoney(visit.discount_amount)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}
                        >
                          <span>{statusInfo.icon}</span>
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${paymentInfo.badgeClass}`}
                        >
                          {paymentInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Link
                            href={`/visits/${visit.id}`}
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
                            title="Xem chi tiết & bệnh án"
                          >
                            Chi tiết
                          </Link>

                          {canUpdate && visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                setStatusModalVisit(visit);
                                setTargetStatus(
                                  visit.status === 'SCHEDULED'
                                    ? 'IN_PROGRESS'
                                    : 'COMPLETED'
                                );
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md transition-colors"
                              title="Chuyển trạng thái"
                            >
                              Đổi trạng thái
                            </button>
                          )}

                          {canCancel && visit.status !== 'CANCELLED' && visit.status !== 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setCancelModalVisit(visit);
                                setCancelReason('');
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-md transition-colors"
                              title="Hủy lượt khám"
                            >
                              Hủy
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
        )}

        {/* Block 7: Standard Pagination */}
        <Pagination
          currentPage={pagination?.current_page || currentPage}
          totalPages={pagination?.last_page || 1}
          totalItems={pagination?.total}
          from={pagination?.from}
          to={pagination?.to}
          perPage={pagination?.per_page || perPage}
          onPageChange={(p) => setCurrentPage(p)}
          itemLabel="lượt khám"
        />
      </div>

      {/* Quick Status Modal */}
      {statusModalVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Cập nhật trạng thái lượt khám #{statusModalVisit.visit_code}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bệnh nhân: <span className="font-semibold text-slate-800 dark:text-slate-200">{statusModalVisit.patient?.full_name}</span>
            </p>
            <form onSubmit={handleConfirmStatusChange} className="space-y-4">
              <FormField
                label="Trạng thái mới"
                required
              >
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as VisitStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="SCHEDULED">SCHEDULED - Đã lên lịch</option>
                  <option value="IN_PROGRESS">IN_PROGRESS - Đang khám</option>
                  <option value="COMPLETED">COMPLETED - Hoàn thành khám</option>
                  <option value="CANCELLED">CANCELLED - Hủy lượt khám</option>
                </select>
              </FormField>

              <FormField
                label="Ghi chú cập nhật (tùy chọn)"
                hint="Ghi chú lâm sàng hoặc lý do điều chuyển"
              >
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Nhập ghi chú chuyển trạng thái nếu có..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={() => setStatusModalVisit(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                >
                  Đóng
                </button>
                <FormSubmitButton
                  isSubmitting={isSubmittingStatus}
                  loadingText="Đang lưu..."
                  submitText="Xác nhận cập nhật"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Visit Modal */}
      {cancelModalVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400 mb-1">
              Hủy lượt khám #{cancelModalVisit.visit_code}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bệnh nhân: <span className="font-semibold text-slate-800 dark:text-slate-200">{cancelModalVisit.patient?.full_name}</span>. Lưu ý: Nếu lượt khám có sử dụng gói dịch vụ, lượt sử dụng sẽ được hoàn lại an toàn vào gói của bệnh nhân.
            </p>
            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <FormField
                label="Lý do hủy lượt khám"
                required
                hint="Nhập lý do chi tiết để lưu vết kiểm toán phòng khám"
              >
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy lượt khám (ví dụ: Bệnh nhân đổi lịch, hủy hẹn, yêu cầu hoàn gói...)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </FormField>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingCancel}
                  onClick={() => setCancelModalVisit(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                >
                  Đóng
                </button>
                <FormSubmitButton
                  variant="destructive"
                  isSubmitting={isSubmittingCancel}
                  disabled={!cancelReason.trim()}
                  loadingText="Đang hủy..."
                  submitText="Xác nhận hủy"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
        </div>
      }
    >
      <VisitsListContent />
    </Suspense>
  );
}
