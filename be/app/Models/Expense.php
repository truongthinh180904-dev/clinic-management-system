<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable([
    'expense_code',
    'category_id',
    'amount',
    'payment_method',
    'expense_date',
    'description',
    'approval_status',
    'created_by',
    'approved_by',
    'approved_at',
])]
class Expense extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'expense_date' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function cashTransactions(): MorphMany
    {
        return $this->morphMany(CashTransaction::class, 'reference', 'reference_type', 'reference_id');
    }

    public function approvalRequests(): MorphMany
    {
        return $this->morphMany(ApprovalRequest::class, 'reference', 'reference_type', 'reference_id');
    }
}
