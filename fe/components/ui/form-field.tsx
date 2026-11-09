'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ButtonProps } from '@/components/ui/button';

export interface FormFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | string[] | null;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  const errorMessage = Array.isArray(error) ? error[0] : error;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={htmlFor}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {label}
            {required && <span className="text-rose-500 font-bold ml-1">*</span>}
          </label>
        </div>
      )}

      {children}

      {hint && !errorMessage && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
          {hint}
        </p>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export interface FormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn('space-y-4 pt-4 first:pt-0', className)}>
      <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export interface FormSubmitButtonProps extends ButtonProps {
  isSubmitting?: boolean;
  loadingText?: string;
  submitText?: React.ReactNode;
}

export function FormSubmitButton({
  isSubmitting = false,
  loadingText = 'Đang lưu...',
  submitText = 'Lưu thay đổi',
  disabled,
  children,
  className,
  variant = 'default',
  ...props
}: FormSubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={isSubmitting || disabled}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 transition-all font-medium',
        isSubmitting && 'opacity-85 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        children || submitText
      )}
    </Button>
  );
}

export interface FormAlertProps {
  type?: 'error' | 'success' | 'warning' | 'info';
  title?: string;
  message: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export function FormAlert({
  type = 'error',
  title,
  message,
  className,
  onDismiss,
}: FormAlertProps) {
  const styles = {
    error: {
      bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200',
      icon: <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    },
    info: {
      bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-200',
      icon: <AlertCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />,
    },
  }[type];

  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl p-3.5 border text-xs sm:text-sm flex items-start gap-2.5',
        styles.bg,
        className
      )}
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="leading-relaxed">{message}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
        >
          &times;
        </button>
      )}
    </div>
  );
}
