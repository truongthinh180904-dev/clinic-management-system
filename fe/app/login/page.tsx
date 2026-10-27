'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hospital,
  Lock,
  User as UserIcon,
  LogIn,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface DemoAccount {
  label: string;
  role: string;
  username: string;
  badgeVariant: 'default' | 'info' | 'success' | 'warning' | 'secondary';
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'Admin',
    role: 'Quản trị viên',
    username: 'admin',
    badgeVariant: 'default',
    description: 'Toàn quyền cấu hình, tài chính, nhân sự',
  },
  {
    label: 'Bác sĩ',
    role: 'Bác sĩ chuyên khoa',
    username: 'doctor',
    badgeVariant: 'info',
    description: 'Khám bệnh, chỉ định dịch vụ, kê đơn',
  },
  {
    label: 'Tiếp đón',
    role: 'Lễ tân tiếp đón',
    username: 'receptionist',
    badgeVariant: 'success',
    description: 'Tiếp đón bệnh nhân, tạo lịch hẹn',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

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

  const handleFillDemo = (account: DemoAccount) => {
    setUsername(account.username);
    setPassword('Password@123');
    setSelectedDemo(account.username);
    setFieldErrors({});
    setErrorMessage(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-xl dark:bg-slate-900/90 backdrop-blur-xs">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-50 dark:ring-blue-950/50">
              <Hospital className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Hệ Thống Quản Lý Phòng Khám
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Nền tảng Y tế & Quản trị Thông minh QLPK SmartClinic
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Quick Demo Fill Section */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Điền nhanh tài khoản Demo (1-Click):
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = selectedDemo === acc.username;
                  return (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => handleFillDemo(acc)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-white text-blue-700 shadow-xs ring-2 ring-blue-500/20 dark:bg-slate-800 dark:text-blue-300'
                          : 'border-slate-200 bg-white/80 hover:bg-white hover:border-blue-300 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-bold">{acc.label}</span>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-blue-600" />}
                      </div>
                      <Badge variant={acc.badgeVariant} className="text-[10px] px-1 py-0 scale-90">
                        {acc.username}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="flex-1 text-xs sm:text-sm">
                  <p className="font-semibold">Lỗi đăng nhập</p>
                  <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tên đăng nhập hoặc Email
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <Input
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
                    className={`pl-9 h-10 ${
                      fieldErrors.username ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                    }`}
                  />
                </div>
                {fieldErrors.username && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.username}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mật khẩu
                  </Label>
                  <span className="text-[11px] text-slate-400">
                    Mặc định: <code className="font-mono text-blue-600 dark:text-blue-400">Password@123</code>
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
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
                    className={`pl-9 pr-9 h-10 ${
                      fieldErrors.password ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 text-sm font-semibold shadow-md shadow-blue-500/15 gap-2 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang xác thực tài khoản...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Đăng nhập hệ thống</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-0 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Bảo mật y tế chuẩn SaaS • Mã hóa kết nối SSL</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}