export interface PatientFile {
  id: number;
  patient_id: number;
  visit_id: number | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  file_size_formatted: string;
  uploaded_by: number | null;
  uploader?: {
    id: number;
    username: string;
    email: string;
  } | null;
  patient?: {
    id: number;
    patient_code: string;
    full_name: string;
  } | null;
  visit?: {
    id: number;
    visit_code: string;
    visit_date: string | null;
  } | null;
  download_url: string;
  preview_url: string;
  created_at: string;
}

export interface PatientFileFilterParams {
  visit_id?: number | string;
  search?: string;
}
