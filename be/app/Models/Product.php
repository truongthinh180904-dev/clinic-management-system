<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'product_code',
    'name',
    'unit',
    'minimum_stock',
    'status',
])]
class Product extends Model
{
    protected function casts(): array
    {
        return [
            'minimum_stock' => 'decimal:3',
        ];
    }

    public function inventoryTransactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'product_id');
    }
}
