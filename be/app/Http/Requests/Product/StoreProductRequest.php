<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_code' => ['nullable', 'string', 'max:50', Rule::unique('products', 'product_code')],
            'name' => ['required', 'string', 'max:255'],
            'unit' => ['required', 'string', 'max:50'],
            'minimum_stock' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', Rule::in(['ACTIVE', 'INACTIVE'])],
            'initial_stock' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'product_code.unique' => 'Mã sản phẩm đã tồn tại trên hệ thống.',
            'name.required' => 'Tên thuốc/vật tư không được để trống.',
            'unit.required' => 'Đơn vị tính không được để trống.',
            'minimum_stock.numeric' => 'Mức tồn kho tối thiểu phải là số.',
            'minimum_stock.min' => 'Mức tồn kho tối thiểu không được âm.',
            'initial_stock.numeric' => 'Số lượng tồn đầu kỳ phải là số.',
            'initial_stock.min' => 'Số lượng tồn đầu kỳ không được âm.',
            'status.in' => 'Trạng thái sản phẩm không hợp lệ (ACTIVE hoặc INACTIVE).',
        ];
    }
}
