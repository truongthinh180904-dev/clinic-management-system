<?php

namespace App\Http\Resources;

use App\Models\ServicePackage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ServicePackage
 */
class ServicePackageResource extends JsonResource
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
            'package_code' => $this->package_code,
            'name' => $this->name,
            'description' => $this->description,
            'price' => (float) $this->price,
            'total_sessions' => (int) $this->total_sessions,
            'validity_days' => (int) $this->validity_days,
            'status' => $this->status,
            'services_count' => $this->whenCounted('services'),
            'package_services_count' => $this->whenCounted('packageServices'),
            'patient_packages_count' => $this->whenCounted('patientPackages'),
            'services' => ServiceResource::collection($this->whenLoaded('services')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
