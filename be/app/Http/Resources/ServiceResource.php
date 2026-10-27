<?php

namespace App\Http\Resources;

use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Service
 */
class ServiceResource extends JsonResource
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
            'service_code' => $this->service_code,
            'name' => $this->name,
            'description' => $this->description,
            'price' => (float) $this->price,
            'duration_minutes' => (int) $this->duration_minutes,
            'status' => $this->status,
            'appointments_count' => $this->whenCounted('appointments'),
            'visits_count' => $this->whenCounted('visits'),
            'packages_count' => $this->whenCounted('packages'),
            'package_services_count' => $this->whenCounted('packageServices'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
