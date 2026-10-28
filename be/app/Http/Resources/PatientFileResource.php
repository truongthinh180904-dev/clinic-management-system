<?php

namespace App\Http\Resources;

use App\Models\PatientFile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PatientFile
 */
class PatientFileResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'patient_id' => $this->patient_id,
            'visit_id' => $this->visit_id,
            'file_name' => $this->file_name,
            'storage_path' => $this->storage_path,
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            'file_size_formatted' => $this->formatFileSize($this->file_size),
            'uploaded_by' => $this->uploaded_by,
            'uploader' => $this->whenLoaded('uploader', function () {
                return $this->uploader ? [
                    'id' => $this->uploader->id,
                    'username' => $this->uploader->username,
                    'email' => $this->uploader->email,
                ] : null;
            }),
            'patient' => $this->whenLoaded('patient', function () {
                return $this->patient ? [
                    'id' => $this->patient->id,
                    'patient_code' => $this->patient->patient_code,
                    'full_name' => $this->patient->full_name,
                ] : null;
            }),
            'visit' => $this->whenLoaded('visit', function () {
                return $this->visit ? [
                    'id' => $this->visit->id,
                    'visit_code' => $this->visit->visit_code,
                    'visit_date' => $this->visit->visit_date?->toIso8601String(),
                ] : null;
            }),
            'download_url' => url("/api/v1/patient-files/{$this->id}/download"),
            'preview_url' => url("/api/v1/patient-files/{$this->id}/preview"),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Format file size to human readable representation.
     */
    protected function formatFileSize(?int $bytes): string
    {
        if (! $bytes || $bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $power = min((int) floor(log($bytes, 1024)), count($units) - 1);

        return round($bytes / (1024 ** $power), 2).' '.$units[$power];
    }
}
