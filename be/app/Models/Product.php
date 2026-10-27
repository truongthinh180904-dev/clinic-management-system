<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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

    /**
     * Subquery expression for calculating dynamic current stock from inventory transactions.
     */
    public static function stockSubquerySql(): string
    {
        return "(COALESCE((SELECT SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END) FROM inventory_transactions WHERE inventory_transactions.product_id = products.id), 0))";
    }

    /**
     * Scope query to select current stock dynamically.
     */
    public function scopeWithCurrentStock(Builder $query): Builder
    {
        return $query->select('products.*')
            ->selectRaw(static::stockSubquerySql().' as current_stock');
    }

    /**
     * Accessor for current stock.
     */
    public function getCurrentStockAttribute(): float
    {
        if (array_key_exists('current_stock', $this->attributes)) {
            return (float) $this->attributes['current_stock'];
        }

        return (float) $this->inventoryTransactions()
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as total")
            ->value('total');
    }

    /**
     * Accessor for stock status ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK').
     */
    public function getStockStatusAttribute(): string
    {
        $current = $this->current_stock;
        if ($current <= 0) {
            return 'OUT_OF_STOCK';
        }

        if ($current <= (float) ($this->minimum_stock ?? 0)) {
            return 'LOW_STOCK';
        }

        return 'IN_STOCK';
    }

    /**
     * Accessor for low stock boolean flag.
     */
    public function getIsLowStockAttribute(): bool
    {
        return $this->current_stock <= (float) ($this->minimum_stock ?? 0);
    }
}
