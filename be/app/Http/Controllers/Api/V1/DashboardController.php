<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ApprovalRequest;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Get aggregated summary statistics for the dashboard.
     */
    public function summary(Request $request): JsonResponse
    {
        $startDate = $request->filled('start_date')
            ? Carbon::parse((string) $request->input('start_date'))->startOfDay()
            : now()->startOfMonth()->startOfDay();

        $endDate = $request->filled('end_date')
            ? Carbon::parse((string) $request->input('end_date'))->endOfDay()
            : now()->endOfDay();

        if ($startDate > $endDate) {
            [$startDate, $endDate] = [$endDate->copy()->startOfDay(), $startDate->copy()->endOfDay()];
        }

        // Invoiced Revenue in period
        $invoicedAmount = (float) Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('issued_at', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$startDate, $endDate]));
            })
            ->sum('total_amount');

        // Collected Payments in period
        $collectedAmount = (float) Payment::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('payment_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('payment_date')->whereBetween('created_at', [$startDate, $endDate]));
        })->sum('amount');

        // Debt Amount in period
        $debtAmount = (float) Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('issued_at', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$startDate, $endDate]));
            })
            ->sum('remaining_amount');

        // Approved Expenses in period
        $expenseAmount = (float) Expense::where('approval_status', 'APPROVED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('expense_date', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('expense_date')->whereBetween('created_at', [$startDate, $endDate]));
            })
            ->sum('amount');

        // Net Cashflow
        $netCashflow = round($collectedAmount - $expenseAmount, 2);

        // Total Visits in period
        $totalVisits = Visit::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('visit_date', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate]));
            })
            ->count();

        // Visits Today
        $visitsToday = Visit::where('status', '!=', 'CANCELLED')
            ->where(function ($q) {
                $q->whereDate('visit_date', today())
                    ->orWhere(fn ($sq) => $sq->whereNull('visit_date')->whereDate('created_at', today()));
            })
            ->count();

        // Appointments Today
        $appointmentsToday = Appointment::where('status', '!=', 'CANCELLED')
            ->whereDate('appointment_date', today())
            ->count();

        // New Patients in period
        $newPatients = Patient::whereBetween('created_at', [$startDate, $endDate])->count();

        // Low stock products count
        $lowStockCount = Product::where('status', 'ACTIVE')
            ->withSum(['inventoryTransactions as stock_in' => function ($q) {
                $q->where('transaction_type', 'IN');
            }], 'quantity')
            ->withSum(['inventoryTransactions as stock_out' => function ($q) {
                $q->where('transaction_type', 'OUT');
            }], 'quantity')
            ->withSum(['inventoryTransactions as stock_adjust' => function ($q) {
                $q->where('transaction_type', 'ADJUST');
            }], 'quantity')
            ->get()
            ->filter(function ($product) {
                $currentStock = ((float) ($product->stock_in ?? 0)) - ((float) ($product->stock_out ?? 0)) + ((float) ($product->stock_adjust ?? 0));
                $minStock = (float) ($product->minimum_stock ?? 0);

                return ($minStock > 0 && $currentStock <= $minStock) || $currentStock < 0;
            })
            ->count();

        // Pending Approval Requests
        $pendingApprovals = ApprovalRequest::where('status', 'PENDING')->count();

        return response()->json([
            'success' => true,
            'message' => 'Lấy dữ liệu tổng quan dashboard thành công.',
            'data' => [
                'invoiced_amount' => round($invoicedAmount, 2),
                'total_revenue' => round($invoicedAmount, 2),
                'collected_amount' => round($collectedAmount, 2),
                'paid_amount' => round($collectedAmount, 2),
                'debt_amount' => round($debtAmount, 2),
                'total_debt' => round($debtAmount, 2),
                'remaining_debt' => round($debtAmount, 2),
                'expense_amount' => round($expenseAmount, 2),
                'approved_expenses' => round($expenseAmount, 2),
                'net_cashflow' => $netCashflow,
                'total_visits' => $totalVisits,
                'visits_in_period' => $totalVisits,
                'visits_today' => $visitsToday,
                'appointments_today' => $appointmentsToday,
                'new_patients' => $newPatients,
                'low_stock_products' => $lowStockCount,
                'low_stock_count' => $lowStockCount,
                'pending_approvals' => $pendingApprovals,
                'pending_approvals_count' => $pendingApprovals,
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
            ],
        ], 200);
    }

    /**
     * Get revenue, collection, expense, and net cashflow chart data.
     */
    public function revenueChart(Request $request): JsonResponse
    {
        $days = max(1, min(90, (int) $request->input('days', 30)));

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = Carbon::parse((string) $request->input('start_date'))->startOfDay();
            $endDate = Carbon::parse((string) $request->input('end_date'))->endOfDay();
            if ($startDate > $endDate) {
                [$startDate, $endDate] = [$endDate->copy()->startOfDay(), $startDate->copy()->endOfDay()];
            }
        } elseif ($request->filled('start_date')) {
            $startDate = Carbon::parse((string) $request->input('start_date'))->startOfDay();
            $endDate = now()->endOfDay();
        } else {
            $startDate = now()->subDays($days - 1)->startOfDay();
            $endDate = now()->endOfDay();
        }

        $invoices = Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('issued_at', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$startDate, $endDate]));
            })
            ->get(['issued_at', 'created_at', 'total_amount']);

        $invoicesByDate = [];
        foreach ($invoices as $inv) {
            $dateKey = ($inv->issued_at ?? $inv->created_at)?->format('Y-m-d');
            if ($dateKey) {
                $invoicesByDate[$dateKey] = ($invoicesByDate[$dateKey] ?? 0) + (float) $inv->total_amount;
            }
        }

        $payments = Payment::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('payment_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('payment_date')->whereBetween('created_at', [$startDate, $endDate]));
        })->get(['payment_date', 'created_at', 'amount']);

        $paymentsByDate = [];
        foreach ($payments as $pay) {
            $dateKey = ($pay->payment_date ?? $pay->created_at)?->format('Y-m-d');
            if ($dateKey) {
                $paymentsByDate[$dateKey] = ($paymentsByDate[$dateKey] ?? 0) + (float) $pay->amount;
            }
        }

        $expenses = Expense::where('approval_status', 'APPROVED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('expense_date', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('expense_date')->whereBetween('created_at', [$startDate, $endDate]));
            })
            ->get(['expense_date', 'created_at', 'amount']);

        $expensesByDate = [];
        foreach ($expenses as $exp) {
            $dateKey = ($exp->expense_date ?? $exp->created_at)?->format('Y-m-d');
            if ($dateKey) {
                $expensesByDate[$dateKey] = ($expensesByDate[$dateKey] ?? 0) + (float) $exp->amount;
            }
        }

        $chartData = [];
        $cursor = $startDate->copy()->startOfDay();
        $endLimit = $endDate->copy()->startOfDay();

        while ($cursor <= $endLimit) {
            $dateStr = $cursor->format('Y-m-d');
            $invAmt = (float) ($invoicesByDate[$dateStr] ?? 0);
            $colAmt = (float) ($paymentsByDate[$dateStr] ?? 0);
            $expAmt = (float) ($expensesByDate[$dateStr] ?? 0);

            $chartData[] = [
                'date' => $dateStr,
                'invoiced_amount' => round($invAmt, 2),
                'collected_amount' => round($colAmt, 2),
                'expense_amount' => round($expAmt, 2),
                'net_cashflow' => round($colAmt - $expAmt, 2),
            ];

            $cursor->addDay();
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy dữ liệu biểu đồ doanh thu thành công.',
            'data' => $chartData,
        ], 200);
    }

    /**
     * Get visit trend statistics by date and status breakdown.
     */
    public function visitTrends(Request $request): JsonResponse
    {
        $days = max(1, min(90, (int) $request->input('days', 14)));

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = Carbon::parse((string) $request->input('start_date'))->startOfDay();
            $endDate = Carbon::parse((string) $request->input('end_date'))->endOfDay();
            if ($startDate > $endDate) {
                [$startDate, $endDate] = [$endDate->copy()->startOfDay(), $startDate->copy()->endOfDay()];
            }
        } elseif ($request->filled('start_date')) {
            $startDate = Carbon::parse((string) $request->input('start_date'))->startOfDay();
            $endDate = now()->endOfDay();
        } else {
            $startDate = now()->subDays($days - 1)->startOfDay();
            $endDate = now()->endOfDay();
        }

        $visits = Visit::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('visit_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate]));
        })->get(['visit_date', 'created_at', 'status']);

        $visitsByDate = [];
        $totalByStatus = [
            'WAITING' => 0,
            'SCHEDULED' => 0,
            'IN_PROGRESS' => 0,
            'COMPLETED' => 0,
            'CANCELLED' => 0,
        ];

        foreach ($visits as $visit) {
            $dateKey = ($visit->visit_date ?? $visit->created_at)?->format('Y-m-d');
            $status = strtoupper((string) $visit->status);

            if (isset($totalByStatus[$status])) {
                $totalByStatus[$status]++;
            }
            if ($status === 'SCHEDULED') {
                $totalByStatus['WAITING']++;
            } elseif ($status === 'WAITING') {
                $totalByStatus['SCHEDULED']++;
            }

            if ($dateKey) {
                if (! isset($visitsByDate[$dateKey])) {
                    $visitsByDate[$dateKey] = [
                        'total' => 0,
                        'waiting' => 0,
                        'scheduled' => 0,
                        'in_progress' => 0,
                        'completed' => 0,
                        'cancelled' => 0,
                    ];
                }
                $visitsByDate[$dateKey]['total']++;
                if ($status === 'SCHEDULED') {
                    $visitsByDate[$dateKey]['scheduled']++;
                    $visitsByDate[$dateKey]['waiting']++;
                } elseif ($status === 'WAITING') {
                    $visitsByDate[$dateKey]['waiting']++;
                    $visitsByDate[$dateKey]['scheduled']++;
                } elseif ($status === 'IN_PROGRESS') {
                    $visitsByDate[$dateKey]['in_progress']++;
                } elseif ($status === 'COMPLETED') {
                    $visitsByDate[$dateKey]['completed']++;
                } elseif ($status === 'CANCELLED') {
                    $visitsByDate[$dateKey]['cancelled']++;
                }
            }
        }

        $dailyTrends = [];
        $cursor = $startDate->copy()->startOfDay();
        $endLimit = $endDate->copy()->startOfDay();

        while ($cursor <= $endLimit) {
            $dateStr = $cursor->format('Y-m-d');
            $stats = $visitsByDate[$dateStr] ?? [
                'total' => 0,
                'waiting' => 0,
                'scheduled' => 0,
                'in_progress' => 0,
                'completed' => 0,
                'cancelled' => 0,
            ];

            $dailyTrends[] = [
                'date' => $dateStr,
                'total' => $stats['total'],
                'waiting' => $stats['waiting'],
                'scheduled' => $stats['scheduled'],
                'in_progress' => $stats['in_progress'],
                'completed' => $stats['completed'],
                'cancelled' => $stats['cancelled'],
            ];

            $cursor->addDay();
        }

        $totalAll = $visits->count();

        return response()->json([
            'success' => true,
            'message' => 'Lấy dữ liệu xu hướng lượt khám thành công.',
            'data' => [
                'trends' => $dailyTrends,
                'daily' => $dailyTrends,
                'by_status' => [
                    'WAITING' => $totalByStatus['WAITING'],
                    'SCHEDULED' => $totalByStatus['SCHEDULED'],
                    'IN_PROGRESS' => $totalByStatus['IN_PROGRESS'],
                    'COMPLETED' => $totalByStatus['COMPLETED'],
                    'CANCELLED' => $totalByStatus['CANCELLED'],
                    'TOTAL' => $totalAll,
                ],
                'status_distribution' => [
                    'WAITING' => $totalByStatus['WAITING'],
                    'SCHEDULED' => $totalByStatus['SCHEDULED'],
                    'IN_PROGRESS' => $totalByStatus['IN_PROGRESS'],
                    'COMPLETED' => $totalByStatus['COMPLETED'],
                    'CANCELLED' => $totalByStatus['CANCELLED'],
                    'TOTAL' => $totalAll,
                ],
                'total_visits' => $totalAll,
            ],
        ], 200);
    }

    /**
     * Get top services, packages, and doctor performance.
     */
    public function topPerformers(Request $request): JsonResponse
    {
        $limit = max(1, min(50, (int) $request->input('limit', 5)));
        $startDate = $request->filled('start_date') ? Carbon::parse((string) $request->input('start_date'))->startOfDay() : null;
        $endDate = $request->filled('end_date') ? Carbon::parse((string) $request->input('end_date'))->endOfDay() : null;

        if ($startDate && $endDate && $startDate > $endDate) {
            [$startDate, $endDate] = [$endDate->copy()->startOfDay(), $startDate->copy()->endOfDay()];
        }

        // Top Services
        $topServices = Service::query()
            ->select('services.id', 'services.service_code', 'services.name', 'services.price')
            ->withCount(['visits as visit_count' => function ($q) use ($startDate, $endDate) {
                $q->where('status', '!=', 'CANCELLED');
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('visit_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }])
            ->withSum(['visits as total_revenue' => function ($q) use ($startDate, $endDate) {
                $q->where('status', '!=', 'CANCELLED');
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('visit_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }], 'total_amount')
            ->orderByDesc('visit_count')
            ->orderByDesc('total_revenue')
            ->limit($limit)
            ->get()
            ->map(function ($s) {
                return [
                    'id' => $s->id,
                    'service_id' => $s->id,
                    'service_code' => $s->service_code,
                    'name' => $s->name,
                    'service_name' => $s->name,
                    'price' => (float) $s->price,
                    'visit_count' => (int) ($s->visit_count ?? 0),
                    'total_revenue' => round((float) ($s->total_revenue ?? 0), 2),
                ];
            })
            ->values()
            ->all();

        // Top Packages
        $topPackages = ServicePackage::query()
            ->select('service_packages.id', 'service_packages.package_code', 'service_packages.name', 'service_packages.price')
            ->withCount(['patientPackages as sold_count' => function ($q) use ($startDate, $endDate) {
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('purchase_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('purchase_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }])
            ->withSum(['patientPackages as total_revenue' => function ($q) use ($startDate, $endDate) {
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('purchase_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('purchase_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }], 'price')
            ->orderByDesc('sold_count')
            ->orderByDesc('total_revenue')
            ->limit($limit)
            ->get()
            ->map(function ($p) {
                return [
                    'id' => $p->id,
                    'package_id' => $p->id,
                    'package_code' => $p->package_code,
                    'name' => $p->name,
                    'package_name' => $p->name,
                    'price' => (float) $p->price,
                    'sold_count' => (int) ($p->sold_count ?? 0),
                    'purchase_count' => (int) ($p->sold_count ?? 0),
                    'total_revenue' => round((float) ($p->total_revenue ?? 0), 2),
                ];
            })
            ->values()
            ->all();

        // Doctor Performance
        $topDoctors = Employee::query()
            ->select('employees.id', 'employees.employee_code', 'employees.full_name', 'employees.department', 'employees.position')
            ->withCount(['visits as total_visits' => function ($q) use ($startDate, $endDate) {
                $q->where('status', '!=', 'CANCELLED');
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('visit_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }])
            ->withCount(['visits as completed_visits' => function ($q) use ($startDate, $endDate) {
                $q->where('status', 'COMPLETED');
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('visit_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }])
            ->withSum(['visits as total_revenue' => function ($q) use ($startDate, $endDate) {
                $q->where('status', '!=', 'CANCELLED');
                if ($startDate && $endDate) {
                    $q->where(fn ($sq) => $sq->whereBetween('visit_date', [$startDate, $endDate])
                        ->orWhere(fn ($ssq) => $ssq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate])));
                }
            }], 'total_amount')
            ->orderByDesc('total_visits')
            ->orderByDesc('total_revenue')
            ->limit($limit)
            ->get()
            ->map(function ($d) {
                return [
                    'id' => $d->id,
                    'employee_id' => $d->id,
                    'doctor_id' => $d->id,
                    'employee_code' => $d->employee_code,
                    'full_name' => $d->full_name,
                    'doctor_name' => $d->full_name,
                    'department' => $d->department,
                    'position' => $d->position,
                    'total_visits' => (int) ($d->total_visits ?? 0),
                    'completed_visits' => (int) ($d->completed_visits ?? 0),
                    'total_revenue' => round((float) ($d->total_revenue ?? 0), 2),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách top hiệu suất thành công.',
            'data' => [
                'top_services' => $topServices,
                'top_packages' => $topPackages,
                'top_doctors' => $topDoctors,
                'doctor_performance' => $topDoctors,
            ],
        ], 200);
    }
}
