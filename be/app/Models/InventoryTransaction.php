<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'product_id',
    'transaction_type',
    'quantity',
    'reference_type',
    'reference_id',
    'transaction_date',
    'created_by',
    'created_at',
])]
class InventoryTransaction extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'transaction_date' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'reference_type', 'reference_id');
    }
}
