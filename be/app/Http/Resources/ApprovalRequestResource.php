<?php

namespace App\Http\Resources;

use App\Models\ApprovalRequest;
use App\Models\Expense;
use DateTimeInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ApprovalRequest
 */
class ApprovalRequestResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $createdAt = $this->created_at instanceof DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        $approvedAt = $this->approved_at instanceof DateTimeInterface
            ? $this->approved_at->toIso8601String()
            : ($this->approved_at ? (string) $this->approved_at : null);

        $referenceData = null;
        if ($this->relationLoaded('reference') && $this->reference) {
            if ($this->reference instanceof Expense) {
                $categoryData = null;
                if ($this->reference->relationLoaded('category') && $this->reference->category) {
                    $categoryData = [
                        'id' => $this->reference->category->id,
                        'name' => $this->reference->category->name,
                    ];
                }

                $referenceData = [
                    'id' => $this->reference->id,
                    'expense_code' => $this->reference->expense_code,
                    'category_id' => $this->reference->category_id,
                    'category' => $categoryData,
                    'amount' => (float) $this->reference->amount,
                    'payment_method' => $this->reference->payment_method,
                    'expense_date' => $this->reference->expense_date instanceof DateTimeInterface
                        ? $this->reference->expense_date->toIso8601String()
                        : ($this->reference->expense_date ? (string) $this->reference->expense_date : null),
                    'description' => $this->reference->description,
                    'approval_status' => $this->reference->approval_status,
                    'created_by' => $this->reference->created_by,
                    'approved_by' => $this->reference->approved_by,
                    'approved_at' => $this->reference->approved_at instanceof DateTimeInterface
                        ? $this->reference->approved_at->toIso8601String()
                        : ($this->reference->approved_at ? (string) $this->reference->approved_at : null),
                ];
            } else {
                $referenceData = $this->reference->toArray();
            }
        }

        return [
            'id' => $this->id,
            'request_type' => $this->request_type,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'requested_by' => $this->requested_by,
            'approved_by' => $this->approved_by,
            'status' => $this->status,
            'reason' => $this->reason,
            'rejection_reason' => $this->rejection_reason,
            'created_at' => $createdAt,
            'approved_at' => $approvedAt,
            'requester' => UserResource::make($this->whenLoaded('requester')),
            'approver' => UserResource::make($this->whenLoaded('approver')),
            'reference' => $referenceData,
            'expense' => ($referenceData && $this->reference instanceof Expense) ? $referenceData : null,
        ];
    }
}
