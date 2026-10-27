import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CancelInvoiceInput,
  CreateInvoiceInput,
  CreatePaymentInput,
  Invoice,
  InvoiceQueryParams,
  Payment,
  UpdateInvoiceInput,
} from '@/types/invoice';

/**
 * Build URL query string from parameter object.
 */
function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch paginated list of invoices with filters.
 */
export async function getInvoices(
  params?: InvoiceQueryParams
): Promise<ApiResponse<Invoice[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<Invoice[]>(`/invoices${query}`);
}

/**
 * Fetch single invoice by ID with all relations.
 */
export async function getInvoice(
  id: number | string
): Promise<ApiResponse<Invoice>> {
  return apiClient.get<Invoice>(`/invoices/${id}`);
}

/**
 * Create a new invoice.
 */
export async function createInvoice(
  data: CreateInvoiceInput
): Promise<ApiResponse<Invoice>> {
  return apiClient.post<Invoice>('/invoices', data);
}

/**
 * Update an existing invoice (subtotal / discount).
 */
export async function updateInvoice(
  id: number | string,
  data: UpdateInvoiceInput
): Promise<ApiResponse<Invoice>> {
  return apiClient.put<Invoice>(`/invoices/${id}`, data);
}

/**
 * Cancel an invoice (only allowed if paid_amount === 0).
 */
export async function cancelInvoice(
  id: number | string,
  data?: CancelInvoiceInput
): Promise<ApiResponse<Invoice>> {
  return apiClient.patch<Invoice>(`/invoices/${id}/cancel`, data ?? {});
}

/**
 * Record a payment for a specific invoice (multi-payment / partial payment).
 */
export async function createInvoicePayment(
  invoiceId: number | string,
  data: Omit<CreatePaymentInput, 'invoice_id'>
): Promise<ApiResponse<Payment>> {
  return apiClient.post<Payment>(`/invoices/${invoiceId}/payments`, data);
}

/**
 * Record a payment using general payment endpoint.
 */
export async function createPayment(
  data: CreatePaymentInput
): Promise<ApiResponse<Payment>> {
  return apiClient.post<Payment>('/payments', data);
}

/**
 * Fetch paginated list of payments.
 */
export async function getPayments(
  params?: Record<string, unknown>
): Promise<ApiResponse<Payment[]>> {
  const query = buildQueryString(params);
  return apiClient.get<Payment[]>(`/payments${query}`);
}

/**
 * Fetch a single payment by ID.
 */
export async function getPayment(
  id: number | string
): Promise<ApiResponse<Payment>> {
  return apiClient.get<Payment>(`/payments/${id}`);
}
