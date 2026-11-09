<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class StoreInventoryTransactionRequest extends FormRequest
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
        $type = strtoupper((string) $this->input('transaction_type'));

        $quantityRules = ['required', 'numeric'];
        if (in_array($type, ['IN', 'OUT'], true)) {
            $quantityRules[] = 'gt:0';
        } elseif ($type === 'ADJUST') {
            $quantityRules[] = 'not_in:0';
        }

        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'transaction_type' => ['required', 'string', 'in:IN,OUT,ADJUST'],
            'quantity' => $quantityRules,
            'reference_type' => ['nullable', 'string', 'max:100'],
            'reference_id' => ['nullable', 'integer'],
            'transaction_date' => ['nullable', 'date'],
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
            'product_id.required' => 'Mã sản phẩm / vật tư là bắt buộc.',
            'product_id.integer' => 'Mã sản phẩm / vật tư phải là số nguyên.',
            'product_id.exists' => 'Sản phẩm / vật tư không tồn tại trong hệ thống.',
            'transaction_type.required' => 'Loại giao dịch kho là bắt buộc.',
            'transaction_type.in' => 'Loại giao dịch kho phải là IN, OUT hoặc ADJUST.',
            'quantity.required' => 'Số lượng giao dịch là bắt buộc.',
            'quantity.numeric' => 'Số lượng giao dịch phải là số hợp lệ.',
            'quantity.gt' => 'Số lượng giao dịch nhập / xuất kho phải lớn hơn 0.',
            'quantity.not_in' => 'Số lượng điều chỉnh kiểm kê không được bằng 0.',
            'transaction_date.date' => 'Ngày giao dịch không đúng định dạng ngày giờ.',
            'reference_type.max' => 'Loại chứng từ tham chiếu không được vượt quá 100 ký tự.',
        ];
    }
}
