<?php

namespace App\Http\Resources;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Invoice
 */
class InvoiceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $issuedAt = $this->issued_at instanceof \DateTimeInterface
            ? $this->issued_at->toIso8601String()
            : (string) $this->issued_at;

        return [
            'id' => $this->id,
            'invoice_code' => $this->invoice_code,
            'patient_id' => $this->patient_id,
            'visit_id' => $this->visit_id,
            'patient_package_id' => $this->patient_package_id,
            'subtotal_amount' => (float) $this->subtotal_amount,
            'discount_amount' => (float) $this->discount_amount,
            'total_amount' => (float) $this->total_amount,
            'paid_amount' => (float) $this->paid_amount,
            'remaining_amount' => (float) $this->remaining_amount,
            'status' => $this->status,
            'issued_at' => $issuedAt,
            'created_by' => $this->created_by,
            'patient' => new PatientResource($this->whenLoaded('patient')),
            'visit' => new VisitResource($this->whenLoaded('visit')),
            'patient_package' => new PatientPackageResource($this->whenLoaded('patientPackage')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'payments' => $this->whenLoaded('payments'),
            'clinical_record' => $this->whenLoaded('visit', function () {
                $mr = $this->visit?->medicalRecord;
                if (! $mr) {
                    return null;
                }

                return [
                    'id' => $mr->id,
                    'doctor_id' => $mr->doctor_id,
                    'doctor_name' => $mr->doctor?->full_name ?? $this->visit?->employee?->full_name,
                    'diagnosis' => $mr->diagnosis,
                    'medical_history' => $mr->medical_history,
                    'indication' => $mr->indication,
                    'result' => $mr->result,
                    'treatment' => $mr->treatment,
                    'follow_up_date' => $mr->follow_up_date instanceof \DateTimeInterface
                        ? $mr->follow_up_date->format('Y-m-d')
                        : (string) $mr->follow_up_date,
                    'created_at' => $mr->created_at?->toIso8601String(),
                ];
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
