export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface Service {
  id: number;
  service_code: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  status: ServiceStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateServiceInput {
  service_code?: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  status?: ServiceStatus;
}

export interface UpdateServiceInput {
  service_code?: string;
  name?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  status?: ServiceStatus;
}

export interface ServiceQueryParams {
  search?: string;
  status?: ServiceStatus | '';
  min_price?: number;
  max_price?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
