<?php

namespace App\Http\Requests\ServicePackage;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreServicePackageRequest extends FormRequest
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
            'package_code' => ['nullable', 'string', 'max:50', 'unique:service_packages,package_code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:0'],
            'total_sessions' => ['required', 'integer', 'min:1', 'max:1000'],
            'validity_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'status' => ['nullable', 'string', 'in:ACTIVE,INACTIVE,LOCKED'],
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
            'name.required' => 'Tên gói dịch vụ không được để trống.',
            'package_code.unique' => 'Mã gói dịch vụ đã tồn tại trên hệ thống.',
            'price.required' => 'Giá gói dịch vụ không được để trống.',
            'price.numeric' => 'Giá gói dịch vụ phải là một số hợp lệ.',
            'price.min' => 'Giá gói dịch vụ không thể âm (phải lớn hơn hoặc bằng 0).',
            'total_sessions.required' => 'Số buổi khám của gói không được để trống.',
            'total_sessions.integer' => 'Số buổi khám của gói phải là số nguyên.',
            'total_sessions.min' => 'Số buổi khám của gói phải lớn hơn hoặc bằng 1 buổi.',
            'total_sessions.max' => 'Số buổi khám của gói không được vượt quá 1000 buổi.',
            'validity_days.required' => 'Hạn sử dụng gói dịch vụ không được để trống.',
            'validity_days.integer' => 'Hạn sử dụng gói dịch vụ phải là số ngày nguyên.',
            'validity_days.min' => 'Hạn sử dụng gói dịch vụ phải lớn hơn hoặc bằng 1 ngày.',
            'validity_days.max' => 'Hạn sử dụng gói dịch vụ không được vượt quá 3650 ngày (10 năm).',
            'status.in' => 'Trạng thái gói dịch vụ không hợp lệ (ACTIVE, INACTIVE, LOCKED).',
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
