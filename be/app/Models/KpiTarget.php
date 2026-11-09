<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'employee_id',
    'period_start',
    'period_end',
    'target_revenue',
    'target_visits',
    'created_by',
])]
class KpiTarget extends Model
{
    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'target_revenue' => 'decimal:2',
            'target_visits' => 'integer',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Calculate actual performance and completion rates for this KPI target.
     *
     * @return array<string, mixed>
     */
    public function calculatePerformance(): array
    {
        $periodStart = Carbon::parse($this->period_start)->startOfDay();
        $periodEnd = Carbon::parse($this->period_end)->endOfDay();
        $employeeId = (int) $this->employee_id;

        // Actual visits: COMPLETED visits for this employee within the period
        $actualVisits = Visit::where('employee_id', $employeeId)
            ->where('status', Visit::STATUS_COMPLETED)
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->whereBetween('visit_date', [$periodStart, $periodEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('visit_date')->whereBetween('created_at', [$periodStart, $periodEnd]));
            })
            ->count();

        // Actual revenue:
        // 1. Invoices linked to the employee's visits OR created by the employee's user account
        $userIds = User::where('employee_id', $employeeId)->pluck('id')->all();

        $invoiceRevenue = (float) Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($employeeId, $userIds) {
                $q->whereHas('visit', fn ($vq) => $vq->where('employee_id', $employeeId));
                if (! empty($userIds)) {
                    $q->orWhereIn('created_by', $userIds);
                }
            })
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->whereBetween('issued_at', [$periodStart, $periodEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$periodStart, $periodEnd]));
            })
            ->sum('total_amount');

        // 2. Visits that are COMPLETED with total_amount but don't have an invoice attached
        $visitRevenueWithoutInvoice = (float) Visit::where('employee_id', $employeeId)
            ->where('status', Visit::STATUS_COMPLETED)
            ->doesntHave('invoices')
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->whereBetween('visit_date', [$periodStart, $periodEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('visit_date')->whereBetween('created_at', [$periodStart, $periodEnd]));
            })
            ->sum('total_amount');

        $actualRevenue = round($invoiceRevenue + $visitRevenueWithoutInvoice, 2);

        $targetRevenue = (float) $this->target_revenue;
        $targetVisits = (int) $this->target_visits;

        $revenueRate = $targetRevenue > 0
            ? round(($actualRevenue / $targetRevenue) * 100, 2)
            : ($actualRevenue > 0 ? 100.0 : 0.0);

        $visitsRate = $targetVisits > 0
            ? round(($actualVisits / $targetVisits) * 100, 2)
            : ($actualVisits > 0 ? 100.0 : 0.0);

        if ($targetRevenue > 0 && $targetVisits > 0) {
            $avgRate = round(($revenueRate + $visitsRate) / 2, 2);
        } elseif ($targetRevenue > 0) {
            $avgRate = $revenueRate;
        } elseif ($targetVisits > 0) {
            $avgRate = $visitsRate;
        } else {
            $avgRate = 0.0;
        }

        if ($avgRate >= 100.0) {
            $status = 'EXCEEDED';
        } elseif ($avgRate >= 80.0) {
            $status = 'ON_TRACK';
        } else {
            $status = 'BEHIND';
        }

        return [
            'actual_revenue' => $actualRevenue,
            'actual_visits' => $actualVisits,
            'revenue_completion_rate' => $revenueRate,
            'visits_completion_rate' => $visitsRate,
            'completion_rate' => $avgRate,
            'average_completion_rate' => $avgRate,
            'evaluation_status' => $status,
        ];
    }
}
