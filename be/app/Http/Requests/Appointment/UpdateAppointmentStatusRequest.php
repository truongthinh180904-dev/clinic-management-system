<?php

namespace App\Http\Requests\Appointment;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAppointmentStatusRequest extends FormRequest
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
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:PENDING,CONFIRMED,COMPLETED,CANCELLED,NO_SHOW'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->input('status') === 'CANCELLED') {
                $reason = trim((string) ($this->input('reason') ?? $this->input('notes', '')));
                if ($reason === '') {
                    $validator->errors()->add('notes', 'Vui lòng cung cấp lý do khi hủy lịch hẹn.');
                }
            }
        });
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.required' => 'Vui lòng chọn trạng thái lịch hẹn.',
            'status.in' => 'Trạng thái lịch hẹn không hợp lệ (PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW).',
        ];
    }
}
