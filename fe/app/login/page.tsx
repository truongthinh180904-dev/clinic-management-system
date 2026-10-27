'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/admin');
    }
  }, [authLoading, isAuthenticated, router]);

  const validateForm = (): boolean => {
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      errors.username = 'Vui lòng nhập tên đăng nhập hoặc email.';
    }
    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    } else if (password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      router.push('/admin');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Đăng nhập không thành công.');
        if (err.errors) {
          const newErrors: { username?: string; password?: string } = {};
          if (err.errors.username) newErrors.username = err.errors.username[0];
          if (err.errors.password) newErrors.password = err.errors.password[0];
          setFieldErrors(newErrors);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-xl border border-slate-100 dark:border-slate-800">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 text-2xl font-bold">
            +
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Hệ Thống Quản Lý Phòng Khám
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Đăng nhập để truy cập vào phân hệ quản trị
          </p>
        </div>

        {/* Global Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900/50 text-sm text-red-700 dark:text-red-300"
          >
            <div className="flex items-center gap-2 font-medium">
              <span>⚠️</span>
              <span>Lỗi đăng nhập:</span>
            </div>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Tên đăng nhập hoặc Email
            </label>
            <div className="mt-1.5">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (fieldErrors.username) {
                    setFieldErrors((prev) => ({ ...prev, username: undefined }));
                  }
                }}
                disabled={isSubmitting}
                placeholder="admin hoặc email@clinic.vn"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  fieldErrors.username
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                }`}
              />
              {fieldErrors.username && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.username}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Mật khẩu
            </label>
            <div className="mt-1.5">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                disabled={isSubmitting}
                placeholder="••••••••"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  fieldErrors.password
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                }`}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Đang xử lý đăng nhập...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        {/* Demo credentials hint for development */}
        <div className="mt-6 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">Tài khoản mặc định (Seeder):</p>
          <p>Admin: <code className="text-blue-600 dark:text-blue-400">admin</code> / <code className="text-blue-600 dark:text-blue-400">Password@123</code></p>
          <p>Bác sĩ: <code className="text-blue-600 dark:text-blue-400">doctor</code> / <code className="text-blue-600 dark:text-blue-400">Password@123</code></p>
        </div>
      </div>
    </div>
  );
}
