<?php

namespace App\Http\Requests\Service;

use App\Models\Service;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class UpdateServiceRequest extends FormRequest
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
        $serviceId = $this->route('service') instanceof Service
            ? $this->route('service')->id
            : $this->route('service');

        return [
            'service_code' => [
                'sometimes',
                'nullable',
                'string',
                'max:50',
                Rule::unique('services', 'service_code')->ignore($serviceId),
            ],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'duration_minutes' => ['sometimes', 'required', 'integer', 'min:1', 'max:1440'],
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
            'name.required' => 'Tên dịch vụ không được để trống.',
            'service_code.unique' => 'Mã dịch vụ đã tồn tại trên hệ thống.',
            'price.required' => 'Giá dịch vụ không được để trống.',
            'price.numeric' => 'Giá dịch vụ phải là một số hợp lệ.',
            'price.min' => 'Giá dịch vụ không thể âm (phải lớn hơn hoặc bằng 0).',
            'duration_minutes.required' => 'Thời lượng thực hiện dịch vụ không được để trống.',
            'duration_minutes.integer' => 'Thời lượng thực hiện dịch vụ phải là số nguyên phút.',
            'duration_minutes.min' => 'Thời lượng dịch vụ phải lớn hơn 0 phút.',
            'duration_minutes.max' => 'Thời lượng dịch vụ không được vượt quá 1440 phút (24 giờ).',
            'status.in' => 'Trạng thái dịch vụ không hợp lệ (ACTIVE, INACTIVE, LOCKED).',
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
