<?php

namespace App\Http\Resources;

use App\Models\AlertRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AlertRule
 */
class AlertRuleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $createdAt = $this->created_at instanceof \DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        $updatedAt = $this->updated_at instanceof \DateTimeInterface
            ? $this->updated_at->toIso8601String()
            : ($this->updated_at ? (string) $this->updated_at : null);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'alert_type' => $this->alert_type,
            'threshold_value' => $this->threshold_value !== null ? (float) $this->threshold_value : null,
            'threshold_days' => $this->threshold_days !== null ? (int) $this->threshold_days : null,
            'threshold_sessions' => $this->threshold_sessions !== null ? (int) $this->threshold_sessions : null,
            'status' => $this->status,
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ];
    }
}
