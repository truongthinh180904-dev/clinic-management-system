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
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
