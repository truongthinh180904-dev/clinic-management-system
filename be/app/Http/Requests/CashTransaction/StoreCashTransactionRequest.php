<?php

namespace App\Http\Requests\CashTransaction;

use Illuminate\Foundation\Http\FormRequest;

class StoreCashTransactionRequest extends FormRequest
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
            'transaction_code' => ['nullable', 'string', 'max:50', 'unique:cash_transactions,transaction_code'],
            'transaction_type' => ['required', 'string', 'in:IN,OUT'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'string', 'in:CASH,BANK_TRANSFER,CARD'],
            'transaction_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string', 'max:1000'],
            'reference_type' => ['nullable', 'string', 'max:100'],
            'reference_id' => ['nullable', 'integer'],
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
            'transaction_code.unique' => 'Mã giao dịch sổ quỹ đã tồn tại trên hệ thống.',
            'transaction_code.max' => 'Mã giao dịch không được vượt quá 50 ký tự.',
            'transaction_type.required' => 'Vui lòng chọn loại giao dịch (IN hoặc OUT).',
            'transaction_type.in' => 'Loại giao dịch phải là IN (Thu) hoặc OUT (Chi).',
            'amount.required' => 'Vui lòng nhập số tiền giao dịch.',
            'amount.numeric' => 'Số tiền giao dịch phải là số hợp lệ.',
            'amount.gt' => 'Số tiền giao dịch phải lớn hơn 0.',
            'payment_method.required' => 'Vui lòng chọn phương thức thanh toán.',
            'payment_method.in' => 'Phương thức thanh toán phải là CASH, BANK_TRANSFER hoặc CARD.',
            'transaction_date.date' => 'Ngày giao dịch không đúng định dạng.',
            'description.max' => 'Mô tả giao dịch không được vượt quá 1000 ký tự.',
        ];
    }
}
