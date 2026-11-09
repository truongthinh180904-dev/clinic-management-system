import { ApiResponse } from '@/types/auth';

const TOKEN_STORAGE_KEY = 'qlpk_token';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]> | null;
  data?: unknown;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]> | null,
    data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export const getBaseUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1'
  ).replace(/\/$/, '');
};

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, token, headers: customHeaders, ...customOptions } = options;
  const baseUrl = getBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;

  const currentToken = token !== undefined ? token : getStoredToken();

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(customHeaders as Record<string, string>),
  };

  const config: RequestInit = {
    headers,
    ...customOptions,
  };

  if (body !== undefined) {
    config.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi kết nối tới máy chủ.';
    throw new ApiError(message, 0);
  }

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    json = {
      success: response.ok,
      message: response.statusText || 'Phản hồi không hợp lệ từ máy chủ.',
      data: null as unknown as T,
    };
  }

  if (!response.ok) {
    throw new ApiError(
      json.message || `Lỗi yêu cầu: mã trạng thái ${response.status}`,
      response.status,
      json.errors || null,
      json.data
    );
  }

  return json;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
