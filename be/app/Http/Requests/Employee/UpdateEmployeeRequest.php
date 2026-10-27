<?php

namespace App\Http\Requests\Employee;

use App\Models\Employee;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
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
        $employee = $this->route('employee');
        $employeeId = $employee instanceof Employee ? $employee->id : (int) $employee;

        return [
            'employee_code' => [
                'sometimes',
                'nullable',
                'string',
                'max:50',
                Rule::unique('employees', 'employee_code')->ignore($employeeId),
            ],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'gender' => ['sometimes', 'nullable', 'string', 'in:MALE,FEMALE,OTHER'],
            'position' => ['sometimes', 'nullable', 'string', 'max:100'],
            'department' => ['sometimes', 'nullable', 'string', 'max:100'],
            'hire_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'nullable', 'string', 'in:ACTIVE,INACTIVE,LOCKED'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
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
