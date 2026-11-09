<?php

namespace App\Http\Requests\KpiTarget;

use Illuminate\Foundation\Http\FormRequest;

class StoreKpiTargetRequest extends FormRequest
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
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'target_revenue' => ['required', 'numeric', 'min:0'],
            'target_visits' => ['required', 'integer', 'min:0'],
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
            'employee_id.required' => 'Vui lòng chọn nhân viên được giao chỉ tiêu KPI.',
            'employee_id.exists' => 'Nhân viên được chọn không tồn tại trong hệ thống.',
            'period_start.required' => 'Vui lòng chọn ngày bắt đầu kỳ hạn KPI.',
            'period_start.date' => 'Ngày bắt đầu kỳ hạn không đúng định dạng ngày hợp lệ.',
            'period_end.required' => 'Vui lòng chọn ngày kết thúc kỳ hạn KPI.',
            'period_end.date' => 'Ngày kết thúc kỳ hạn không đúng định dạng ngày hợp lệ.',
            'period_end.after_or_equal' => 'Ngày kết thúc kỳ hạn phải lớn hơn hoặc bằng ngày bắt đầu.',
            'target_revenue.required' => 'Vui lòng nhập chỉ tiêu doanh thu.',
            'target_revenue.numeric' => 'Chỉ tiêu doanh thu phải là một số hợp lệ.',
            'target_revenue.min' => 'Chỉ tiêu doanh thu không được nhỏ hơn 0.',
            'target_visits.required' => 'Vui lòng nhập chỉ tiêu số lượt khám.',
            'target_visits.integer' => 'Chỉ tiêu số lượt khám phải là số nguyên.',
            'target_visits.min' => 'Chỉ tiêu số lượt khám không được nhỏ hơn 0.',
        ];
    }
}
