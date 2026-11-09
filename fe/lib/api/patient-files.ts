import { ApiResponse } from '@/types/auth';
import { PatientFile, PatientFileFilterParams } from '@/types/patient-file';
import { apiClient, getBaseUrl, getStoredToken } from './client';

/**
 * Fetch patient files by patient ID, with optional visit_id and search filters.
 */
export async function getPatientFiles(
  patientId: number | string,
  params?: PatientFileFilterParams
): Promise<ApiResponse<PatientFile[]>> {
  const query = new URLSearchParams();
  if (params?.visit_id) {
    query.set('visit_id', String(params.visit_id));
  }
  if (params?.search) {
    query.set('search', params.search);
  }
  const queryString = query.toString();
  const endpoint = `/patients/${patientId}/files${queryString ? `?${queryString}` : ''}`;
  return apiClient.get<PatientFile[]>(endpoint);
}

/**
 * Fetch patient files attached directly to a specific visit.
 */
export async function getVisitFiles(
  visitId: number | string
): Promise<ApiResponse<PatientFile[]>> {
  return apiClient.get<PatientFile[]>(`/visits/${visitId}/files`);
}

/**
 * Fetch metadata for a specific patient file.
 */
export async function getPatientFile(
  fileId: number | string
): Promise<ApiResponse<PatientFile>> {
  return apiClient.get<PatientFile>(`/patient-files/${fileId}`);
}

/**
 * Upload a clinical file for a patient with XMLHttpRequest to report progress.
 */
export function uploadPatientFile(
  patientId: number | string,
  file: File,
  visitId?: number | string | null,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<PatientFile>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    if (visitId !== undefined && visitId !== null && visitId !== '') {
      formData.append('visit_id', String(visitId));
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/patients/${patientId}/files`;

    xhr.open('POST', url);
    const token = getStoredToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.setRequestHeader('Accept', 'application/json');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response: ApiResponse<PatientFile> = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response);
        } else {
          let errMessage = response.message || `Lỗi tải lên (${xhr.status})`;
          if (response.errors) {
            const firstErr = Object.values(response.errors)[0];
            if (Array.isArray(firstErr) && firstErr.length > 0) {
              errMessage = firstErr[0];
            }
          }
          reject(new Error(errMessage));
        }
      } catch {
        reject(new Error('Phản hồi không hợp lệ từ máy chủ khi tải tệp lên.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Lỗi kết nối mạng khi tải tệp lên.'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload a clinical file directly to a visit with XMLHttpRequest to report progress.
 */
export function uploadVisitFile(
  visitId: number | string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<PatientFile>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/visits/${visitId}/files`;

    xhr.open('POST', url);
    const token = getStoredToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.setRequestHeader('Accept', 'application/json');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response: ApiResponse<PatientFile> = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response);
        } else {
          let errMessage = response.message || `Lỗi tải lên (${xhr.status})`;
          if (response.errors) {
            const firstErr = Object.values(response.errors)[0];
            if (Array.isArray(firstErr) && firstErr.length > 0) {
              errMessage = firstErr[0];
            }
          }
          reject(new Error(errMessage));
        }
      } catch {
        reject(new Error('Phản hồi không hợp lệ từ máy chủ khi tải tệp lên.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Lỗi kết nối mạng khi tải tệp lên.'));
    };

    xhr.send(formData);
  });
}

/**
 * Delete a patient file by ID.
 */
export async function deletePatientFile(fileId: number | string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/patient-files/${fileId}`);
}

/**
 * Get authenticated Blob and ObjectURL for previewing image or PDF.
 */
export async function getPatientFileBlob(
  fileId: number | string
): Promise<{ blob: Blob; blobUrl: string; mimeType: string }> {
  const token = getStoredToken();
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/patient-files/${fileId}/preview`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: '*/*',
    },
  });

  if (!res.ok) {
    let msg = `Không thể tải xem trước tệp (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const mimeType = res.headers.get('content-type') || blob.type || 'application/octet-stream';
  const blobUrl = URL.createObjectURL(blob);
  return { blob, blobUrl, mimeType };
}

/**
 * Download authenticated patient file.
 */
export async function downloadPatientFile(
  fileId: number | string,
  fileName?: string
): Promise<void> {
  const token = getStoredToken();
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/patient-files/${fileId}/download`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: '*/*',
    },
  });

  if (!res.ok) {
    let msg = `Không thể tải xuống tệp (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName || `patient_file_${fileId}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }, 100);
}
