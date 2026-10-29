<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Invoice\CancelInvoiceRequest;
use App\Http\Requests\Invoice\StoreInvoiceRequest;
use App\Http\Requests\Invoice\UpdateInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\PatientPackage;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    /**
     * Display a listing of invoices with search, filters, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Invoice::query()
            ->with([
                'patient',
                'visit.employee',
                'visit.service',
                'patientPackage.package',
                'creator',
                'payments.receiver',
            ]);

        // Search by keyword across invoice_code, patient full_name, phone, patient_code
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('invoice_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhereHas('patient', function ($pq) use ($searchTerm) {
                        $pq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%");
                    });
            });
        }

        // Filter by status (UNPAID, PARTIAL, PAID, CANCELLED)
        if ($request->filled('status')) {
            $status = $request->input('status');
            if (is_array($status)) {
                $query->whereIn('status', $status);
            } else {
                $query->where('status', (string) $status);
            }
        }

        // Filter by patient
        if ($request->filled('patient_id')) {
            $query->where('patient_id', (int) $request->input('patient_id'));
        }

        // Filter by visit
        if ($request->filled('visit_id')) {
            $query->where('visit_id', (int) $request->input('visit_id'));
        }

        // Filter by issued date range
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('issued_at', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('issued_at', '<=', (string) $endDate);
        }

        // Sorting
        $allowedSorts = [
            'id',
            'invoice_code',
            'issued_at',
            'subtotal_amount',
            'discount_amount',
            'total_amount',
            'paid_amount',
            'remaining_amount',
            'status',
            'created_at',
            'updated_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'issued_at';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $invoices = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách hóa đơn thành công.',
            'data' => InvoiceResource::collection($invoices),
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'from' => $invoices->firstItem(),
                'last_page' => $invoices->lastPage(),
                'per_page' => $invoices->perPage(),
                'to' => $invoices->lastItem(),
                'total' => $invoices->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created invoice in storage.
     */
    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $patientId = $request->input('patient_id');
        $visitId = $request->input('visit_id');
        $patientPackageId = $request->input('patient_package_id');

        if (! $patientId && $visitId) {
            $visit = Visit::find($visitId);
            $patientId = $visit?->patient_id;
        }

        if (! $patientId && $patientPackageId) {
            $package = PatientPackage::find($patientPackageId);
            $patientId = $package?->patient_id;
        }

        if (! $patientId) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xác định bệnh nhân cho hóa đơn.',
                'errors' => [
                    'patient_id' => ['Vui lòng chọn bệnh nhân hợp lệ.'],
                ],
            ], 422);
        }

        $subtotal = round((float) $request->input('subtotal_amount', 0), 2);
        $discount = round((float) ($request->input('discount_amount') ?? 0), 2);

        if ($discount < 0 || $discount > $subtotal) {
            return response()->json([
                'success' => false,
                'message' => 'Số tiền giảm giá không hợp lệ (không được âm và không được lớn hơn tổng tiền hàng).',
                'errors' => [
                    'discount_amount' => ['Số tiền giảm giá không được vượt quá tổng tiền hàng.'],
                ],
            ], 422);
        }

        $total = round($subtotal - $discount, 2);
        $paid = 0.00;
        $remaining = $total;
        $status = ($total == 0.0) ? 'PAID' : 'UNPAID';
        $issuedAt = $request->filled('issued_at') ? Carbon::parse($request->input('issued_at')) : now();

        $invoiceCode = $request->input('invoice_code');

        $invoice = DB::transaction(function () use (
            $invoiceCode,
            $patientId,
            $visitId,
            $patientPackageId,
            $subtotal,
            $discount,
            $total,
            $paid,
            $remaining,
            $status,
            $issuedAt,
            $request
        ) {
            $code = $invoiceCode ?: $this->generateInvoiceCode();

            $inv = Invoice::create([
                'invoice_code' => $code,
                'patient_id' => $patientId,
                'visit_id' => $visitId,
                'patient_package_id' => $patientPackageId,
                'subtotal_amount' => $subtotal,
                'discount_amount' => $discount,
                'total_amount' => $total,
                'paid_amount' => $paid,
                'remaining_amount' => $remaining,
                'status' => $status,
                'issued_at' => $issuedAt,
                'created_by' => $request->user()?->id,
            ]);

            // Sync visit payment_status if attached to visit
            if ($visitId) {
                $visit = Visit::whereKey($visitId)->lockForUpdate()->first();
                if ($visit) {
                    $visit->payment_status = $status;
                    $visit->save();
                }
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'invoices',
                'action' => 'create_invoice',
                'table_name' => 'invoices',
                'record_id' => (string) $inv->id,
                'old_values' => null,
                'new_values' => $inv->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $inv;
        });

        return response()->json([
            'success' => true,
            'message' => 'Tạo hóa đơn mới thành công.',
            'data' => new InvoiceResource($invoice->load(['patient', 'visit.employee', 'visit.service', 'patientPackage.package', 'creator', 'payments.receiver'])),
        ], 201);
    }

    /**
     * Display the specified invoice.
     */
    public function show(Invoice $invoice): JsonResponse
    {
        $invoice->load(['patient', 'visit.employee', 'visit.service', 'patientPackage.package', 'creator', 'payments.receiver']);

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết hóa đơn thành công.',
            'data' => new InvoiceResource($invoice),
        ], 200);
    }

    /**
     * Update the specified invoice (discount_amount, subtotal_amount, issued_at).
     */
    public function update(UpdateInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->status === 'CANCELLED') {
            return response()->json([
                'success' => false,
                'message' => 'Không thể chỉnh sửa hóa đơn đã bị hủy.',
            ], 422);
        }

        $newSubtotal = $request->has('subtotal_amount')
            ? round((float) $request->input('subtotal_amount'), 2)
            : (float) $invoice->subtotal_amount;

        $newDiscount = $request->has('discount_amount')
            ? round((float) $request->input('discount_amount'), 2)
            : (float) $invoice->discount_amount;

        if ($newDiscount < 0 || $newDiscount > $newSubtotal) {
            return response()->json([
                'success' => false,
                'message' => 'Số tiền giảm giá không hợp lệ (không được âm và không được lớn hơn tổng tiền hàng).',
                'errors' => [
                    'discount_amount' => ['Số tiền giảm giá không được vượt quá tổng tiền hàng.'],
                ],
            ], 422);
        }

        $newTotal = round($newSubtotal - $newDiscount, 2);
        $paidAmount = (float) $invoice->paid_amount;

        if ($newTotal < $paidAmount) {
            return response()->json([
                'success' => false,
                'message' => "Tổng tiền hóa đơn mới ({$newTotal}) không được nhỏ hơn số tiền đã thanh toán ({$paidAmount}).",
                'errors' => [
                    'discount_amount' => ["Tổng tiền sau giảm giá không thể nhỏ hơn số tiền đã thu ({$paidAmount})."],
                ],
            ], 422);
        }

        $newRemaining = round($newTotal - $paidAmount, 2);
        $newStatus = ($newRemaining == 0.0) ? 'PAID' : (($paidAmount > 0) ? 'PARTIAL' : 'UNPAID');

        $updatedInvoice = DB::transaction(function () use (
            $invoice,
            $newSubtotal,
            $newDiscount,
            $newTotal,
            $newRemaining,
            $newStatus,
            $request
        ) {
            /** @var Invoice $lockedInvoice */
            $lockedInvoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($lockedInvoice->status === 'CANCELLED') {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Không thể chỉnh sửa hóa đơn đã bị hủy.',
                ], 422));
            }

            if ($newTotal < (float) $lockedInvoice->paid_amount) {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Tổng tiền hóa đơn mới không được nhỏ hơn số tiền đã thanh toán.',
                ], 422));
            }

            $oldValues = $lockedInvoice->toArray();

            $lockedInvoice->subtotal_amount = $newSubtotal;
            $lockedInvoice->discount_amount = $newDiscount;
            $lockedInvoice->total_amount = $newTotal;
            $lockedInvoice->remaining_amount = $newRemaining;
            $lockedInvoice->status = $newStatus;

            if ($request->filled('issued_at')) {
                $lockedInvoice->issued_at = Carbon::parse($request->input('issued_at'));
            }

            $lockedInvoice->save();

            // Sync visit payment_status if attached to visit
            if ($lockedInvoice->visit_id) {
                $visit = Visit::whereKey($lockedInvoice->visit_id)->lockForUpdate()->first();
                if ($visit) {
                    $visit->payment_status = $newStatus;
                    $visit->save();
                }
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'invoices',
                'action' => 'update_invoice',
                'table_name' => 'invoices',
                'record_id' => (string) $lockedInvoice->id,
                'old_values' => $oldValues,
                'new_values' => $lockedInvoice->fresh()->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $lockedInvoice;
        });

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật hóa đơn thành công.',
            'data' => new InvoiceResource($updatedInvoice->load(['patient', 'visit.employee', 'visit.service', 'patientPackage.package', 'creator', 'payments.receiver'])),
        ], 200);
    }

    /**
     * Cancel an invoice (only if paid_amount == 0).
     */
    public function cancel(CancelInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->status === 'CANCELLED') {
            return response()->json([
                'success' => false,
                'message' => 'Hóa đơn đã bị hủy trước đó.',
            ], 422);
        }

        if ((float) $invoice->paid_amount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Không thể hủy hóa đơn đã có phát sinh thanh toán (đã thu: {$invoice->paid_amount}).",
            ], 422);
        }

        $cancelledInvoice = DB::transaction(function () use ($invoice, $request) {
            /** @var Invoice $lockedInvoice */
            $lockedInvoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($lockedInvoice->status === 'CANCELLED') {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Hóa đơn đã bị hủy trước đó.',
                ], 422));
            }

            if ((float) $lockedInvoice->paid_amount > 0) {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'message' => "Không thể hủy hóa đơn đã có phát sinh thanh toán (đã thu: {$lockedInvoice->paid_amount}).",
                ], 422));
            }

            $oldValues = $lockedInvoice->toArray();

            $lockedInvoice->status = 'CANCELLED';
            $lockedInvoice->remaining_amount = 0.00;
            $lockedInvoice->save();

            // Sync visit payment_status if attached to visit
            if ($lockedInvoice->visit_id) {
                $visit = Visit::whereKey($lockedInvoice->visit_id)->lockForUpdate()->first();
                if ($visit) {
                    $visit->payment_status = 'UNPAID';
                    $visit->save();
                }
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'invoices',
                'action' => 'cancel_invoice',
                'table_name' => 'invoices',
                'record_id' => (string) $lockedInvoice->id,
                'old_values' => $oldValues,
                'new_values' => $lockedInvoice->fresh()->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $lockedInvoice;
        });

        return response()->json([
            'success' => true,
            'message' => 'Hủy hóa đơn thành công.',
            'data' => new InvoiceResource($cancelledInvoice->load(['patient', 'visit', 'patientPackage', 'creator', 'payments'])),
        ], 200);
    }

    /**
     * Generate unique concurrency-safe invoice code.
     * Format: INV-XXXXXX (e.g. INV-000001)
     */
    protected function generateInvoiceCode(): string
    {
        $allCodes = DB::table('invoices')->pluck('invoice_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:INV-?|HD-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'INV-'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('invoices')->where('invoice_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
