<?php

namespace App\Http\Requests\PatientPackage;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StorePatientPackageRequest extends FormRequest
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
            'package_id' => ['required', 'integer', 'exists:service_packages,id'],
            'purchase_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date', 'after_or_equal:purchase_date'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'total_sessions' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'status' => ['nullable', 'string', 'in:ACTIVE,INACTIVE,COMPLETED,EXPIRED,CANCELLED'],
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
            'package_id.required' => 'Gói dịch vụ không được để trống.',
            'package_id.integer' => 'Mã gói dịch vụ không hợp lệ.',
            'package_id.exists' => 'Gói dịch vụ được chọn không tồn tại trong hệ thống.',
            'purchase_date.date' => 'Ngày mua gói không hợp lệ.',
            'expiry_date.date' => 'Hạn sử dụng gói không hợp lệ.',
            'expiry_date.after_or_equal' => 'Hạn sử dụng gói phải diễn ra sau hoặc trùng với ngày mua gói.',
            'price.numeric' => 'Giá gói tại thời điểm cấp phải là một số hợp lệ.',
            'price.min' => 'Giá gói tại thời điểm cấp không thể âm.',
            'total_sessions.integer' => 'Số buổi liệu trình phải là số nguyên.',
            'total_sessions.min' => 'Số buổi liệu trình phải lớn hơn hoặc bằng 1 buổi.',
            'status.in' => 'Trạng thái gói cấp không hợp lệ (ACTIVE, INACTIVE, COMPLETED, EXPIRED, CANCELLED).',
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
