<?php

namespace App\Http\Requests\Invoice;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInvoiceRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'subtotal_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'issued_at' => ['nullable', 'date'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'subtotal_amount.numeric' => 'Tổng tiền hàng phải là số.',
            'subtotal_amount.min' => 'Tổng tiền hàng không được âm.',
            'discount_amount.numeric' => 'Số tiền giảm giá phải là số.',
            'discount_amount.min' => 'Số tiền giảm giá không được âm.',
            'issued_at.date' => 'Ngày xuất hóa đơn không đúng định dạng ngày tháng.',
        ];
    }
}
