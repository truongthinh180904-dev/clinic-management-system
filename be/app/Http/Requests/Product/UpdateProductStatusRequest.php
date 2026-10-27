<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(['ACTIVE', 'INACTIVE'])],
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' => 'Trạng thái sản phẩm không được để trống.',
            'status.in' => 'Trạng thái sản phẩm không hợp lệ (ACTIVE hoặc INACTIVE).',
        ];
    }
}
