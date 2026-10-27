<?php

namespace App\Http\Resources;

use App\Models\ImportBatch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ImportBatch
 */
class ImportBatchResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $createdAt = $this->created_at instanceof \DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        $completedAt = $this->completed_at instanceof \DateTimeInterface
            ? $this->completed_at->toIso8601String()
            : ($this->completed_at ? (string) $this->completed_at : null);

        return [
            'id' => $this->id,
            'module' => $this->module,
            'file_name' => $this->file_name,
            'total_rows' => (int) $this->total_rows,
            'success_rows' => (int) $this->success_rows,
            'error_rows' => (int) $this->error_rows,
            'status' => $this->status,
            'imported_by' => $this->imported_by,
            'importer' => $this->relationLoaded('importer') && $this->importer ? [
                'id' => $this->importer->id,
                'username' => $this->importer->username,
                'email' => $this->importer->email,
            ] : null,
            'errors' => $this->relationLoaded('errors') ? $this->errors->map(function ($error) {
                return [
                    'id' => $error->id,
                    'batch_id' => $error->batch_id,
                    'row_number' => (int) $error->row_number,
                    'column_name' => $error->column_name,
                    'error_message' => $error->error_message,
                    'raw_data' => $error->raw_data,
                    'created_at' => $error->created_at instanceof \DateTimeInterface
                        ? $error->created_at->toIso8601String()
                        : ($error->created_at ? (string) $error->created_at : null),
                ];
            }) : null,
            'created_at' => $createdAt,
            'completed_at' => $completedAt,
        ];
    }
}
