<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CashTransaction\StoreCashTransactionRequest;
use App\Http\Resources\CashTransactionResource;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashTransactionController extends Controller
{
    /**
     * Display a listing of cash transactions with filtering, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = CashTransaction::query()->with(['creator']);

        // Filter by transaction_type (IN, OUT)
        if ($request->filled('transaction_type')) {
            $type = strtoupper(trim((string) $request->input('transaction_type')));
            $query->where('transaction_type', $type);
        }

        // Filter by payment_method (CASH, BANK_TRANSFER, CARD)
        if ($request->filled('payment_method')) {
            $method = strtoupper(trim((string) $request->input('payment_method')));
            $query->where('payment_method', $method);
        }

        // Filter by reference_type
        if ($request->filled('reference_type')) {
            $query->where('reference_type', (string) $request->input('reference_type'));
        }

        // Filter by reference_id
        if ($request->filled('reference_id')) {
            $query->where('reference_id', (int) $request->input('reference_id'));
        }

        // Filter by exact transaction_date
        if ($request->filled('transaction_date')) {
            $query->whereDate('transaction_date', (string) $request->input('transaction_date'));
        }

        // Filter by date range
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('transaction_date', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('transaction_date', '<=', (string) $endDate);
        }

        // Search by keyword in transaction_code or description
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('transaction_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Sorting
        $allowedSorts = [
            'id',
            'transaction_code',
            'amount',
            'transaction_type',
            'payment_method',
            'transaction_date',
            'created_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'transaction_date';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $transactions = $query->orderBy($sortBy, $sortDirection)
            ->orderBy('id', $sortDirection)
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách giao dịch sổ quỹ thành công.',
            'data' => CashTransactionResource::collection($transactions),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'from' => $transactions->firstItem(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'to' => $transactions->lastItem(),
                'total' => $transactions->total(),
            ],
        ], 200);
    }

    /**
     * Get aggregate cashbook summary for a given period.
     * Calculates opening_balance, total_in, total_out, net_change, closing_balance,
     * with detailed breakdowns by payment method (CASH, BANK_TRANSFER, CARD).
     */
    public function summary(Request $request): JsonResponse
    {
        $startDateStr = $request->input('start_date') ?? $request->input('from_date');
        $endDateStr = $request->input('end_date') ?? $request->input('to_date');
        $filterMethod = $request->filled('payment_method')
            ? strtoupper(trim((string) $request->input('payment_method')))
            : null;

        $startCarbon = null;
        if ($startDateStr) {
            $startCarbon = str_contains((string) $startDateStr, ':')
                ? Carbon::parse($startDateStr)
                : Carbon::parse($startDateStr)->startOfDay();
        }

        $endCarbon = null;
        if ($endDateStr) {
            $endCarbon = str_contains((string) $endDateStr, ':')
                ? Carbon::parse($endDateStr)
                : Carbon::parse($endDateStr)->endOfDay();
        }

        // Opening balance calculation: strictly before startCarbon
        if ($startCarbon !== null) {
            $openingInQuery = CashTransaction::where('transaction_type', 'IN')
                ->where('transaction_date', '<', $startCarbon);
            $openingOutQuery = CashTransaction::where('transaction_type', 'OUT')
                ->where('transaction_date', '<', $startCarbon);

            if ($filterMethod) {
                $openingInQuery->where('payment_method', $filterMethod);
                $openingOutQuery->where('payment_method', $filterMethod);
            }

            $openingIn = (float) $openingInQuery->sum('amount');
            $openingOut = (float) $openingOutQuery->sum('amount');
            $openingBalance = round($openingIn - $openingOut, 2);
        } else {
            $openingBalance = 0.0;
        }

        // In-period query
        $periodQuery = CashTransaction::query();
        if ($startCarbon !== null) {
            $periodQuery->where('transaction_date', '>=', $startCarbon);
        }
        if ($endCarbon !== null) {
            $periodQuery->where('transaction_date', '<=', $endCarbon);
        }
        if ($filterMethod) {
            $periodQuery->where('payment_method', $filterMethod);
        }

        $periodTransactions = $periodQuery->get(['amount', 'transaction_type', 'payment_method']);

        $totalIn = round((float) $periodTransactions->where('transaction_type', 'IN')->sum('amount'), 2);
        $totalOut = round((float) $periodTransactions->where('transaction_type', 'OUT')->sum('amount'), 2);
        $netChange = round($totalIn - $totalOut, 2);
        $closingBalance = round($openingBalance + $netChange, 2);

        // Breakdowns by payment method
        $methods = ['CASH', 'BANK_TRANSFER', 'CARD'];
        $byPaymentMethod = [];

        foreach ($methods as $pm) {
            if ($startCarbon !== null) {
                $pmOpeningIn = (float) CashTransaction::where('payment_method', $pm)
                    ->where('transaction_type', 'IN')
                    ->where('transaction_date', '<', $startCarbon)
                    ->sum('amount');
                $pmOpeningOut = (float) CashTransaction::where('payment_method', $pm)
                    ->where('transaction_type', 'OUT')
                    ->where('transaction_date', '<', $startCarbon)
                    ->sum('amount');
                $pmOpening = round($pmOpeningIn - $pmOpeningOut, 2);
            } else {
                $pmOpening = 0.0;
            }

            $pmIn = round((float) $periodTransactions->where('payment_method', $pm)->where('transaction_type', 'IN')->sum('amount'), 2);
            $pmOut = round((float) $periodTransactions->where('payment_method', $pm)->where('transaction_type', 'OUT')->sum('amount'), 2);
            $pmNet = round($pmIn - $pmOut, 2);
            $pmClosing = round($pmOpening + $pmNet, 2);

            $byPaymentMethod[$pm] = [
                'opening_balance' => $pmOpening,
                'total_in' => $pmIn,
                'total_out' => $pmOut,
                'net_change' => $pmNet,
                'closing_balance' => $pmClosing,
            ];
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy báo cáo tổng hợp sổ quỹ thành công.',
            'data' => [
                'opening_balance' => $openingBalance,
                'total_in' => $totalIn,
                'total_out' => $totalOut,
                'net_change' => $netChange,
                'closing_balance' => $closingBalance,
                'by_payment_method' => $byPaymentMethod,
                'by_method' => $byPaymentMethod,
                'methods' => $byPaymentMethod,
            ],
        ], 200);
    }

    /**
     * Store a newly created manual cash transaction in storage.
     */
    public function store(StoreCashTransactionRequest $request): JsonResponse
    {
        $transaction = DB::transaction(function () use ($request) {
            $code = $request->filled('transaction_code')
                ? (string) $request->input('transaction_code')
                : $this->generateTransactionCode();

            $transactionDate = $request->filled('transaction_date')
                ? Carbon::parse($request->input('transaction_date'))
                : now();

            $tx = CashTransaction::create([
                'transaction_code' => $code,
                'transaction_type' => (string) $request->input('transaction_type'),
                'amount' => round((float) $request->input('amount'), 2),
                'payment_method' => (string) $request->input('payment_method'),
                'transaction_date' => $transactionDate,
                'description' => $request->input('description'),
                'reference_type' => $request->input('reference_type'),
                'reference_id' => $request->input('reference_id'),
                'created_by' => $request->user()?->id,
                'created_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'cash_transactions',
                'action' => 'create_cash_transaction',
                'table_name' => 'cash_transactions',
                'record_id' => (string) $tx->id,
                'old_values' => null,
                'new_values' => $tx->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $tx;
        });

        return response()->json([
            'success' => true,
            'message' => 'Tạo giao dịch sổ quỹ thành công.',
            'data' => new CashTransactionResource($transaction->load(['creator'])),
        ], 201);
    }

    /**
     * Display the specified cash transaction.
     */
    public function show(CashTransaction $cashTransaction): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết giao dịch sổ quỹ thành công.',
            'data' => new CashTransactionResource($cashTransaction->load(['creator'])),
        ], 200);
    }

    /**
     * Generate unique concurrency-safe cash transaction code.
     * Format: CTX-XXXXXX (e.g. CTX-000001)
     */
    protected function generateTransactionCode(): string
    {
        $allCodes = DB::table('cash_transactions')->pluck('transaction_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:CTX-?|SQ-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'CTX-'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('cash_transactions')->where('transaction_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
