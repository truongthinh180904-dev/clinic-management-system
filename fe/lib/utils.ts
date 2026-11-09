import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0 ₫';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Parse the total drug cost from a medical record's treatment text.
 * Example treatment text contains: "=> TỔNG CỘNG TIỀN THUỐC: 30.000 ₫"
 * or lines with "= X.XXX ₫"
 */
export function parsePrescriptionDrugCost(treatmentText?: string | null): number {
  if (!treatmentText) return 0;

  const summaryMatch = treatmentText.match(/TỔNG CỘNG TIỀN THUỐC:\s*([\d.,]+)\s*₫/i);
  if (summaryMatch) {
    return Number(summaryMatch[1].replace(/\D/g, '')) || 0;
  }

  let total = 0;
  const lines = treatmentText.split('\n');
  for (const line of lines) {
    const match = line.match(/=\s*([\d.,]+)\s*₫/);
    if (match) {
      total += Number(match[1].replace(/\D/g, '')) || 0;
    }
  }
  return total;
}
