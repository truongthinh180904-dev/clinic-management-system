<?php

namespace App\Http\Requests\Employee;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreEmployeeRequest extends FormRequest
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
            'employee_code' => ['nullable', 'string', 'max:50', 'unique:employees,employee_code'],
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', 'in:MALE,FEMALE,OTHER'],
            'position' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'hire_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:ACTIVE,INACTIVE,LOCKED'],
            'notes' => ['nullable', 'string', 'max:1000'],
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
            'full_name.required' => 'Họ và tên nhân viên là bắt buộc.',
            'employee_code.unique' => 'Mã nhân viên đã tồn tại trên hệ thống.',
            'email.email' => 'Địa chỉ email không đúng định dạng.',
            'gender.in' => 'Giới tính không hợp lệ (MALE, FEMALE, OTHER).',
            'status.in' => 'Trạng thái nhân viên không hợp lệ (ACTIVE, INACTIVE, LOCKED).',
            'date_of_birth.before_or_equal' => 'Ngày sinh không thể là ngày trong tương lai.',
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
