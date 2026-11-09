'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  createService,
  deleteService,
  getServices,
  updateService,
  updateServiceStatus,
} from '@/lib/api/services';
import {
  CreateServiceInput,
  Service,
  ServiceStatus,
} from '@/types/service';
import { PaginationMeta } from '@/types/auth';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { FormField, FormSubmitButton, FormAlert } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { EmptySearchState, EmptyDataState, ErrorState } from '@/components/ui/empty-state';
import { Sparkles, CheckCircle2, Clock, Ban, Search, X } from 'lucide-react';

const STATUS_MAP: Record<ServiceStatus, { label: string; badgeClass: string }> = {
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

export default function ServicesPage() {
  const { hasPermission, hasRole } = useAuth();
  const canCreate = hasPermission('services.create') || hasRole('ADMIN') || hasRole('MANAGER');
  const canUpdate = hasPermission('services.update') || hasRole('ADMIN') || hasRole('MANAGER');
  const canDelete = hasPermission('services.delete') || hasRole('ADMIN');

  const [services, setServices] = useState<Service[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | ''>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<CreateServiceInput>({
    service_code: '',
    name: '',
    description: '',
    price: 0,
    duration_minutes: 30,
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchServices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getServices({
        search: searchTerm,
        status: statusFilter,
        page: currentPage,
        per_page: 10,
      });
      setServices(res.data);
      setPagination(res.meta);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Không thể tải danh sách dịch vụ. Vui lòng thử lại sau.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchServices();
  };

  const handleOpenCreateModal = () => {
    setEditingService(null);
    setFormData({
      service_code: '',
      name: '',
      description: '',
      price: 0,
      duration_minutes: 30,
      status: 'ACTIVE',
    });
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      service_code: service.service_code,
      name: service.name,
      description: service.description || '',
      price: service.price,
      duration_minutes: service.duration_minutes,
      status: service.status,
    });
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors(null);

    try {
      if (editingService) {
        await updateService(editingService.id, formData);
        toast.success(`Đã cập nhật dịch vụ "${formData.name}".`, 'Cập nhật thành công');
      } else {
        await createService(formData);
        toast.success(`Đã thêm dịch vụ mới "${formData.name}".`, 'Tạo mới thành công');
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setFormErrors(err.errors);
        toast.error(err.message || 'Dữ liệu nhập không hợp lệ.', 'Lỗi xác thực');
      } else if (err instanceof ApiError) {
        setError(err.message);
        toast.error(err.message, 'Lỗi thao tác');
      } else {
        setError('Có lỗi xảy ra khi lưu thông tin dịch vụ.');
        toast.error('Có lỗi xảy ra khi lưu thông tin dịch vụ.', 'Lỗi hệ thống');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (service: Service) => {
    if (!canUpdate) return;
    const nextStatus: ServiceStatus = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateServiceStatus(service.id, nextStatus);
      toast.success(
        `Đã chuyển trạng thái dịch vụ "${service.name}" sang ${STATUS_MAP[nextStatus].label}.`,
        'Thành công'
      );
      fetchServices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái';
      toast.error(msg, 'Lỗi cập nhật');
    }
  };

  const [deleteServiceItem, setDeleteServiceItem] = useState<Service | null>(null);
  const [isDeletingService, setIsDeletingService] = useState(false);

  const handleDelete = (service: Service) => {
    if (!canDelete) return;
    setDeleteServiceItem(service);
  };

  const handleConfirmDelete = async () => {
    if (!deleteServiceItem) return;
    setIsDeletingService(true);
    try {
      await deleteService(deleteServiceItem.id);
      toast.success(`Đã xóa dịch vụ "${deleteServiceItem.name}".`, 'Đã xóa');
      setDeleteServiceItem(null);
      fetchServices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa dịch vụ';
      toast.error(msg, 'Lỗi xóa dịch vụ');
    } finally {
      setIsDeletingService(false);
    }
  };

  // Block 3: Summary Statistics
  const summaryStats = useMemo(() => {
    const total = pagination?.total ?? services.length;
    const active = services.filter((s) => s.status === 'ACTIVE').length;
    const inactive = services.filter((s) => s.status === 'INACTIVE').length;
    const locked = services.filter((s) => s.status === 'LOCKED').length;
    return [
      {
        title: 'Tổng số dịch vụ',
        value: total,
        icon: Sparkles,
        variant: 'primary' as const,
        description: 'Dịch vụ trong danh mục',
      },
      {
        title: 'Đang áp dụng',
        value: active,
        icon: CheckCircle2,
        variant: 'success' as const,
        description: 'Khả dụng cho bệnh nhân',
      },
      {
        title: 'Tạm ngưng',
        value: inactive,
        icon: Clock,
        variant: 'warning' as const,
        description: 'Tạm dừng tiếp nhận',
      },
      {
        title: 'Đã khóa',
        value: locked,
        icon: Ban,
        variant: 'destructive' as const,
        description: 'Ngừng cung cấp',
      },
    ];
  }, [pagination?.total, services]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Block 1 & 2: Page Header & Action Buttons */}
      <PageHeader
        title="Quản lý Dịch vụ khám & Điều trị"
        description="Danh mục các dịch vụ kỹ thuật, thời lượng khám và biểu giá áp dụng toàn hệ thống"
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/packages"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            >
              📦 Quản lý Gói dịch vụ
            </Link>
            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <span>+</span>
                <span>Thêm dịch vụ mới</span>
              </button>
            )}
          </div>
        }
      />

      {/* Block 3: Khối tóm tắt thống kê quan trọng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Block 4 & 5: Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo mã dịch vụ, tên dịch vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-10 pr-9 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ServiceStatus | '');
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang áp dụng</option>
              <option value="INACTIVE">Tạm ngưng</option>
              <option value="LOCKED">Đã khóa</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
            >
              Lọc
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

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchServices}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Block 6, 7 & 8: Table Data, Pagination & State */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh mục dịch vụ...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="p-6">
            {hasActiveFilters ? (
              <EmptySearchState query={searchTerm} onReset={handleResetFilters} />
            ) : (
              <EmptyDataState
                title="Chưa có dịch vụ nào"
                description="Danh mục dịch vụ kỹ thuật đang trống. Bắt đầu bằng cách thêm dịch vụ đầu tiên."
                createLabel="+ Thêm dịch vụ đầu tiên"
                onCreate={canCreate ? handleOpenCreateModal : undefined}
                icon={Sparkles}
              />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Mã DV</th>
                  <th className="py-3 px-4">Tên dịch vụ</th>
                  <th className="py-3 px-4 text-right">Giá niêm yết</th>
                  <th className="py-3 px-4 text-center">Thời lượng</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {services.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {item.service_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-white font-mono">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                        item.price
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                      ⏱️ {item.duration_minutes} phút
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_MAP[item.status]?.badgeClass || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_MAP[item.status]?.label || item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canUpdate && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Sửa
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline"
                            >
                              {item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Áp dụng'}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              onClick={() => handleDelete(item)}
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

        {/* Block 7: Standard Pagination Bar */}
        <Pagination
          currentPage={pagination?.current_page || currentPage}
          totalPages={pagination?.last_page || 1}
          totalItems={pagination?.total}
          perPage={pagination?.per_page || 10}
          from={pagination?.from}
          to={pagination?.to}
          onPageChange={(p) => setCurrentPage(p)}
          itemLabel="dịch vụ"
        />
      </div>

      {/* Modal: Create or Edit Service */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingService ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ khám mới'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {error && (
                <FormAlert
                  type="error"
                  title="Lỗi xử lý"
                  message={error}
                  onDismiss={() => setError(null)}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Mã dịch vụ"
                  hint="DV-0001 (tự sinh nếu để trống)"
                  error={formErrors?.service_code}
                >
                  <input
                    type="text"
                    value={formData.service_code || ''}
                    onChange={(e) => setFormData({ ...formData, service_code: e.target.value })}
                    placeholder="DV-0001"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>

                <FormField
                  label="Trạng thái"
                  required
                  error={formErrors?.status}
                >
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as ServiceStatus })
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
                label="Tên dịch vụ khám"
                required
                error={formErrors?.name}
              >
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Khám tổng quát, Lấy cao răng, Siêu âm bụng..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Giá niêm yết (VNĐ)"
                  required
                  error={formErrors?.price}
                >
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>

                <FormField
                  label="Thời lượng dự kiến (phút)"
                  required
                  error={formErrors?.duration_minutes}
                >
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value, 10) || 15 })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </FormField>
              </div>

              <FormField
                label="Mô tả chi tiết / Chỉ định điều trị"
                error={formErrors?.description}
              >
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ghi chú quy trình thực hiện, vật tư tiêu hao nếu có..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Hủy
                </button>
                <FormSubmitButton
                  isSubmitting={isSubmitting}
                  loadingText="Đang lưu..."
                  submitText={editingService ? 'Lưu cập nhật' : 'Tạo dịch vụ'}
                />
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE SERVICE CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={!!deleteServiceItem}
        onOpenChange={(open) => {
          if (!open && !isDeletingService) setDeleteServiceItem(null);
        }}
        title="Xác nhận xóa dịch vụ y tế"
        description={
          deleteServiceItem ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa dịch vụ y tế{' '}
                <strong className="text-slate-900 dark:text-white">&ldquo;{deleteServiceItem.name}&rdquo;</strong>{' '}
                (Mã DV: <span className="font-mono text-blue-600 font-semibold">{deleteServiceItem.service_code}</span>)?
              </p>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                ⚠️ Cảnh báo: Các lượt khám hoặc hóa đơn trước đây đã áp dụng dịch vụ này vẫn lưu trữ dữ liệu lịch sử, nhưng dịch vụ sẽ không còn hiển thị để chỉ định mới.
              </div>
            </div>
          ) : null
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="destructive"
        isLoading={isDeletingService}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteServiceItem(null)}
      />
    </div>
  );
}
