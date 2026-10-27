'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { getEmployees } from '@/lib/api/employees';
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getRoles,
  getUsers,
  updateUser,
  updateUserStatus,
} from '@/lib/api/users';
import { Employee } from '@/types/employee';
import {
  ChangePasswordInput,
  CreateUserInput,
  RoleItem,
  UpdateUserInput,
  UserItem,
} from '@/types/user';
import { PaginationMeta, UserStatus } from '@/types/auth';

const STATUS_MAP: Record<UserStatus, { label: string; badgeClass: string }> = {
  ACTIVE: {
    label: 'Hoạt động',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  INACTIVE: {
    label: 'Tạm khóa',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  LOCKED: {
    label: 'Bị khóa',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  },
};

const ALL_ROLES = [
  'ADMIN',
  'MANAGER',
  'DOCTOR',
  'RECEPTIONIST',
  'CASHIER',
  'ACCOUNTANT',
  'EMPLOYEE',
  'VIEWER',
];

function UsersContent() {
  const searchParams = useSearchParams();
  const { user: currentUser, hasPermission, hasRole } = useAuth();

  const canCreate = hasPermission('users.create') || hasRole('ADMIN');
  const canUpdate = hasPermission('users.update') || hasRole('ADMIN');
  const canDelete = hasPermission('users.delete') || hasRole('ADMIN');

  const [users, setUsers] = useState<UserItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    from: 0,
    last_page: 1,
    per_page: 10,
    to: 0,
    total: 0,
  });

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]> | null>(null);
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);

  // Create Form
  const [createData, setCreateData] = useState<CreateUserInput>({
    username: '',
    email: '',
    password: '',
    employee_id: null,
    status: 'ACTIVE',
    roles: ['EMPLOYEE'],
  });

  // Edit Form
  const [editData, setEditData] = useState<UpdateUserInput>({
    email: '',
    employee_id: null,
    status: 'ACTIVE',
    roles: [],
  });

  // Password Form
  const [passwordData, setPasswordData] = useState<ChangePasswordInput>({
    password: '',
    password_confirmation: '',
  });

  // Load roles list
  const loadRoles = async () => {
    try {
      const res = await getRoles();
      if (res.data) setRoles(res.data);
    } catch {
      // Fallback: roles can still be selected by standard names
    }
  };

  // Load employees for linking
  const loadEmployees = async () => {
    try {
      const res = await getEmployees({ per_page: 100, status: 'ACTIVE' });
      if (res.data) setAvailableEmployees(res.data);
    } catch {
      // Ignore
    }
  };

  // Load users
  const fetchUsers = async (currentPage = page) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getUsers({
        search: search.trim() || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
        page: currentPage,
        per_page: 10,
      });
      setUsers(res.data || []);
      if (res.meta) setMeta(res.meta);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể tải danh sách tài khoản.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchUsers(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedRole, selectedStatus]);

  // Handle URL query prefill from employee page
  useEffect(() => {
    const prefillEmpId = searchParams.get('employee_id');
    const prefillName = searchParams.get('full_name');
    const prefillEmail = searchParams.get('email');

    if (prefillEmpId && canCreate) {
      setCreateData({
        username: prefillName
          ? prefillName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, '') + Math.floor(100 + Math.random() * 900)
          : '',
        email: prefillEmail || '',
        password: '',
        employee_id: Number(prefillEmpId),
        status: 'ACTIVE',
        roles: ['EMPLOYEE'],
      });
      setIsCreateModalOpen(true);
    }
  }, [searchParams, canCreate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1);
  };

  const handleStatusChange = async (targetUser: UserItem, newStatus: UserStatus) => {
    if (!canUpdate) return;
    try {
      await updateUserStatus(targetUser.id, newStatus);
      setActionSuccess(`Đã cập nhật trạng thái tài khoản ${targetUser.username} thành ${STATUS_MAP[newStatus].label}.`);
      setUsers((prev) =>
        prev.map((item) => (item.id === targetUser.id ? { ...item, status: newStatus } : item))
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái.';
      alert(msg);
    }
  };

  const handleDeleteUser = async (targetUser: UserItem) => {
    if (!canDelete) return;
    if (currentUser?.id === targetUser.id) {
      alert('Bạn không thể tự xóa tài khoản của chính mình.');
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${targetUser.username}" (${targetUser.email})?`
    );
    if (!confirmed) return;

    try {
      await deleteUser(targetUser.id);
      setActionSuccess(`Đã xóa tài khoản ${targetUser.username}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers(page);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể xóa tài khoản.';
      alert(`Lỗi: ${msg}`);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setCreateData({
      username: '',
      email: '',
      password: '',
      employee_id: null,
      status: 'ACTIVE',
      roles: ['EMPLOYEE'],
    });
    setFormErrors(null);
    setFormGeneralError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors(null);
    setFormGeneralError(null);

    try {
      const payload: CreateUserInput = {
        username: createData.username.trim(),
        email: createData.email.trim(),
        password: createData.password,
        employee_id: createData.employee_id ? Number(createData.employee_id) : null,
        status: createData.status,
        roles: createData.roles,
      };

      const res = await createUser(payload);
      setIsCreateModalOpen(false);
      setActionSuccess(`Đã tạo tài khoản "${res.data.username}" thành công.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setPage(1);
      fetchUsers(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormGeneralError(err.message);
        if (err.errors) setFormErrors(err.errors);
      } else {
        setFormGeneralError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (targetUser: UserItem) => {
    setSelectedUser(targetUser);
    setEditData({
      email: targetUser.email,
      employee_id: targetUser.employee_id,
      status: targetUser.status,
      roles: targetUser.roles.map((r) => r.name),
    });
    setFormErrors(null);
    setFormGeneralError(null);
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setFormErrors(null);
    setFormGeneralError(null);

    try {
      const payload: UpdateUserInput = {
        email: editData.email?.trim(),
        employee_id: editData.employee_id ? Number(editData.employee_id) : null,
        status: editData.status,
        roles: editData.roles,
      };

      await updateUser(selectedUser.id, payload);
      setIsEditModalOpen(false);
      setActionSuccess(`Đã cập nhật thông tin tài khoản "${selectedUser.username}".`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers(page);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormGeneralError(err.message);
        if (err.errors) setFormErrors(err.errors);
      } else {
        setFormGeneralError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Password Modal
  const handleOpenPasswordModal = (targetUser: UserItem) => {
    setSelectedUser(targetUser);
    setPasswordData({
      password: '',
      password_confirmation: '',
    });
    setFormErrors(null);
    setFormGeneralError(null);
    setIsPasswordModalOpen(true);
  };

  // Submit Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (passwordData.password !== passwordData.password_confirmation) {
      setFormGeneralError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsSubmitting(true);
    setFormErrors(null);
    setFormGeneralError(null);

    try {
      await changeUserPassword(selectedUser.id, passwordData);
      setIsPasswordModalOpen(false);
      setActionSuccess(`Đã thay đổi mật khẩu cho tài khoản "${selectedUser.username}" thành công.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormGeneralError(err.message);
        if (err.errors) setFormErrors(err.errors);
      } else {
        setFormGeneralError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle role in form array
  const toggleRoleInArray = (roleName: string, currentRoles: (string | number)[], setter: (roles: string[]) => void) => {
    const stringRoles = currentRoles.map(String);
    if (stringRoles.includes(roleName)) {
      if (stringRoles.length === 1) {
        alert('Tài khoản phải có ít nhất một vai trò.');
        return;
      }
      setter(stringRoles.filter((r) => r !== roleName));
    } else {
      setter([...stringRoles, roleName]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tài khoản & Phân quyền
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý tài khoản đăng nhập, trạng thái khóa và phân quyền RBAC
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span>+</span>
            <span>Tạo tài khoản mới</span>
          </button>
        )}
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:opacity-75 text-xs font-semibold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <input
              type="text"
              placeholder="Tìm theo username, email, tên nhân viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả vai trò</option>
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm khóa</option>
              <option value="LOCKED">Bị khóa</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
            >
              Tìm
            </button>
            {(search || selectedRole || selectedStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedRole('');
                  setSelectedStatus('');
                  setPage(1);
                  fetchUsers(1);
                }}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700"
                title="Xóa bộ lọc"
              >
                ✕
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách tài khoản...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Không thể tải dữ liệu</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
            <button
              onClick={() => fetchUsers(page)}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Thử lại
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl">🛡️</span>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Không tìm thấy tài khoản nào
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Không có tài khoản người dùng nào khớp với bộ lọc.
            </p>
            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Tạo tài khoản mới
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Tài khoản</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Nhân viên liên kết</th>
                    <th className="py-3.5 px-4">Vai trò</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Đăng nhập cuối</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((item) => {
                    const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.ACTIVE;
                    const isSelf = currentUser?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Username */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.username}
                            </span>
                            {isSelf && (
                              <span className="rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-semibold">
                                Bạn
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {item.email}
                        </td>

                        {/* Employee */}
                        <td className="py-3.5 px-4">
                          {item.employee ? (
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {item.employee.full_name}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {item.employee.employee_code} • {item.employee.department || '—'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa liên kết</span>
                          )}
                        </td>

                        {/* Roles */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {item.roles.map((r) => (
                              <span
                                key={r.id}
                                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                                  r.name === 'ADMIN'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                    : r.name === 'DOCTOR'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {r.name}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Last Login */}
                        <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {item.last_login_at
                            ? new Date(item.last_login_at).toLocaleString('vi-VN')
                            : 'Chưa từng'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canUpdate && (
                              <>
                                <button
                                  onClick={() => handleOpenEditModal(item)}
                                  className="rounded px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleOpenPasswordModal(item)}
                                  className="rounded px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                >
                                  Đổi MK
                                </button>
                                <select
                                  value={item.status}
                                  onChange={(e) =>
                                    handleStatusChange(item, e.target.value as UserStatus)
                                  }
                                  disabled={isSelf}
                                  aria-label="Cập nhật trạng thái người dùng"
                                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 disabled:opacity-50"
                                >
                                  <option value="ACTIVE">Hoạt động</option>
                                  <option value="INACTIVE">Khóa tạm</option>
                                  <option value="LOCKED">Khóa vĩnh viễn</option>
                                </select>
                              </>
                            )}

                            {canDelete && !isSelf && (
                              <button
                                onClick={() => handleDeleteUser(item)}
                                className="rounded px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              >
                                Xóa
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

            {/* Pagination Controls */}
            {meta.last_page > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  Hiển thị <span className="font-medium text-slate-700 dark:text-slate-200">{meta.from || 0}</span> -{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.to || 0}</span> trong tổng số{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.total}</span> tài khoản
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={meta.current_page <= 1}
                    className="rounded px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    « Trước
                  </button>

                  {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`rounded px-3 py-1.5 border text-xs font-medium ${
                        meta.current_page === p
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                    disabled={meta.current_page >= meta.last_page}
                    className="rounded px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sau »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Tạo tài khoản mới */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Tạo tài khoản người dùng mới
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formGeneralError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3.5 border border-rose-200 dark:border-rose-900 text-sm text-rose-800 dark:text-rose-300">
                  {formGeneralError}
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createData.username}
                  onChange={(e) => setCreateData({ ...createData, username: e.target.value })}
                  placeholder="bacsi_minh"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                {formErrors?.username && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.username[0]}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                  placeholder="minh@qlpk.vn"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formErrors?.email && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.email[0]}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu khởi tạo <span className="text-rose-500">* (tối thiểu 6 ký tự)</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formErrors?.password && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.password[0]}</p>
                )}
              </div>

              {/* Linked Employee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Liên kết hồ sơ nhân viên
                </label>
                <select
                  value={createData.employee_id || ''}
                  onChange={(e) =>
                    setCreateData({
                      ...createData,
                      employee_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Không liên kết nhân viên --</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code}) - {emp.department || 'Nhân sự'}
                    </option>
                  ))}
                </select>
                {formErrors?.employee_id && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.employee_id[0]}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Trạng thái
                </label>
                <select
                  value={createData.status || 'ACTIVE'}
                  onChange={(e) =>
                    setCreateData({ ...createData, status: e.target.value as UserStatus })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                  <option value="INACTIVE">Tạm khóa (INACTIVE)</option>
                  <option value="LOCKED">Bị khóa (LOCKED)</option>
                </select>
              </div>

              {/* Roles checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Phân quyền vai trò <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  {ALL_ROLES.map((roleName) => {
                    const isChecked = (createData.roles || []).map(String).includes(roleName);
                    return (
                      <label
                        key={roleName}
                        className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleRoleInArray(roleName, createData.roles || [], (roles) =>
                              setCreateData({ ...createData, roles })
                            )
                          }
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{roleName}</span>
                      </label>
                    );
                  })}
                </div>
                {formErrors?.roles && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.roles[0]}</p>
                )}
              </div>

              {/* Submit / Cancel */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa tài khoản */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Chỉnh sửa tài khoản: {selectedUser.username}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formGeneralError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3.5 border border-rose-200 dark:border-rose-900 text-sm text-rose-800 dark:text-rose-300">
                  {formGeneralError}
                </div>
              )}

              {/* Username (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên đăng nhập (cố định)
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedUser.username}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-500 font-mono"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formErrors?.email && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.email[0]}</p>
                )}
              </div>

              {/* Linked Employee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Liên kết hồ sơ nhân viên
                </label>
                <select
                  value={editData.employee_id || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      employee_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Không liên kết nhân viên --</option>
                  {selectedUser.employee && (
                    <option value={selectedUser.employee.id}>
                      {selectedUser.employee.full_name} ({selectedUser.employee.employee_code}) - Hiện tại
                    </option>
                  )}
                  {availableEmployees
                    .filter((e) => e.id !== selectedUser.employee_id)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) - {emp.department || 'Nhân sự'}
                      </option>
                    ))}
                </select>
                {formErrors?.employee_id && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.employee_id[0]}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Trạng thái
                </label>
                <select
                  value={editData.status || 'ACTIVE'}
                  onChange={(e) =>
                    setEditData({ ...editData, status: e.target.value as UserStatus })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                  <option value="INACTIVE">Tạm khóa (INACTIVE)</option>
                  <option value="LOCKED">Bị khóa (LOCKED)</option>
                </select>
              </div>

              {/* Roles checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Phân quyền vai trò <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  {ALL_ROLES.map((roleName) => {
                    const isChecked = (editData.roles || []).map(String).includes(roleName);
                    return (
                      <label
                        key={roleName}
                        className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleRoleInArray(roleName, editData.roles || [], (roles) =>
                              setEditData({ ...editData, roles })
                            )
                          }
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{roleName}</span>
                      </label>
                    );
                  })}
                </div>
                {formErrors?.roles && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.roles[0]}</p>
                )}
              </div>

              {/* Submit / Cancel */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Đổi mật khẩu */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Đổi mật khẩu: {selectedUser.username}
              </h2>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {formGeneralError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3.5 border border-rose-200 dark:border-rose-900 text-sm text-rose-800 dark:text-rose-300">
                  {formGeneralError}
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu mới <span className="text-rose-500">* (tối thiểu 6 ký tự)</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.password}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formErrors?.password && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.password[0]}</p>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.password_confirmation}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      password_confirmation: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formErrors?.password_confirmation && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.password_confirmation[0]}</p>
                )}
              </div>

              {/* Submit / Cancel */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang khởi tạo...</p>
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  );
}
