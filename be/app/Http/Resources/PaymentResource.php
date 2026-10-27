<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $paymentDate = $this->payment_date instanceof \DateTimeInterface
            ? $this->payment_date->toIso8601String()
            : (string) $this->payment_date;

        return [
            'id' => $this->id,
            'payment_code' => $this->payment_code,
            'invoice_id' => $this->invoice_id,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method,
            'reference_code' => $this->reference_code,
            'payment_date' => $paymentDate,
            'received_by' => $this->received_by,
            'notes' => $this->notes,
            'invoice' => InvoiceResource::make($this->whenLoaded('invoice')),
            'receiver' => UserResource::make($this->whenLoaded('receiver')),
            'cash_transactions' => $this->whenLoaded('cashTransactions', function () {
                return $this->cashTransactions->map(function ($tx) {
                    return [
                        'id' => $tx->id,
                        'transaction_code' => $tx->transaction_code,
                        'transaction_type' => $tx->transaction_type,
                        'reference_type' => $tx->reference_type,
                        'reference_id' => $tx->reference_id,
                        'amount' => (float) $tx->amount,
                        'payment_method' => $tx->payment_method,
                        'transaction_date' => $tx->transaction_date instanceof \DateTimeInterface
                            ? $tx->transaction_date->toIso8601String()
                            : (string) $tx->transaction_date,
                        'description' => $tx->description,
                        'created_by' => $tx->created_by,
                        'created_at' => $tx->created_at instanceof \DateTimeInterface
                            ? $tx->created_at->toIso8601String()
                            : (string) $tx->created_at,
                    ];
                });
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
