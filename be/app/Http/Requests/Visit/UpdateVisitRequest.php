<?php

namespace App\Http\Requests\Visit;

use App\Models\Service;
use App\Models\Visit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVisitRequest extends FormRequest
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
        $visitId = $this->route('visit') instanceof Visit
            ? $this->route('visit')->id
            : $this->route('visit');

        return [
            'patient_id' => ['sometimes', 'integer', 'exists:patients,id'],
            'employee_id' => ['sometimes', 'integer', 'exists:employees,id'],
            'service_id' => ['sometimes', 'integer', 'exists:services,id'],
            'visit_date' => ['sometimes', 'date'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
            'patient_package_id' => ['nullable', 'integer', 'exists:patient_packages,id'],
            'status' => ['nullable', 'string', 'in:SCHEDULED,IN_PROGRESS,COMPLETED,CANCELLED'],
            'payment_status' => ['nullable', 'string', 'in:UNPAID,PARTIALLY_PAID,PAID,REFUNDED'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'visit_code' => ['nullable', 'string', 'max:50', Rule::unique('visits', 'visit_code')->ignore($visitId)],
        ];
    }

    /**
     * Custom validation logic.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $visitId = $this->route('visit') instanceof Visit
                ? $this->route('visit')->id
                : $this->route('visit');

            $existingVisit = $visitId ? Visit::find($visitId) : null;

            $qty = $this->has('quantity')
                ? (int) $this->input('quantity')
                : ($existingVisit?->quantity ?? 1);

            $serviceId = $this->input('service_id', $existingVisit?->service_id);
            if ($this->has('unit_price')) {
                $unitPrice = (float) $this->input('unit_price');
            } elseif ($existingVisit?->unit_price !== null) {
                $unitPrice = (float) $existingVisit->unit_price;
            } elseif ($serviceId) {
                $unitPrice = (float) (Service::where('id', $serviceId)->value('price') ?? 0);
            } else {
                $unitPrice = 0.0;
            }

            $discountAmount = $this->has('discount_amount')
                ? (float) $this->input('discount_amount')
                : (float) ($existingVisit?->discount_amount ?? 0);

            if ($discountAmount < 0) {
                $validator->errors()->add('discount_amount', 'Số tiền giảm giá không được âm.');
            } elseif ($discountAmount > ($qty * $unitPrice)) {
                $validator->errors()->add('discount_amount', 'Số tiền giảm giá không được vượt quá tổng thành tiền của dịch vụ.');
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
            'patient_id.exists' => 'Bệnh nhân không tồn tại trên hệ thống.',
            'employee_id.exists' => 'Nhân viên không tồn tại trên hệ thống.',
            'service_id.exists' => 'Dịch vụ không tồn tại trên hệ thống.',
            'visit_date.date' => 'Ngày giờ khám không đúng định dạng.',
            'quantity.min' => 'Số lượng dịch vụ phải tối thiểu là 1.',
            'unit_price.min' => 'Đơn giá không được âm.',
            'discount_amount.min' => 'Số tiền giảm giá không được âm.',
            'status.in' => 'Trạng thái lượt khám không hợp lệ (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED).',
            'payment_status.in' => 'Trạng thái thanh toán không hợp lệ (UNPAID, PARTIALLY_PAID, PAID, REFUNDED).',
            'visit_code.unique' => 'Mã lượt khám đã tồn tại trên hệ thống.',
        ];
    }
}
