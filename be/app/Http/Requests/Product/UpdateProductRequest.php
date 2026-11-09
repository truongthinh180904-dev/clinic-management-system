<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $product = $this->route('product');
        $productId = is_object($product) ? $product->id : $product;

        return [
            'product_code' => ['nullable', 'string', 'max:50', Rule::unique('products', 'product_code')->ignore($productId)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'unit' => ['sometimes', 'required', 'string', 'max:50'],
            'minimum_stock' => ['sometimes', 'required', 'numeric', 'min:0'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['ACTIVE', 'INACTIVE'])],
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
            'status.in' => 'Trạng thái sản phẩm không hợp lệ (ACTIVE hoặc INACTIVE).',
        ];
    }
}
