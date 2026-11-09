<?php

namespace App\Http\Resources;

use App\Models\InventoryTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryTransaction
 */
class InventoryTransactionResource extends JsonResource
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

        $transactionDate = $this->transaction_date instanceof \DateTimeInterface
            ? $this->transaction_date->toIso8601String()
            : ($this->transaction_date ? (string) $this->transaction_date : null);

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_code' => $this->product?->product_code,
            'product_name' => $this->product?->name,
            'product_unit' => $this->product?->unit,
            'transaction_type' => $this->transaction_type,
            'quantity' => (float) $this->quantity,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'transaction_date' => $transactionDate,
            'created_by' => $this->created_by,
            'created_at' => $createdAt,
            'product' => $this->relationLoaded('product') && $this->product
                ? new ProductResource($this->product)
                : null,
            'creator' => $this->relationLoaded('creator') && $this->creator
                ? [
                    'id' => $this->creator->id,
                    'username' => $this->creator->username,
                    'email' => $this->creator->email,
                ]
                : null,
        ];
    }
}
