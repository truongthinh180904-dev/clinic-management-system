'use client';

import React, { useEffect, useState } from 'react';
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
      } else {
        await createService(formData);
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setFormErrors(err.errors);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Có lỗi xảy ra khi lưu thông tin dịch vụ.');
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
      fetchServices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái');
    }
  };

  const handleDelete = async (service: Service) => {
    if (!canDelete) return;
    if (!confirm(`Bạn có chắc muốn ngừng cung cấp dịch vụ "${service.name}"?`)) return;

    try {
      await deleteService(service.id);
      fetchServices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể xóa dịch vụ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Quản lý Dịch vụ khám & Điều trị
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Danh mục các dịch vụ kỹ thuật, thời lượng khám và biểu giá áp dụng toàn hệ thống
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/packages"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            📦 Quản lý Gói dịch vụ
          </Link>
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span>+</span>
              <span>Thêm dịch vụ mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Tìm theo mã dịch vụ, tên dịch vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Lọc
            </button>
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

      {/* Table Data */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh mục dịch vụ...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl">💊</span>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Không tìm thấy dịch vụ nào
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Không có dữ liệu phù hợp với bộ lọc hiện tại hoặc chưa có dịch vụ nào được tạo.
            </p>
            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Thêm dịch vụ đầu tiên
              </button>
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

        {/* Pagination Bar */}
        {pagination && pagination.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Trang {pagination.current_page} / {pagination.last_page} (Tổng số {pagination.total} dịch vụ)
            </span>
            <div className="inline-flex gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium disabled:opacity-40"
              >
                Trước
              </button>
              <button
                disabled={currentPage >= pagination.last_page}
                onClick={() => setCurrentPage((p) => Math.min(pagination.last_page, p + 1))}
                className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã dịch vụ (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formData.service_code || ''}
                    onChange={(e) => setFormData({ ...formData, service_code: e.target.value })}
                    placeholder="DV-0001 (tự sinh nếu trống)"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                  {formErrors?.service_code && (
                    <p className="mt-1 text-xs text-rose-500">{formErrors.service_code[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
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
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên dịch vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Khám tổng quát, Lấy cao răng..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
                {formErrors?.name && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.name[0]}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Giá niêm yết (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                  {formErrors?.price && (
                    <p className="mt-1 text-xs text-rose-500">{formErrors.price[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Thời lượng (phút) <span className="text-rose-500">*</span>
                  </label>
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
                  {formErrors?.duration_minutes && (
                    <p className="mt-1 text-xs text-rose-500">{formErrors.duration_minutes[0]}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả chi tiết / Chỉ định
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ghi chú quy trình thực hiện, vật tư tiêu hao nếu có..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingService ? 'Lưu cập nhật' : 'Tạo dịch vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
