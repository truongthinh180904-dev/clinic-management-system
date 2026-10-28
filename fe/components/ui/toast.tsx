'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToastHandler: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export const toast = {
  success: (message: string, title?: string, duration = 4000) => {
    if (globalToastHandler) {
      globalToastHandler({ type: 'success', message, title, duration });
    }
  },
  error: (message: string, title?: string, duration = 5000) => {
    if (globalToastHandler) {
      globalToastHandler({ type: 'error', message, title, duration });
    }
  },
  warning: (message: string, title?: string, duration = 4500) => {
    if (globalToastHandler) {
      globalToastHandler({ type: 'warning', message, title, duration });
    }
  },
  info: (message: string, title?: string, duration = 4000) => {
    if (globalToastHandler) {
      globalToastHandler({ type: 'info', message, title, duration });
    }
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    globalToastHandler = addToast;
    return () => {
      globalToastHandler = null;
    };
  }, [addToast]);

  const toastMethods = {
    success: (msg: string, title?: string, dur?: number) =>
      addToast({ type: 'success', message: msg, title, duration: dur }),
    error: (msg: string, title?: string, dur?: number) =>
      addToast({ type: 'error', message: msg, title, duration: dur }),
    warning: (msg: string, title?: string, dur?: number) =>
      addToast({ type: 'warning', message: msg, title, duration: dur }),
    info: (msg: string, title?: string, dur?: number) =>
      addToast({ type: 'info', message: msg, title, duration: dur }),
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        toast: toastMethods,
      }}
    >
      {children}
      <ToasterContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return fallback using global toast object if not inside ToastProvider
    return {
      toasts: [],
      addToast: (t: Omit<ToastItem, 'id'>) => globalToastHandler?.(t),
      removeToast: () => {},
      toast,
    };
  }
  return context;
}

function ToasterContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Thông báo hệ thống"
      className="fixed bottom-4 right-4 z-9999 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onRemove(item.id)} />
      ))}
    </aside>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const styles = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      defaultTitle: 'Thành công',
    },
    error: {
      bg: 'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
      defaultTitle: 'Có lỗi xảy ra',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
      defaultTitle: 'Cảnh báo',
    },
    info: {
      bg: 'bg-sky-50 dark:bg-sky-950/90 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100',
      icon: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />,
      defaultTitle: 'Thông tin',
    },
  }[item.type];

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3',
        styles.bg
      )}
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold leading-tight">
          {item.title || styles.defaultTitle}
        </h4>
        <p className="text-xs mt-1 text-slate-700 dark:text-slate-300 break-words leading-relaxed">
          {item.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
