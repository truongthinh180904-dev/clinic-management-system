<?php

namespace App\Http\Resources;

use App\Models\PackageService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PackageService
 */
class PackageServiceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'package_id' => (int) $this->package_id,
            'service_id' => (int) $this->service_id,
            'quantity' => (int) $this->quantity,
            'service_code' => $this->service?->service_code,
            'service_name' => $this->service?->name,
            'service_price' => $this->service?->price !== null ? (float) $this->service->price : null,
            'service_duration_minutes' => $this->service?->duration_minutes !== null ? (int) $this->service->duration_minutes : null,
            'service_status' => $this->service?->status,
            'service' => new ServiceResource($this->whenLoaded('service')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
