import { apiClient } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CollectDebtPaymentInput,
  DebtorPatient,
  DebtorPatientsQueryParams,
  DebtSummary,
  DebtSummaryQueryParams,
  PatientDebtDetail,
} from '@/types/debt';
import { Payment } from '@/types/invoice';

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
 * Fetch clinic-wide debt summary and aging analysis.
 */
export async function getDebtSummary(
  params?: DebtSummaryQueryParams
): Promise<ApiResponse<DebtSummary>> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<DebtSummary>(`/debts/summary${query}`);
}

/**
 * Fetch paginated list of patients with outstanding debt.
 */
export async function getDebtorPatients(
  params?: DebtorPatientsQueryParams
): Promise<ApiResponse<DebtorPatient[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  return apiClient.get<DebtorPatient[]>(`/debts/patients${query}`);
}

/**
 * Fetch detailed debt ledger for a specific patient.
 */
export async function getPatientDebts(
  patientId: number | string
): Promise<ApiResponse<PatientDebtDetail>> {
  return apiClient.get<PatientDebtDetail>(`/patients/${patientId}/debts`);
}

/**
 * Collect quick installment payment for an invoice.
 */
export async function collectDebtPayment(
  invoiceId: number | string,
  data: Omit<CollectDebtPaymentInput, 'invoice_id'>
): Promise<ApiResponse<Payment>> {
  return apiClient.post<Payment>(`/invoices/${invoiceId}/payments`, data);
}
