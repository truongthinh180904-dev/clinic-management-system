<?php

namespace App\Http\Requests\Visit;

use Illuminate\Foundation\Http\FormRequest;

class UpdateVisitStatusRequest extends FormRequest
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
            'status' => ['required', 'string', 'in:SCHEDULED,IN_PROGRESS,COMPLETED,CANCELLED'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.required' => 'Vui lòng chọn trạng thái lượt khám.',
            'status.in' => 'Trạng thái lượt khám không hợp lệ (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED).',
        ];
    }
}
