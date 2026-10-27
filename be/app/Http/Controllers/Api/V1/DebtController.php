<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DebtController extends Controller
{
    /**
     * Get aggregate debt and receivable summary for the clinic.
     * Includes aging receivable analysis: 0-7 days, 8-30 days, > 30 days.
     */
    public function summary(Request $request): JsonResponse
    {
        $query = Invoice::query()->where('status', '!=', 'CANCELLED');

        // Optional date range filtering on issued_at
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('issued_at', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('issued_at', '<=', (string) $endDate);
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', (int) $request->input('patient_id'));
        }

        $allInvoices = (clone $query)->get(['id', 'patient_id', 'total_amount', 'paid_amount', 'remaining_amount', 'status', 'issued_at', 'created_at']);

        $totalInvoiced = (float) $allInvoices->sum('total_amount');
        $totalCollected = (float) $allInvoices->sum('paid_amount');
        $activeDebtInvoices = $allInvoices->where('remaining_amount', '>', 0);
        $totalRemainingDebt = (float) $activeDebtInvoices->sum('remaining_amount');

        $debtorPatientIds = $activeDebtInvoices->whereNotNull('patient_id')->pluck('patient_id')->unique();
        $debtorPatientsCount = $debtorPatientIds->count();

        $unpaidInvoicesCount = $activeDebtInvoices->where('status', 'UNPAID')->count();
        $partialInvoicesCount = $activeDebtInvoices->where('status', 'PARTIAL')->count();
        $paidInvoicesCount = $allInvoices->where('status', 'PAID')->count();

        // Aging Receivable Analysis
        $amt0to7 = 0.0;
        $count0to7 = 0;
        $amt8to30 = 0.0;
        $count8to30 = 0;
        $amtOver30 = 0.0;
        $countOver30 = 0;

        $today = now()->startOfDay();

        foreach ($activeDebtInvoices as $invoice) {
            $refDate = $invoice->issued_at ?? $invoice->created_at;
            $carbonDate = $refDate instanceof Carbon ? $refDate : ($refDate ? Carbon::parse($refDate) : null);
            $days = $carbonDate ? max(0, (int) $carbonDate->startOfDay()->diffInDays($today, false)) : 0;
            $rem = (float) $invoice->remaining_amount;

            if ($days <= 7) {
                $amt0to7 += $rem;
                $count0to7++;
            } elseif ($days <= 30) {
                $amt8to30 += $rem;
                $count8to30++;
            } else {
                $amtOver30 += $rem;
                $countOver30++;
            }
        }

        $aging = [
            '0_to_7_days' => [
                'range' => '0-7',
                'label' => '0-7 ngày',
                'amount' => round($amt0to7, 2),
                'count' => $count0to7,
            ],
            '8_to_30_days' => [
                'range' => '8-30',
                'label' => '8-30 ngày',
                'amount' => round($amt8to30, 2),
                'count' => $count8to30,
            ],
            'over_30_days' => [
                'range' => '>30',
                'label' => '> 30 ngày',
                'amount' => round($amtOver30, 2),
                'count' => $countOver30,
            ],
        ];

        $agingGroups = [
            [
                'key' => '0_to_7_days',
                'range' => '0-7',
                'label' => '0-7 ngày',
                'amount' => round($amt0to7, 2),
                'count' => $count0to7,
            ],
            [
                'key' => '8_to_30_days',
                'range' => '8-30',
                'label' => '8-30 ngày',
                'amount' => round($amt8to30, 2),
                'count' => $count8to30,
            ],
            [
                'key' => 'over_30_days',
                'range' => '>30',
                'label' => '> 30 ngày',
                'amount' => round($amtOver30, 2),
                'count' => $countOver30,
            ],
        ];

        return response()->json([
            'success' => true,
            'message' => 'Lấy tổng hợp công nợ thành công.',
            'data' => [
                'total_invoiced' => round($totalInvoiced, 2),
                'total_collected' => round($totalCollected, 2),
                'total_remaining_debt' => round($totalRemainingDebt, 2),
                'debtor_patients_count' => $debtorPatientsCount,
                'unpaid_invoices_count' => $unpaidInvoicesCount,
                'partial_invoices_count' => $partialInvoicesCount,
                'paid_invoices_count' => $paidInvoicesCount,
                'aging' => $aging,
                'aging_groups' => $agingGroups,
                'aging_receivable' => [
                    '0_to_7' => round($amt0to7, 2),
                    '8_to_30' => round($amt8to30, 2),
                    'over_30' => round($amtOver30, 2),
                ],
            ],
        ], 200);
    }

    /**
     * Get list of patients with outstanding debt (remaining_amount > 0).
     * Supports search and sorting by total remaining debt descending.
     */
    public function patients(Request $request): JsonResponse
    {
        $query = Patient::query()
            ->whereHas('invoices', function ($q) {
                $q->where('status', '!=', 'CANCELLED')
                    ->where('remaining_amount', '>', 0);
            });

        // Search by patient name, code, or phone
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('full_name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('phone', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Aggregate calculations per patient
        $query->withSum(['invoices as total_invoiced' => function ($q) {
            $q->where('status', '!=', 'CANCELLED');
        }], 'total_amount')
            ->withSum(['invoices as total_paid' => function ($q) {
                $q->where('status', '!=', 'CANCELLED');
            }], 'paid_amount')
            ->withSum(['invoices as total_remaining_debt' => function ($q) {
                $q->where('status', '!=', 'CANCELLED')->where('remaining_amount', '>', 0);
            }], 'remaining_amount')
            ->withCount(['invoices as debt_invoices_count' => function ($q) {
                $q->where('status', '!=', 'CANCELLED')->where('remaining_amount', '>', 0);
            }])
            ->withMax(['invoices as latest_debt_date' => function ($q) {
                $q->where('status', '!=', 'CANCELLED')->where('remaining_amount', '>', 0);
            }], 'issued_at')
            ->withMin(['invoices as oldest_debt_date' => function ($q) {
                $q->where('status', '!=', 'CANCELLED')->where('remaining_amount', '>', 0);
            }], 'issued_at');

        // Sorting
        $allowedSorts = [
            'total_remaining_debt',
            'total_invoiced',
            'total_paid',
            'debt_invoices_count',
            'latest_debt_date',
            'full_name',
            'patient_code',
            'created_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'total_remaining_debt';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $paginated = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        $data = $paginated->getCollection()->map(function (Patient $patient) {
            $totalInvoiced = (float) ($patient->total_invoiced ?? 0);
            $totalPaid = (float) ($patient->total_paid ?? 0);
            $totalRemainingDebt = (float) ($patient->total_remaining_debt ?? 0);
            $debtInvoicesCount = (int) ($patient->debt_invoices_count ?? 0);

            return [
                'id' => $patient->id,
                'patient_id' => $patient->id,
                'patient_code' => $patient->patient_code,
                'full_name' => $patient->full_name,
                'phone' => $patient->phone,
                'email' => $patient->email,
                'gender' => $patient->gender,
                'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
                'total_invoiced' => round($totalInvoiced, 2),
                'total_paid' => round($totalPaid, 2),
                'total_collected' => round($totalPaid, 2),
                'total_remaining_debt' => round($totalRemainingDebt, 2),
                'remaining_debt' => round($totalRemainingDebt, 2),
                'remaining_amount' => round($totalRemainingDebt, 2),
                'debt_invoices_count' => $debtInvoicesCount,
                'invoices_count' => $debtInvoicesCount,
                'latest_debt_date' => $patient->latest_debt_date ? Carbon::parse($patient->latest_debt_date)->toIso8601String() : null,
                'oldest_debt_date' => $patient->oldest_debt_date ? Carbon::parse($patient->oldest_debt_date)->toIso8601String() : null,
                'patient' => [
                    'id' => $patient->id,
                    'patient_code' => $patient->patient_code,
                    'full_name' => $patient->full_name,
                    'phone' => $patient->phone,
                    'email' => $patient->email,
                    'gender' => $patient->gender,
                    'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách bệnh nhân có công nợ thành công.',
            'data' => $data,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'from' => $paginated->firstItem(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'to' => $paginated->lastItem(),
                'total' => $paginated->total(),
            ],
        ], 200);
    }

    /**
     * Get detailed debt ledger for a specific patient.
     * Includes all invoices and payment installments history.
     */
    public function patientDebts(Request $request, Patient|int|string $patient): JsonResponse
    {
        if (! ($patient instanceof Patient)) {
            $patient = Patient::findOrFail($patient);
        }

        $invoices = Invoice::where('patient_id', $patient->id)
            ->with([
                'patient',
                'visit:id,visit_code,status,check_in_time',
                'patientPackage:id,patient_id,package_id',
                'patientPackage.package:id,name,package_code',
                'payments' => function ($q) {
                    $q->orderBy('payment_date', 'desc')->orderBy('id', 'desc');
                },
                'payments.receiver:id,username',
            ])
            ->orderBy('issued_at', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $invoiceIds = $invoices->pluck('id');

        $payments = Payment::whereIn('invoice_id', $invoiceIds)
            ->with([
                'invoice:id,invoice_code,total_amount,paid_amount,remaining_amount,status',
                'receiver:id,username',
            ])
            ->orderBy('payment_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $activeInvoices = $invoices->where('status', '!=', 'CANCELLED');
        $totalInvoiced = (float) $activeInvoices->sum('total_amount');
        $totalPaid = (float) $activeInvoices->sum('paid_amount');
        $debtInvoices = $activeInvoices->where('remaining_amount', '>', 0);
        $totalRemainingDebt = (float) $debtInvoices->sum('remaining_amount');
        $debtInvoicesCount = $debtInvoices->count();
        $unpaidInvoicesCount = $activeInvoices->where('status', 'UNPAID')->count();
        $partialInvoicesCount = $activeInvoices->where('status', 'PARTIAL')->count();
        $paidInvoicesCount = $activeInvoices->where('status', 'PAID')->count();

        // Aging calculation for this patient
        $amt0to7 = 0.0;
        $count0to7 = 0;
        $amt8to30 = 0.0;
        $count8to30 = 0;
        $amtOver30 = 0.0;
        $countOver30 = 0;

        $today = now()->startOfDay();

        foreach ($debtInvoices as $inv) {
            $refDate = $inv->issued_at ?? $inv->created_at;
            $carbonDate = $refDate instanceof Carbon ? $refDate : ($refDate ? Carbon::parse($refDate) : null);
            $days = $carbonDate ? max(0, (int) $carbonDate->startOfDay()->diffInDays($today, false)) : 0;
            $rem = (float) $inv->remaining_amount;

            if ($days <= 7) {
                $amt0to7 += $rem;
                $count0to7++;
            } elseif ($days <= 30) {
                $amt8to30 += $rem;
                $count8to30++;
            } else {
                $amtOver30 += $rem;
                $countOver30++;
            }
        }

        $aging = [
            '0_to_7_days' => [
                'range' => '0-7',
                'label' => '0-7 ngày',
                'amount' => round($amt0to7, 2),
                'count' => $count0to7,
            ],
            '8_to_30_days' => [
                'range' => '8-30',
                'label' => '8-30 ngày',
                'amount' => round($amt8to30, 2),
                'count' => $count8to30,
            ],
            'over_30_days' => [
                'range' => '>30',
                'label' => '> 30 ngày',
                'amount' => round($amtOver30, 2),
                'count' => $countOver30,
            ],
        ];

        return response()->json([
            'success' => true,
            'message' => 'Lấy sổ công nợ bệnh nhân thành công.',
            'data' => [
                'patient' => [
                    'id' => $patient->id,
                    'patient_code' => $patient->patient_code,
                    'full_name' => $patient->full_name,
                    'phone' => $patient->phone,
                    'email' => $patient->email,
                    'gender' => $patient->gender,
                    'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
                    'address' => $patient->address,
                ],
                'summary' => [
                    'total_invoiced' => round($totalInvoiced, 2),
                    'total_paid' => round($totalPaid, 2),
                    'total_collected' => round($totalPaid, 2),
                    'total_remaining_debt' => round($totalRemainingDebt, 2),
                    'remaining_debt' => round($totalRemainingDebt, 2),
                    'total_invoices_count' => $invoices->count(),
                    'debt_invoices_count' => $debtInvoicesCount,
                    'unpaid_invoices_count' => $unpaidInvoicesCount,
                    'partial_invoices_count' => $partialInvoicesCount,
                    'paid_invoices_count' => $paidInvoicesCount,
                    'aging' => $aging,
                ],
                'invoices' => InvoiceResource::collection($invoices),
                'payments' => $payments->map(function ($pm) {
                    return [
                        'id' => $pm->id,
                        'payment_code' => $pm->payment_code,
                        'invoice_id' => $pm->invoice_id,
                        'invoice_code' => $pm->invoice?->invoice_code,
                        'amount' => (float) $pm->amount,
                        'payment_method' => $pm->payment_method,
                        'reference_code' => $pm->reference_code,
                        'payment_date' => $pm->payment_date?->toIso8601String(),
                        'received_by' => $pm->received_by,
                        'receiver' => $pm->receiver ? [
                            'id' => $pm->receiver->id,
                            'username' => $pm->receiver->username,
                        ] : null,
                        'notes' => $pm->notes,
                        'created_at' => $pm->created_at?->toIso8601String(),
                    ];
                }),
            ],
        ], 200);
    }
}
