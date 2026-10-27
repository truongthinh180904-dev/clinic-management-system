<?php

namespace App\Http\Requests\ServicePackage;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdatePackageServiceRequest extends FormRequest
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
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
            'quantity' => ['required_without:services', 'nullable', 'integer', 'min:1', 'max:1000'],
            'services' => ['nullable', 'array'],
            'services.*.service_id' => ['required_with:services', 'integer', 'exists:services,id'],
            'services.*.quantity' => ['required_with:services', 'integer', 'min:1', 'max:1000'],
        ];
    }

    /**
     * Custom message for validation errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'service_id.integer' => 'ID dịch vụ phải là số nguyên.',
            'service_id.exists' => 'Dịch vụ được chọn không tồn tại trên hệ thống.',
            'quantity.required_without' => 'Số lượng buổi dịch vụ không được để trống.',
            'quantity.integer' => 'Số lượng buổi dịch vụ phải là số nguyên.',
            'quantity.min' => 'Số lượng buổi dịch vụ phải lớn hơn hoặc bằng 1.',
            'quantity.max' => 'Số lượng buổi dịch vụ không được vượt quá 1000.',
            'services.array' => 'Danh sách dịch vụ phải là dạng danh sách mảng.',
            'services.*.service_id.required_with' => 'Mỗi mục trong danh sách cấu hình phải có ID dịch vụ.',
            'services.*.service_id.exists' => 'Một trong các dịch vụ trong danh sách cấu hình không tồn tại.',
            'services.*.quantity.required_with' => 'Số lượng cho mỗi dịch vụ không được để trống.',
            'services.*.quantity.integer' => 'Số lượng dịch vụ trong danh sách phải là số nguyên.',
            'services.*.quantity.min' => 'Số lượng dịch vụ trong danh sách phải lớn hơn hoặc bằng 1.',
            'services.*.quantity.max' => 'Số lượng dịch vụ trong danh sách không được vượt quá 1000.',
        ];
    }

    /**
     * Handle a failed validation attempt.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
