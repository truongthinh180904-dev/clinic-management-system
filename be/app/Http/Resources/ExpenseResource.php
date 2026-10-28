<?php

namespace App\Http\Resources;

use App\Models\Expense;
use DateTimeInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Expense
 */
class ExpenseResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $expenseDate = $this->expense_date instanceof DateTimeInterface
            ? $this->expense_date->toIso8601String()
            : ($this->expense_date ? (string) $this->expense_date : null);

        $approvedAt = $this->approved_at instanceof DateTimeInterface
            ? $this->approved_at->toIso8601String()
            : ($this->approved_at ? (string) $this->approved_at : null);

        $rejectionReason = null;
        if ($this->relationLoaded('approvalRequests')) {
            $rejectionReason = $this->approvalRequests->where('status', 'REJECTED')->last()?->rejection_reason;
        } elseif ($this->approval_status === 'REJECTED') {
            $rejectionReason = $this->approvalRequests()->where('status', 'REJECTED')->latest('id')->value('rejection_reason');
        }

        return [
            'id' => $this->id,
            'expense_code' => $this->expense_code,
            'category_id' => $this->category_id,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method,
            'expense_date' => $expenseDate,
            'description' => $this->description,
            'approval_status' => $this->approval_status,
            'created_by' => $this->created_by,
            'approved_by' => $this->approved_by,
            'approved_at' => $approvedAt,
            'rejection_reason' => $rejectionReason,
            'category' => ExpenseCategoryResource::make($this->whenLoaded('category')),
            'creator' => UserResource::make($this->whenLoaded('creator')),
            'approver' => UserResource::make($this->whenLoaded('approver')),
            'cash_transactions' => CashTransactionResource::collection($this->whenLoaded('cashTransactions')),
            'approval_requests' => ApprovalRequestResource::collection($this->whenLoaded('approvalRequests')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
