<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Expense;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\PatientPackage;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Service;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * Parse and validate start_date and end_date parameters from the request.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function parseDateRange(Request $request): array
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

        return [$startDate, $endDate];
    }

    /**
     * Financial & Profitability Report.
     * GET /api/v1/reports/financial
     */
    public function financial(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);

        // 1. Invoices in period
        $invoicesQuery = Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('issued_at', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$startDate, $endDate]));
            });

        $invoicedAmount = (float) (clone $invoicesQuery)->sum('total_amount');
        $subtotalAmount = (float) (clone $invoicesQuery)->sum('subtotal_amount');
        $discountAmount = (float) (clone $invoicesQuery)->sum('discount_amount');
        $debtAmount = (float) (clone $invoicesQuery)->sum('remaining_amount');
        $invoicesCount = (clone $invoicesQuery)->count();

        // 2. Payments collected in period
        $paymentsQuery = Payment::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('payment_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('payment_date')->whereBetween('created_at', [$startDate, $endDate]));
        });

        $collectedAmount = (float) (clone $paymentsQuery)->sum('amount');
        $paymentsCount = (clone $paymentsQuery)->count();

        // 3. Approved Expenses in period
        $expensesQuery = Expense::where('approval_status', 'APPROVED')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('expense_date', [$startDate, $endDate])
                    ->orWhere(fn ($sq) => $sq->whereNull('expense_date')->whereBetween('created_at', [$startDate, $endDate]));
            });

        $expenseAmount = (float) (clone $expensesQuery)->sum('amount');
        $expensesCount = (clone $expensesQuery)->count();

        // 4. Net figures
        $netProfit = round($invoicedAmount - $expenseAmount, 2);
        $netCashflow = round($collectedAmount - $expenseAmount, 2);

        // 5. Expenses by category
        $expensesByCategoryRaw = (clone $expensesQuery)
            ->with('category')
            ->selectRaw('category_id, SUM(amount) as total_amount, COUNT(*) as expense_count')
            ->groupBy('category_id')
            ->get();

        $expensesByCategory = $expensesByCategoryRaw->map(function ($item) use ($expenseAmount) {
            $catAmount = (float) $item->total_amount;
            $percentage = $expenseAmount > 0 ? round(($catAmount / $expenseAmount) * 100, 2) : 0;

            return [
                'category_id' => $item->category_id,
                'category_name' => $item->category?->name ?? 'Chi phí chung',
                'name' => $item->category?->name ?? 'Chi phí chung',
                'total_amount' => round($catAmount, 2),
                'amount' => round($catAmount, 2),
                'expense_count' => (int) $item->expense_count,
                'count' => (int) $item->expense_count,
                'percentage' => $percentage,
            ];
        })->sortByDesc('total_amount')->values()->all();

        // 6. Revenue and Expenses by Payment Method
        $paymentsByMethod = (clone $paymentsQuery)
            ->selectRaw('payment_method, SUM(amount) as total_collected, COUNT(*) as payment_count')
            ->groupBy('payment_method')
            ->get()
            ->keyBy(fn ($item) => strtoupper(trim((string) $item->payment_method)));

        $expensesByMethod = (clone $expensesQuery)
            ->selectRaw('payment_method, SUM(amount) as total_expense, COUNT(*) as expense_count')
            ->groupBy('payment_method')
            ->get()
            ->keyBy(fn ($item) => strtoupper(trim((string) $item->payment_method)));

        $allMethods = array_unique(array_merge(
            ['CASH', 'BANK_TRANSFER', 'CARD'],
            $paymentsByMethod->keys()->all(),
            $expensesByMethod->keys()->all()
        ));

        $byPaymentMethod = [];
        $byPaymentMethodMap = [];

        foreach ($allMethods as $method) {
            $payItem = $paymentsByMethod->get($method);
            $expItem = $expensesByMethod->get($method);

            $methodCollected = (float) ($payItem?->total_collected ?? 0);
            $methodExpense = (float) ($expItem?->total_expense ?? 0);
            $methodNet = round($methodCollected - $methodExpense, 2);

            $methodData = [
                'payment_method' => $method,
                'method' => $method,
                'collected_amount' => round($methodCollected, 2),
                'collected' => round($methodCollected, 2),
                'expense_amount' => round($methodExpense, 2),
                'expense' => round($methodExpense, 2),
                'net_amount' => $methodNet,
                'net' => $methodNet,
                'payment_count' => (int) ($payItem?->payment_count ?? 0),
                'expense_count' => (int) ($expItem?->expense_count ?? 0),
            ];

            $byPaymentMethod[] = $methodData;
            $byPaymentMethodMap[$method] = $methodData;
        }

        // 7. Daily timeline / time series in period
        $allInvoices = (clone $invoicesQuery)->get(['issued_at', 'created_at', 'total_amount']);
        $invoicesByDate = [];
        foreach ($allInvoices as $inv) {
            $d = ($inv->issued_at ?? $inv->created_at)?->format('Y-m-d');
            if ($d) {
                $invoicesByDate[$d] = ($invoicesByDate[$d] ?? 0) + (float) $inv->total_amount;
            }
        }

        $allPayments = (clone $paymentsQuery)->get(['payment_date', 'created_at', 'amount']);
        $paymentsByDate = [];
        foreach ($allPayments as $pay) {
            $d = ($pay->payment_date ?? $pay->created_at)?->format('Y-m-d');
            if ($d) {
                $paymentsByDate[$d] = ($paymentsByDate[$d] ?? 0) + (float) $pay->amount;
            }
        }

        $allExpenses = (clone $expensesQuery)->get(['expense_date', 'created_at', 'amount']);
        $expensesByDate = [];
        foreach ($allExpenses as $exp) {
            $d = ($exp->expense_date ?? $exp->created_at)?->format('Y-m-d');
            if ($d) {
                $expensesByDate[$d] = ($expensesByDate[$d] ?? 0) + (float) $exp->amount;
            }
        }

        $dailySeries = [];
        $cursor = $startDate->copy()->startOfDay();
        $endLimit = $endDate->copy()->startOfDay();

        while ($cursor <= $endLimit) {
            $dateStr = $cursor->format('Y-m-d');
            $dayInvoiced = (float) ($invoicesByDate[$dateStr] ?? 0);
            $dayCollected = (float) ($paymentsByDate[$dateStr] ?? 0);
            $dayExpense = (float) ($expensesByDate[$dateStr] ?? 0);

            $dailySeries[] = [
                'date' => $dateStr,
                'invoiced_amount' => round($dayInvoiced, 2),
                'collected_amount' => round($dayCollected, 2),
                'expense_amount' => round($dayExpense, 2),
                'net_cashflow' => round($dayCollected - $dayExpense, 2),
                'net_profit' => round($dayInvoiced - $dayExpense, 2),
            ];

            $cursor->addDay();
        }

        $summary = [
            'invoiced_amount' => round($invoicedAmount, 2),
            'total_invoiced' => round($invoicedAmount, 2),
            'subtotal_amount' => round($subtotalAmount, 2),
            'discount_amount' => round($discountAmount, 2),
            'collected_amount' => round($collectedAmount, 2),
            'total_collected' => round($collectedAmount, 2),
            'debt_amount' => round($debtAmount, 2),
            'new_debt' => round($debtAmount, 2),
            'total_debt' => round($debtAmount, 2),
            'expense_amount' => round($expenseAmount, 2),
            'total_expenses' => round($expenseAmount, 2),
            'net_profit' => $netProfit,
            'net_cashflow' => $netCashflow,
            'invoices_count' => $invoicesCount,
            'payments_count' => $paymentsCount,
            'expenses_count' => $expensesCount,
        ];

        return response()->json([
            'success' => true,
            'message' => 'Lấy báo cáo tài chính thành công.',
            'data' => [
                'summary' => $summary,
                'invoiced_amount' => round($invoicedAmount, 2),
                'collected_amount' => round($collectedAmount, 2),
                'debt_amount' => round($debtAmount, 2),
                'expense_amount' => round($expenseAmount, 2),
                'net_profit' => $netProfit,
                'net_cashflow' => $netCashflow,
                'expenses_by_category' => $expensesByCategory,
                'by_payment_method' => $byPaymentMethod,
                'payment_methods_breakdown' => $byPaymentMethodMap,
                'daily_series' => $dailySeries,
                'daily' => $dailySeries,
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
            ],
        ], 200);
    }

    /**
     * Clinical Operations & Visit Activity Report.
     * GET /api/v1/reports/clinical
     */
    public function clinical(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);

        // 1. Appointments in period
        $appointmentsQuery = Appointment::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('appointment_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('appointment_date')->whereBetween('created_at', [$startDate, $endDate]));
        });

        $totalAppointments = (clone $appointmentsQuery)->count();
        $completedAppointments = (clone $appointmentsQuery)->where('status', 'COMPLETED')->count();
        $cancelledAppointments = (clone $appointmentsQuery)->where('status', 'CANCELLED')->count();
        $scheduledAppointments = (clone $appointmentsQuery)->whereIn('status', ['SCHEDULED', 'CONFIRMED'])->count();

        // Attended appointments: either status is COMPLETED or has associated visit records
        $attendedAppointments = (clone $appointmentsQuery)->where(function ($q) {
            $q->where('status', 'COMPLETED')
                ->orWhereHas('visits');
        })->count();

        $attendanceRate = $totalAppointments > 0
            ? round(($attendedAppointments / $totalAppointments) * 100, 2)
            : 0;

        // 2. Visits in period
        $visitsQuery = Visit::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('visit_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('visit_date')->whereBetween('created_at', [$startDate, $endDate]));
        });

        $allVisits = (clone $visitsQuery)->get(['id', 'employee_id', 'service_id', 'patient_package_id', 'visit_date', 'created_at', 'status', 'total_amount']);
        $totalVisits = $allVisits->count();

        $statusCounts = [
            'SCHEDULED' => 0,
            'WAITING' => 0,
            'IN_PROGRESS' => 0,
            'COMPLETED' => 0,
            'CANCELLED' => 0,
        ];

        $totalRevenue = 0.0;
        $packageSessionsUsed = 0;

        foreach ($allVisits as $visit) {
            $status = strtoupper((string) $visit->status);
            if (isset($statusCounts[$status])) {
                $statusCounts[$status]++;
            }
            if ($status === 'SCHEDULED') {
                $statusCounts['WAITING']++;
            } elseif ($status === 'WAITING') {
                $statusCounts['SCHEDULED']++;
            }

            if ($status !== 'CANCELLED') {
                $totalRevenue += (float) ($visit->total_amount ?? 0);
                if ($visit->patient_package_id !== null) {
                    $packageSessionsUsed++;
                }
            }
        }

        // Active patient packages & total sessions
        $activePackagesCount = PatientPackage::where('status', 'ACTIVE')->count();
        $totalPackageSessionsUsed = (int) PatientPackage::sum('used_sessions');

        // 3. Doctor performance breakdown
        $doctorsQuery = (clone $visitsQuery)
            ->where('status', '!=', 'CANCELLED')
            ->whereNotNull('employee_id')
            ->selectRaw('employee_id, COUNT(*) as total_visits, SUM(CASE WHEN status = "COMPLETED" THEN 1 ELSE 0 END) as completed_visits, SUM(total_amount) as total_revenue')
            ->groupBy('employee_id')
            ->with('employee')
            ->get();

        $visitsByDoctor = $doctorsQuery->map(function ($item) {
            $employee = $item->employee;

            return [
                'employee_id' => $item->employee_id,
                'doctor_id' => $item->employee_id,
                'employee_code' => $employee?->employee_code ?? '',
                'doctor_name' => $employee?->full_name ?? 'N/A',
                'name' => $employee?->full_name ?? 'N/A',
                'position' => $employee?->position ?? '',
                'total_visits' => (int) $item->total_visits,
                'visit_count' => (int) $item->total_visits,
                'completed_visits' => (int) $item->completed_visits,
                'total_revenue' => round((float) ($item->total_revenue ?? 0), 2),
            ];
        })->sortByDesc('total_visits')->values()->all();

        // 4. Service utilization breakdown
        $servicesQuery = (clone $visitsQuery)
            ->where('status', '!=', 'CANCELLED')
            ->whereNotNull('service_id')
            ->selectRaw('service_id, COUNT(*) as total_visits, SUM(CASE WHEN status = "COMPLETED" THEN 1 ELSE 0 END) as completed_visits, SUM(total_amount) as total_revenue')
            ->groupBy('service_id')
            ->with('service')
            ->get();

        $visitsByService = $servicesQuery->map(function ($item) {
            $service = $item->service;

            return [
                'service_id' => $item->service_id,
                'service_code' => $service?->service_code ?? '',
                'service_name' => $service?->name ?? 'N/A',
                'name' => $service?->name ?? 'N/A',
                'price' => (float) ($service?->price ?? 0),
                'total_visits' => (int) $item->total_visits,
                'visit_count' => (int) $item->total_visits,
                'completed_visits' => (int) $item->completed_visits,
                'total_revenue' => round((float) ($item->total_revenue ?? 0), 2),
            ];
        })->sortByDesc('total_visits')->values()->all();

        // 5. Daily clinical trends
        $appointmentsByDate = [];
        foreach ((clone $appointmentsQuery)->get(['appointment_date', 'created_at']) as $app) {
            $d = ($app->appointment_date ?? $app->created_at)?->format('Y-m-d');
            if ($d) {
                $appointmentsByDate[$d] = ($appointmentsByDate[$d] ?? 0) + 1;
            }
        }

        $visitsByDate = [];
        $completedVisitsByDate = [];
        foreach ($allVisits as $visit) {
            $d = ($visit->visit_date ?? $visit->created_at)?->format('Y-m-d');
            if ($d) {
                $visitsByDate[$d] = ($visitsByDate[$d] ?? 0) + 1;
                if (strtoupper((string) $visit->status) === 'COMPLETED') {
                    $completedVisitsByDate[$d] = ($completedVisitsByDate[$d] ?? 0) + 1;
                }
            }
        }

        $dailySeries = [];
        $cursor = $startDate->copy()->startOfDay();
        $endLimit = $endDate->copy()->startOfDay();

        while ($cursor <= $endLimit) {
            $dateStr = $cursor->format('Y-m-d');
            $dailySeries[] = [
                'date' => $dateStr,
                'appointments_count' => (int) ($appointmentsByDate[$dateStr] ?? 0),
                'appointments' => (int) ($appointmentsByDate[$dateStr] ?? 0),
                'visits_count' => (int) ($visitsByDate[$dateStr] ?? 0),
                'visits' => (int) ($visitsByDate[$dateStr] ?? 0),
                'completed_visits' => (int) ($completedVisitsByDate[$dateStr] ?? 0),
            ];
            $cursor->addDay();
        }

        $summary = [
            'total_appointments' => $totalAppointments,
            'completed_appointments' => $completedAppointments,
            'cancelled_appointments' => $cancelledAppointments,
            'scheduled_appointments' => $scheduledAppointments,
            'attended_appointments' => $attendedAppointments,
            'attendance_rate' => $attendanceRate,
            'total_visits' => $totalVisits,
            'completed_visits' => $statusCounts['COMPLETED'],
            'in_progress_visits' => $statusCounts['IN_PROGRESS'],
            'scheduled_visits' => $statusCounts['SCHEDULED'],
            'cancelled_visits' => $statusCounts['CANCELLED'],
            'used_package_sessions' => $packageSessionsUsed,
            'package_sessions_used' => $packageSessionsUsed,
            'active_packages_count' => $activePackagesCount,
            'total_revenue' => round($totalRevenue, 2),
        ];

        return response()->json([
            'success' => true,
            'message' => 'Lấy báo cáo hoạt động khám chữa bệnh thành công.',
            'data' => [
                'summary' => $summary,
                'appointments' => [
                    'total' => $totalAppointments,
                    'total_appointments' => $totalAppointments,
                    'completed' => $completedAppointments,
                    'cancelled' => $cancelledAppointments,
                    'scheduled' => $scheduledAppointments,
                    'attendance_rate' => $attendanceRate,
                ],
                'attendance_rate' => $attendanceRate,
                'visits' => [
                    'total' => $totalVisits,
                    'total_visits' => $totalVisits,
                    'completed' => $statusCounts['COMPLETED'],
                    'in_progress' => $statusCounts['IN_PROGRESS'],
                    'scheduled' => $statusCounts['SCHEDULED'],
                    'cancelled' => $statusCounts['CANCELLED'],
                    'by_status' => $statusCounts,
                ],
                'visits_by_status' => $statusCounts,
                'package_sessions' => [
                    'used_in_period' => $packageSessionsUsed,
                    'used_package_sessions' => $packageSessionsUsed,
                    'package_sessions_used' => $packageSessionsUsed,
                    'total_package_sessions_used' => $totalPackageSessionsUsed,
                    'active_packages_count' => $activePackagesCount,
                ],
                'used_package_sessions' => $packageSessionsUsed,
                'package_sessions_used' => $packageSessionsUsed,
                'visits_by_doctor' => $visitsByDoctor,
                'doctors' => $visitsByDoctor,
                'visits_by_service' => $visitsByService,
                'services' => $visitsByService,
                'daily_series' => $dailySeries,
                'daily' => $dailySeries,
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
            ],
        ], 200);
    }

    /**
     * Inventory Stock Movement & Balance Report.
     * GET /api/v1/reports/inventory
     */
    public function inventory(Request $request): JsonResponse
    {
        [$startDate, $endDate] = $this->parseDateRange($request);

        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        $lowStockOnly = filter_var($request->input('low_stock_only', false), FILTER_VALIDATE_BOOLEAN);

        // 1. Fetch products
        $productsQuery = Product::query()
            ->when($searchTerm !== '', function ($q) use ($searchTerm) {
                $q->where(function ($sub) use ($searchTerm) {
                    $sub->where('name', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('product_code', 'LIKE', "%{$searchTerm}%");
                });
            })
            ->orderBy('product_code');

        $products = $productsQuery->get();

        // 2. Bulk query opening stock balance prior to startDate
        $openingBalances = InventoryTransaction::where(function ($q) use ($startDate) {
            $q->where('transaction_date', '<', $startDate)
                ->orWhere(fn ($sq) => $sq->whereNull('transaction_date')->where('created_at', '<', $startDate));
        })
            ->selectRaw("product_id, COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as balance")
            ->groupBy('product_id')
            ->pluck('balance', 'product_id');

        // 3. Bulk query in-period inventory movements
        $periodMovements = InventoryTransaction::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('transaction_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('transaction_date')->whereBetween('created_at', [$startDate, $endDate]));
        })
            ->selectRaw("product_id,
                COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END), 0) as in_qty,
                COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END), 0) as out_qty,
                COALESCE(SUM(CASE WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as adjust_qty")
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        $items = [];
        $totalInQty = 0.0;
        $totalOutQty = 0.0;
        $totalAdjustQty = 0.0;
        $inStockCount = 0;
        $lowStockCount = 0;
        $outOfStockCount = 0;

        foreach ($products as $product) {
            $openingStock = round((float) ($openingBalances[$product->id] ?? 0), 3);
            $mov = $periodMovements->get($product->id);

            $inQty = round((float) ($mov?->in_qty ?? 0), 3);
            $outQty = round((float) ($mov?->out_qty ?? 0), 3);
            $adjustQty = round((float) ($mov?->adjust_qty ?? 0), 3);
            $closingStock = round($openingStock + $inQty - $outQty + $adjustQty, 3);

            $minStock = (float) ($product->minimum_stock ?? 0);

            if ($closingStock <= 0) {
                $status = 'OUT_OF_STOCK';
                $outOfStockCount++;
            } elseif ($minStock > 0 && $closingStock <= $minStock) {
                $status = 'LOW_STOCK';
                $lowStockCount++;
            } else {
                $status = 'IN_STOCK';
                $inStockCount++;
            }

            $isLowStock = ($minStock > 0 && $closingStock <= $minStock) || $closingStock <= 0;

            $totalInQty += $inQty;
            $totalOutQty += $outQty;
            $totalAdjustQty += $adjustQty;

            $itemData = [
                'id' => $product->id,
                'product_id' => $product->id,
                'product_code' => $product->product_code,
                'name' => $product->name,
                'product_name' => $product->name,
                'unit' => $product->unit,
                'minimum_stock' => $minStock,
                'opening_stock' => $openingStock,
                'in_quantity' => $inQty,
                'stock_in' => $inQty,
                'out_quantity' => $outQty,
                'stock_out' => $outQty,
                'adjust_quantity' => $adjustQty,
                'stock_adjust' => $adjustQty,
                'closing_stock' => $closingStock,
                'current_stock' => $closingStock,
                'status' => $status,
                'is_low_stock' => $isLowStock,
            ];

            if (! $lowStockOnly || $isLowStock) {
                $items[] = $itemData;
            }
        }

        $summary = [
            'total_products' => $products->count(),
            'total_items' => count($items),
            'total_in_quantity' => round($totalInQty, 3),
            'total_out_quantity' => round($totalOutQty, 3),
            'total_adjust_quantity' => round($totalAdjustQty, 3),
            'in_stock_count' => $inStockCount,
            'low_stock_count' => $lowStockCount,
            'out_of_stock_count' => $outOfStockCount,
            'in_stock_products' => $inStockCount,
            'low_stock_products' => $lowStockCount,
            'out_of_stock_products' => $outOfStockCount,
        ];

        return response()->json([
            'success' => true,
            'message' => 'Lấy báo cáo nhập xuất tồn kho thành công.',
            'data' => [
                'summary' => $summary,
                'total_products' => $products->count(),
                'total_in_quantity' => round($totalInQty, 3),
                'total_out_quantity' => round($totalOutQty, 3),
                'total_adjust_quantity' => round($totalAdjustQty, 3),
                'in_stock_count' => $inStockCount,
                'low_stock_count' => $lowStockCount,
                'out_of_stock_count' => $outOfStockCount,
                'items' => $items,
                'products' => $items,
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
            ],
        ], 200);
    }
}
