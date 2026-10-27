<?php

namespace App\Http\Resources;

use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Appointment
 */
class AppointmentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $appointmentDate = $this->appointment_date instanceof \DateTimeInterface
            ? $this->appointment_date->format('Y-m-d')
            : (string) $this->appointment_date;

        return [
            'id' => $this->id,
            'appointment_code' => $this->appointment_code,
            'patient_id' => $this->patient_id,
            'employee_id' => $this->employee_id,
            'service_id' => $this->service_id,
            'appointment_date' => $appointmentDate,
            'start_time' => (string) $this->start_time,
            'end_time' => (string) $this->end_time,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'patient' => new PatientResource($this->whenLoaded('patient')),
            'employee' => new EmployeeResource($this->whenLoaded('employee')),
            'service' => new ServiceResource($this->whenLoaded('service')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'visits_count' => $this->whenCounted('visits'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
