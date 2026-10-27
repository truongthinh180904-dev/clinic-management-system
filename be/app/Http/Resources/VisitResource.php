<?php

namespace App\Http\Resources;

use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Visit
 */
class VisitResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $visitDate = $this->visit_date instanceof \DateTimeInterface
            ? $this->visit_date->toIso8601String()
            : (string) $this->visit_date;

        return [
            'id' => $this->id,
            'visit_code' => $this->visit_code,
            'patient_id' => $this->patient_id,
            'employee_id' => $this->employee_id,
            'service_id' => $this->service_id,
            'patient_package_id' => $this->patient_package_id,
            'appointment_id' => $this->appointment_id,
            'visit_date' => $visitDate,
            'quantity' => (int) $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'discount_amount' => (float) $this->discount_amount,
            'total_amount' => (float) $this->total_amount,
            'payment_status' => $this->payment_status,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'patient' => new PatientResource($this->whenLoaded('patient')),
            'employee' => new EmployeeResource($this->whenLoaded('employee')),
            'service' => new ServiceResource($this->whenLoaded('service')),
            'patient_package' => new PatientPackageResource($this->whenLoaded('patientPackage')),
            'appointment' => new AppointmentResource($this->whenLoaded('appointment')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'medical_record' => $this->whenLoaded('medicalRecord'),
            'invoices' => $this->whenLoaded('invoices'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
