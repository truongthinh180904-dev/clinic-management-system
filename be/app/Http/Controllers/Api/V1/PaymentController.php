<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    /**
     * Display a listing of payments with search, filters, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Payment::query()
            ->with(['invoice.patient', 'receiver', 'cashTransactions']);

        // Search by keyword across payment_code, reference_code, notes, or invoice/patient
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('payment_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('reference_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('notes', 'LIKE', "%{$searchTerm}%")
                    ->orWhereHas('invoice', function ($iq) use ($searchTerm) {
                        $iq->where('invoice_code', 'LIKE', "%{$searchTerm}%")
                            ->orWhereHas('patient', function ($pq) use ($searchTerm) {
                                $pq->where('full_name', 'LIKE', "%{$searchTerm}%")
                                    ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%")
                                    ->orWhere('phone', 'LIKE', "%{$searchTerm}%");
                            });
                    });
            });
        }

        // Filter by invoice_id
        if ($request->filled('invoice_id')) {
            $query->where('invoice_id', (int) $request->input('invoice_id'));
        }

        // Filter by payment_method (CASH, BANK_TRANSFER, CARD)
        if ($request->filled('payment_method')) {
            $query->where('payment_method', (string) $request->input('payment_method'));
        }

        // Filter by payment_code
        if ($request->filled('payment_code')) {
            $query->where('payment_code', 'LIKE', '%'.$request->input('payment_code').'%');
        }

        // Filter by reference_code
        if ($request->filled('reference_code')) {
            $query->where('reference_code', 'LIKE', '%'.$request->input('reference_code').'%');
        }

        // Filter by exact payment_date
        if ($request->filled('payment_date')) {
            $query->whereDate('payment_date', (string) $request->input('payment_date'));
        }

        // Filter by date range
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('payment_date', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('payment_date', '<=', (string) $endDate);
        }

        // Sorting
        $allowedSorts = [
            'id',
            'payment_code',
            'amount',
            'payment_method',
            'payment_date',
            'created_at',
            'updated_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'payment_date';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $payments = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách phiếu thu thành công.',
            'data' => PaymentResource::collection($payments),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'from' => $payments->firstItem(),
                'last_page' => $payments->lastPage(),
                'per_page' => $payments->perPage(),
                'to' => $payments->lastItem(),
                'total' => $payments->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created payment in storage.
     * Supports both POST /api/v1/payments and POST /api/v1/invoices/{invoice}/payments.
     */
    public function store(StorePaymentRequest $request, Invoice|int|string|null $invoice = null): JsonResponse
    {
        $invoiceId = null;
        if ($invoice instanceof Invoice) {
            $invoiceId = $invoice->id;
        } elseif ($invoice !== null) {
            $invoiceId = (int) $invoice;
        } elseif ($request->filled('invoice_id')) {
            $invoiceId = (int) $request->input('invoice_id');
        }

        if (! $invoiceId) {
            return response()->json([
                'success' => false,
                'message' => 'Vui lòng cung cấp mã định danh hóa đơn cần thanh toán.',
                'errors' => [
                    'invoice_id' => ['Vui lòng chọn hóa đơn cần thanh toán.'],
                ],
            ], 422);
        }

        $amount = round((float) $request->input('amount'), 2);
        if ($amount <= 0.0) {
            return response()->json([
                'success' => false,
                'message' => 'Số tiền thanh toán phải lớn hơn 0.',
                'errors' => [
                    'amount' => ['Số tiền thanh toán phải lớn hơn 0.'],
                ],
            ], 422);
        }

        $paymentMethod = (string) $request->input('payment_method');
        $referenceCode = $request->input('reference_code');
        $notes = $request->input('notes');
        $customPaymentCode = $request->input('payment_code');
        $paymentDate = $request->filled('payment_date')
            ? Carbon::parse($request->input('payment_date'))
            : now();

        /** @var Payment $payment */
        $payment = DB::transaction(function () use (
            $invoiceId,
            $amount,
            $paymentMethod,
            $referenceCode,
            $notes,
            $customPaymentCode,
            $paymentDate,
            $request
        ) {
            /** @var Invoice|null $lockedInvoice */
            $lockedInvoice = Invoice::whereKey($invoiceId)->lockForUpdate()->first();

            if (! $lockedInvoice) {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Hóa đơn không tồn tại trên hệ thống.',
                    'errors' => [
                        'invoice_id' => ['Hóa đơn không tồn tại.'],
                    ],
                ], 422));
            }

            // Check invoice status
            if ($lockedInvoice->status === 'CANCELLED') {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Không thể thu tiền cho hóa đơn đã bị hủy.',
                    'errors' => [
                        'invoice_id' => ['Hóa đơn đã bị hủy.'],
                    ],
                ], 422));
            }

            $currentRemaining = round((float) $lockedInvoice->remaining_amount, 2);
            if ($lockedInvoice->status === 'PAID' || $currentRemaining <= 0.0) {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Hóa đơn đã được thanh toán đầy đủ, không thể thu thêm.',
                    'errors' => [
                        'invoice_id' => ['Hóa đơn đã được thanh toán đầy đủ.'],
                    ],
                ], 422));
            }

            // Check if amount exceeds remaining debt
            if ($amount > $currentRemaining) {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => "Số tiền thanh toán ({$amount}) vượt quá số tiền còn nợ ({$currentRemaining}).",
                    'errors' => [
                        'amount' => ["Số tiền thanh toán không được vượt quá số tiền còn nợ ({$currentRemaining})."],
                    ],
                ], 422));
            }

            // Generate payment code
            $payCode = $customPaymentCode ?: $this->generatePaymentCode();

            // Create Payment record
            $pay = Payment::create([
                'payment_code' => $payCode,
                'invoice_id' => $lockedInvoice->id,
                'amount' => $amount,
                'payment_method' => $paymentMethod,
                'reference_code' => $referenceCode,
                'payment_date' => $paymentDate,
                'received_by' => $request->user()?->id,
                'notes' => $notes,
            ]);

            // Update Invoice balance & status
            $newPaidAmount = round((float) $lockedInvoice->paid_amount + $amount, 2);
            $newRemainingAmount = round((float) $lockedInvoice->total_amount - $newPaidAmount, 2);
            if ($newRemainingAmount <= 0.001) {
                $newRemainingAmount = 0.00;
            }

            $newStatus = ($newRemainingAmount == 0.00) ? 'PAID' : 'PARTIAL';

            $lockedInvoice->paid_amount = $newPaidAmount;
            $lockedInvoice->remaining_amount = $newRemainingAmount;
            $lockedInvoice->status = $newStatus;
            $lockedInvoice->save();

            // Synchronize visit payment_status if invoice is attached to a visit
            if ($lockedInvoice->visit_id) {
                $visit = Visit::whereKey($lockedInvoice->visit_id)->lockForUpdate()->first();
                if ($visit) {
                    $visit->payment_status = $newStatus;
                    $visit->save();
                }
            }

            // Auto-create CashTransaction (IN)
            $ctxCode = $this->generateCashTransactionCode();
            CashTransaction::create([
                'transaction_code' => $ctxCode,
                'transaction_type' => 'IN',
                'reference_type' => 'Payment',
                'reference_id' => $pay->id,
                'amount' => $pay->amount,
                'payment_method' => $pay->payment_method,
                'transaction_date' => $pay->payment_date,
                'description' => "Thu tiền theo phiếu {$pay->payment_code} cho hóa đơn {$lockedInvoice->invoice_code}",
                'created_by' => $request->user()?->id,
                'created_at' => now(),
            ]);

            // Audit log
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'payments',
                'action' => 'create_payment',
                'table_name' => 'payments',
                'record_id' => (string) $pay->id,
                'old_values' => null,
                'new_values' => $pay->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $pay;
        });

        return response()->json([
            'success' => true,
            'message' => 'Thu tiền hóa đơn thành công.',
            'data' => new PaymentResource($payment->load(['invoice.patient', 'receiver', 'cashTransactions'])),
        ], 201);
    }

    /**
     * Display the specified payment.
     */
    public function show(Payment $payment): JsonResponse
    {
        $payment->load(['invoice.patient', 'receiver', 'cashTransactions']);

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết phiếu thu thành công.',
            'data' => new PaymentResource($payment),
        ], 200);
    }

    /**
     * Generate unique concurrency-safe payment code.
     * Format: PAY-XXXXXX (e.g. PAY-000001)
     */
    protected function generatePaymentCode(): string
    {
        $allCodes = DB::table('payments')->pluck('payment_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:PAY-?|PT-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'PAY-'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('payments')->where('payment_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }

    /**
     * Generate unique concurrency-safe cash transaction code.
     * Format: CTX-XXXXXX (e.g. CTX-000001)
     */
    protected function generateCashTransactionCode(): string
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
