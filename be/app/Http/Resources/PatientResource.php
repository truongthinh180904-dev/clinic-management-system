<?php

namespace App\Http\Resources;

use App\Models\Patient;
use App\Services\DataMaskingService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Patient
 */
class PatientResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $canBypass = DataMaskingService::canBypassMasking($request->user());

        return [
            'id' => $this->id,
            'patient_code' => $this->patient_code,
            'full_name' => $this->full_name,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender,
            'phone' => $canBypass ? $this->phone : DataMaskingService::maskPhone($this->phone),
            'email' => $this->email,
            'address' => $this->address,
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_phone' => $canBypass ? $this->emergency_contact_phone : DataMaskingService::maskPhone($this->emergency_contact_phone),
            'identity_number' => $this->when(
                isset($this->identity_number) || isset($this->cccd),
                fn () => $canBypass
                    ? ($this->identity_number ?? $this->cccd)
                    : DataMaskingService::maskIdentity($this->identity_number ?? $this->cccd)
            ),
            'first_visit_date' => $this->first_visit_date?->format('Y-m-d'),
            'last_visit_date' => $this->last_visit_date?->format('Y-m-d'),
            'status' => $this->status,
            'notes' => $this->notes,
            'appointments_count' => $this->whenCounted('appointments'),
            'visits_count' => $this->whenCounted('visits'),
            'invoices_count' => $this->whenCounted('invoices'),
            'patient_packages_count' => $this->whenCounted('patientPackages'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
