<?php

namespace App\Http\Requests\Expense;

use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseRequest extends FormRequest
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
            'category_id' => ['required', 'integer', 'exists:expense_categories,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'string', 'in:CASH,BANK_TRANSFER,CARD'],
            'expense_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string', 'max:1000'],
            'expense_code' => ['nullable', 'string', 'max:50', 'unique:expenses,expense_code'],
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
            'category_id.required' => 'Vui lòng chọn danh mục chi phí.',
            'category_id.integer' => 'Mã danh mục chi phí không hợp lệ.',
            'category_id.exists' => 'Danh mục chi phí không tồn tại trên hệ thống.',
            'amount.required' => 'Vui lòng nhập số tiền chi.',
            'amount.numeric' => 'Số tiền chi phải là số hợp lệ.',
            'amount.gt' => 'Số tiền chi phải lớn hơn 0.',
            'payment_method.required' => 'Vui lòng chọn phương thức thanh toán.',
            'payment_method.in' => 'Phương thức thanh toán phải là CASH, BANK_TRANSFER hoặc CARD.',
            'expense_date.date' => 'Ngày chi không đúng định dạng ngày tháng.',
            'description.max' => 'Mô tả chi phí không được vượt quá 1000 ký tự.',
            'expense_code.unique' => 'Mã phiếu chi đã tồn tại trên hệ thống.',
            'expense_code.max' => 'Mã phiếu chi không được vượt quá 50 ký tự.',
        ];
    }
}
