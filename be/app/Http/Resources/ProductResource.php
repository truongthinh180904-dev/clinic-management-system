<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $currentStock = (float) $this->current_stock;
        $minimumStock = (float) ($this->minimum_stock ?? 0);
        $isLowStock = $currentStock <= $minimumStock;

        $stockStatus = 'IN_STOCK';
        if ($currentStock <= 0) {
            $stockStatus = 'OUT_OF_STOCK';
        } elseif ($isLowStock) {
            $stockStatus = 'LOW_STOCK';
        }

        $createdAt = $this->created_at instanceof \DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        $updatedAt = $this->updated_at instanceof \DateTimeInterface
            ? $this->updated_at->toIso8601String()
            : ($this->updated_at ? (string) $this->updated_at : null);

        return [
            'id' => $this->id,
            'product_code' => $this->product_code,
            'name' => $this->name,
            'unit' => $this->unit,
            'minimum_stock' => $minimumStock,
            'current_stock' => $currentStock,
            'stock_status' => $stockStatus,
            'is_low_stock' => $isLowStock,
            'status' => $this->status,
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ];
    }
}
