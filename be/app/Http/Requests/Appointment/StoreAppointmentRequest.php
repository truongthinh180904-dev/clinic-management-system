<?php

namespace App\Http\Requests\Appointment;

use Illuminate\Foundation\Http\FormRequest;

class StoreAppointmentRequest extends FormRequest
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
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'appointment_date' => ['required', 'date'],
            'start_time' => ['required', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
            'end_time' => ['required', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
            'appointment_code' => ['nullable', 'string', 'max:50', 'unique:appointments,appointment_code'],
            'status' => ['nullable', 'string', 'in:PENDING,CONFIRMED,COMPLETED,CANCELLED,NO_SHOW'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $startTime = $this->input('start_time');
            $endTime = $this->input('end_time');

            if ($startTime && $endTime) {
                $normalize = function (string $t): string {
                    $parts = explode(':', trim($t));
                    $h = str_pad($parts[0] ?? '0', 2, '0', STR_PAD_LEFT);
                    $m = str_pad($parts[1] ?? '0', 2, '0', STR_PAD_LEFT);
                    $s = str_pad($parts[2] ?? '0', 2, '0', STR_PAD_LEFT);

                    return "{$h}:{$m}:{$s}";
                };

                if ($normalize($startTime) >= $normalize($endTime)) {
                    $validator->errors()->add('end_time', 'Thời gian kết thúc (end_time) phải lớn hơn thời gian bắt đầu (start_time).');
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
            'patient_id.required' => 'Vui lòng chọn bệnh nhân.',
            'patient_id.exists' => 'Bệnh nhân được chọn không tồn tại.',
            'employee_id.required' => 'Vui lòng chọn nhân viên/bác sĩ phụ trách.',
            'employee_id.exists' => 'Nhân viên/bác sĩ được chọn không tồn tại.',
            'service_id.required' => 'Vui lòng chọn dịch vụ khám.',
            'service_id.exists' => 'Dịch vụ khám được chọn không tồn tại.',
            'appointment_date.required' => 'Vui lòng nhập ngày hẹn khám.',
            'appointment_date.date' => 'Ngày hẹn khám không đúng định dạng.',
            'start_time.required' => 'Vui lòng nhập giờ bắt đầu.',
            'start_time.regex' => 'Giờ bắt đầu không đúng định dạng (HH:MM hoặc HH:MM:SS).',
            'end_time.required' => 'Vui lòng nhập giờ kết thúc.',
            'end_time.regex' => 'Giờ kết thúc không đúng định dạng (HH:MM hoặc HH:MM:SS).',
            'appointment_code.unique' => 'Mã lịch hẹn đã tồn tại.',
            'status.in' => 'Trạng thái lịch hẹn không hợp lệ.',
        ];
    }
}
