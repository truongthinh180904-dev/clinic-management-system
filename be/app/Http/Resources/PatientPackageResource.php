<?php

namespace App\Http\Resources;

use App\Models\PatientPackage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PatientPackage
 */
class PatientPackageResource extends JsonResource
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
            'package_id' => $this->package_id,
            'purchase_date' => $this->purchase_date?->format('Y-m-d') ?? (string) $this->purchase_date,
            'expiry_date' => $this->expiry_date?->format('Y-m-d') ?? (string) $this->expiry_date,
            'total_sessions' => (int) $this->total_sessions,
            'used_sessions' => (int) $this->used_sessions,
            'remaining_sessions' => (int) $this->remaining_sessions,
            'price' => (float) $this->price,
            'status' => $this->status,
            'patient' => $this->whenLoaded('patient', function () {
                return [
                    'id' => $this->patient->id,
                    'patient_code' => $this->patient->patient_code,
                    'full_name' => $this->patient->full_name,
                    'phone' => $this->patient->phone,
                    'status' => $this->patient->status,
                ];
            }),
            'package' => new ServicePackageResource($this->whenLoaded('package')),
            'visits_count' => $this->whenCounted('visits'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
