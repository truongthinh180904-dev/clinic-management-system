<?php

namespace App\Http\Requests\MedicalRecord;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMedicalRecordRequest extends FormRequest
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
            'doctor_id' => ['nullable', 'integer', 'exists:employees,id'],
            'medical_history' => ['nullable', 'string'],
            'diagnosis' => ['sometimes', 'required', 'string'],
            'indication' => ['nullable', 'string'],
            'result' => ['nullable', 'string'],
            'treatment' => ['nullable', 'string'],
            'follow_up_date' => ['nullable', 'date'],
            'edit_reason' => ['nullable', 'string', 'max:500'],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'diagnosis.required' => 'Chẩn đoán bệnh không được để trống.',
            'doctor_id.exists' => 'Bác sĩ không tồn tại trong hệ thống.',
            'follow_up_date.date' => 'Ngày tái khám không đúng định dạng ngày tháng.',
        ];
    }
}
