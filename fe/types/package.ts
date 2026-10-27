import { Service } from './service';

export type PackageStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type PatientPackageStatus = 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface ServicePackage {
  id: number;
  package_code: string;
  name: string;
  description: string | null;
  price: number;
  total_sessions: number;
  validity_days: number;
  status: PackageStatus;
  services_count?: number;
  package_services_count?: number;
  patient_packages_count?: number;
  services?: Service[];
  created_at?: string;
  updated_at?: string;
}

export interface PatientPackage {
  id: number;
  patient_id: number;
  package_id: number;
  purchase_date: string;
  expiry_date: string;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  price: number;
  status: PatientPackageStatus;
  patient?: {
    id: number;
    patient_code: string;
    full_name: string;
    phone: string | null;
    status: string;
  };
  package?: ServicePackage;
  visits_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePackageInput {
  package_code?: string;
  name: string;
  description?: string;
  price: number;
  total_sessions: number;
  validity_days: number;
  status?: PackageStatus;
}

export interface UpdatePackageInput {
  package_code?: string;
  name?: string;
  description?: string;
  price?: number;
  total_sessions?: number;
  validity_days?: number;
  status?: PackageStatus;
}

export interface AssignPackageInput {
  package_id: number;
  purchase_date?: string;
  expiry_date?: string;
  price?: number;
  total_sessions?: number;
}

export interface PackageQueryParams {
  search?: string;
  status?: PackageStatus | '';
  min_price?: number;
  max_price?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
