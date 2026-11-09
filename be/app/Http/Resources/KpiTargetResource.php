<?php

namespace App\Http\Resources;

use App\Models\KpiTarget;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin KpiTarget
 */
class KpiTargetResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $perf = $this->calculatePerformance();

        $periodStart = $this->period_start instanceof \DateTimeInterface
            ? $this->period_start->format('Y-m-d')
            : ($this->period_start ? substr((string) $this->period_start, 0, 10) : null);

        $periodEnd = $this->period_end instanceof \DateTimeInterface
            ? $this->period_end->format('Y-m-d')
            : ($this->period_end ? substr((string) $this->period_end, 0, 10) : null);

        $createdAt = $this->created_at instanceof \DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        $updatedAt = $this->updated_at instanceof \DateTimeInterface
            ? $this->updated_at->toIso8601String()
            : ($this->updated_at ? (string) $this->updated_at : null);

        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'employee' => new EmployeeResource($this->whenLoaded('employee')),
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'target_revenue' => (float) $this->target_revenue,
            'target_visits' => (int) $this->target_visits,
            'actual_revenue' => (float) $perf['actual_revenue'],
            'actual_visits' => (int) $perf['actual_visits'],
            'revenue_completion_rate' => (float) $perf['revenue_completion_rate'],
            'visits_completion_rate' => (float) $perf['visits_completion_rate'],
            'completion_rate' => (float) $perf['completion_rate'],
            'average_completion_rate' => (float) $perf['average_completion_rate'],
            'evaluation_status' => $perf['evaluation_status'],
            'status' => $perf['evaluation_status'],
            'created_by' => $this->created_by,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ];
    }
}
