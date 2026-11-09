<?php

namespace App\Http\Requests\Payment;

use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
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
        $hasInvoiceInRoute = $this->route('invoice') !== null;

        return [
            'invoice_id' => [$hasInvoiceInRoute ? 'nullable' : 'required', 'integer', 'exists:invoices,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'string', 'in:CASH,BANK_TRANSFER,CARD'],
            'reference_code' => ['nullable', 'string', 'max:100'],
            'payment_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'payment_code' => ['nullable', 'string', 'max:50', 'unique:payments,payment_code'],
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
            'invoice_id.required' => 'Vui lòng chọn hóa đơn cần thanh toán.',
            'invoice_id.exists' => 'Hóa đơn không tồn tại trên hệ thống.',
            'amount.required' => 'Vui lòng nhập số tiền thanh toán.',
            'amount.numeric' => 'Số tiền thanh toán phải là số hợp lệ.',
            'amount.gt' => 'Số tiền thanh toán phải lớn hơn 0.',
            'payment_method.required' => 'Vui lòng chọn phương thức thanh toán.',
            'payment_method.in' => 'Phương thức thanh toán phải là CASH, BANK_TRANSFER hoặc CARD.',
            'reference_code.max' => 'Mã tham chiếu giao dịch không vượt quá 100 ký tự.',
            'payment_date.date' => 'Ngày thanh toán không đúng định dạng.',
            'payment_code.unique' => 'Mã phiếu thu đã tồn tại trên hệ thống.',
        ];
    }
}
