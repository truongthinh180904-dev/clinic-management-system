<?php

namespace App\Http\Resources;

use App\Models\MedicalRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MedicalRecord
 */
class MedicalRecordResource extends JsonResource
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
            'visit_id' => $this->visit_id,
            'doctor_id' => $this->doctor_id,
            'medical_history' => $this->medical_history,
            'diagnosis' => $this->diagnosis,
            'indication' => $this->indication,
            'result' => $this->result,
            'treatment' => $this->treatment,
            'follow_up_date' => $this->follow_up_date?->format('Y-m-d'),
            'doctor' => $this->whenLoaded('doctor', function () {
                return $this->doctor ? new EmployeeResource($this->doctor) : null;
            }),
            'visit' => $this->whenLoaded('visit', function () {
                return $this->visit ? new VisitResource($this->visit) : null;
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
