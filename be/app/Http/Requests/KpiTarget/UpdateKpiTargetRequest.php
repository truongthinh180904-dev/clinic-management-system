<?php

namespace App\Http\Requests\KpiTarget;

use App\Models\KpiTarget;
use Illuminate\Foundation\Http\FormRequest;

class UpdateKpiTargetRequest extends FormRequest
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
        $targetId = $this->route('kpi_target');
        $target = $targetId instanceof KpiTarget ? $targetId : KpiTarget::find($targetId);
        $existingStart = $target?->period_start instanceof \DateTimeInterface
            ? $target->period_start->format('Y-m-d')
            : ($target?->period_start ? substr((string) $target->period_start, 0, 10) : null);
        $endRule = $this->has('period_start')
            ? 'after_or_equal:period_start'
            : ($existingStart ? "after_or_equal:{$existingStart}" : 'after_or_equal:period_start');

        return [
            'employee_id' => ['sometimes', 'integer', 'exists:employees,id'],
            'period_start' => ['sometimes', 'date'],
            'period_end' => ['sometimes', 'date', $endRule],
            'target_revenue' => ['sometimes', 'numeric', 'min:0'],
            'target_visits' => ['sometimes', 'integer', 'min:0'],
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
            'employee_id.exists' => 'Nhân viên được chọn không tồn tại trong hệ thống.',
            'period_start.date' => 'Ngày bắt đầu kỳ hạn không đúng định dạng ngày hợp lệ.',
            'period_end.date' => 'Ngày kết thúc kỳ hạn không đúng định dạng ngày hợp lệ.',
            'period_end.after_or_equal' => 'Ngày kết thúc kỳ hạn phải lớn hơn hoặc bằng ngày bắt đầu.',
            'target_revenue.numeric' => 'Chỉ tiêu doanh thu phải là một số hợp lệ.',
            'target_revenue.min' => 'Chỉ tiêu doanh thu không được nhỏ hơn 0.',
            'target_visits.integer' => 'Chỉ tiêu số lượt khám phải là số nguyên.',
            'target_visits.min' => 'Chỉ tiêu số lượt khám không được nhỏ hơn 0.',
        ];
    }
}
