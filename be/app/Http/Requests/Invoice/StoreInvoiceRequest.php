<?php

namespace App\Http\Requests\Invoice;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
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
            'patient_id' => ['nullable', 'integer', 'exists:patients,id'],
            'visit_id' => ['nullable', 'integer', 'exists:visits,id'],
            'patient_package_id' => ['nullable', 'integer', 'exists:patient_packages,id'],
            'invoice_code' => ['nullable', 'string', 'max:50', 'unique:invoices,invoice_code'],
            'subtotal_amount' => ['required', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'issued_at' => ['nullable', 'date'],
        ];
    }

    /**
     * Custom validation logic.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $patientId = $this->input('patient_id');
            $visitId = $this->input('visit_id');
            $patientPackageId = $this->input('patient_package_id');

            if (! $patientId && ! $visitId && ! $patientPackageId) {
                $validator->errors()->add('patient_id', 'Vui lòng chọn bệnh nhân, lượt khám hoặc gói dịch vụ để lập hóa đơn.');
            }

            $subtotal = (float) $this->input('subtotal_amount', 0);
            $discount = (float) ($this->input('discount_amount') ?? 0);

            if ($discount < 0) {
                $validator->errors()->add('discount_amount', 'Số tiền giảm giá không được âm.');
            } elseif ($discount > $subtotal) {
                $validator->errors()->add('discount_amount', 'Số tiền giảm giá không được vượt quá tổng tiền hàng.');
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
            'visit_id.exists' => 'Lượt khám không tồn tại trên hệ thống.',
            'patient_package_id.exists' => 'Gói dịch vụ của bệnh nhân không tồn tại trên hệ thống.',
            'invoice_code.unique' => 'Mã hóa đơn đã tồn tại trên hệ thống.',
            'subtotal_amount.required' => 'Vui lòng nhập tổng tiền hàng.',
            'subtotal_amount.numeric' => 'Tổng tiền hàng phải là số.',
            'subtotal_amount.min' => 'Tổng tiền hàng không được âm.',
            'discount_amount.numeric' => 'Số tiền giảm giá phải là số.',
            'discount_amount.min' => 'Số tiền giảm giá không được âm.',
            'issued_at.date' => 'Ngày xuất hóa đơn không đúng định dạng ngày tháng.',
        ];
    }
}
