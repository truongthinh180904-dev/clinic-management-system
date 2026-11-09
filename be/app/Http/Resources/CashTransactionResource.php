<?php

namespace App\Http\Resources;

use App\Models\CashTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CashTransaction
 */
class CashTransactionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $transactionDate = $this->transaction_date instanceof \DateTimeInterface
            ? $this->transaction_date->toIso8601String()
            : ($this->transaction_date ? (string) $this->transaction_date : null);

        $createdAt = $this->created_at instanceof \DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        return [
            'id' => $this->id,
            'transaction_code' => $this->transaction_code,
            'transaction_type' => $this->transaction_type,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method,
            'transaction_date' => $transactionDate,
            'description' => $this->description,
            'created_by' => $this->created_by,
            'creator' => UserResource::make($this->whenLoaded('creator')),
            'created_at' => $createdAt,
        ];
    }
}
