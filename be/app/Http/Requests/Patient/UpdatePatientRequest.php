<?php

namespace App\Http\Requests\Patient;

use App\Models\Patient;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class UpdatePatientRequest extends FormRequest
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
        $patientId = $this->route('patient') instanceof Patient
            ? $this->route('patient')->id
            : $this->route('patient');

        return [
            'patient_code' => [
                'sometimes',
                'nullable',
                'string',
                'max:50',
                Rule::unique('patients', 'patient_code')->ignore($patientId),
            ],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', 'in:MALE,FEMALE,OTHER'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
            'first_visit_date' => ['nullable', 'date'],
            'last_visit_date' => ['nullable', 'date'],
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
            'full_name.required' => 'Họ và tên bệnh nhân không được để trống.',
            'patient_code.unique' => 'Mã bệnh nhân đã tồn tại trên hệ thống.',
            'email.email' => 'Địa chỉ email không đúng định dạng.',
            'gender.in' => 'Giới tính không hợp lệ (MALE, FEMALE, OTHER).',
            'status.in' => 'Trạng thái bệnh nhân không hợp lệ (ACTIVE, INACTIVE, LOCKED).',
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
