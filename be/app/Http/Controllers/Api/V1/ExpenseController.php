<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Expense\StoreExpenseRequest;
use App\Http\Requests\Expense\UpdateExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Expense;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenseController extends Controller
{
    /**
     * Display a listing of expenses with filtering, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Expense::query()->with([
            'category',
            'creator',
            'approver',
            'cashTransactions',
            'approvalRequests',
        ]);

        // Filter by category_id
        if ($request->filled('category_id')) {
            $catId = $request->input('category_id');
            if (is_array($catId)) {
                $query->whereIn('category_id', $catId);
            } else {
                $query->where('category_id', (int) $catId);
            }
        }

        // Filter by approval_status (PENDING, APPROVED, REJECTED)
        if ($request->filled('approval_status')) {
            $status = strtoupper(trim((string) $request->input('approval_status')));
            $query->where('approval_status', $status);
        }

        // Filter by payment_method (CASH, BANK_TRANSFER, CARD)
        if ($request->filled('payment_method')) {
            $method = strtoupper(trim((string) $request->input('payment_method')));
            $query->where('payment_method', $method);
        }

        // Filter by expense_date range
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('expense_date', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('expense_date', '<=', (string) $endDate);
        }

        // Filter by creator or approver
        if ($request->filled('created_by')) {
            $query->where('created_by', (int) $request->input('created_by'));
        }
        if ($request->filled('approved_by')) {
            $query->where('approved_by', (int) $request->input('approved_by'));
        }

        // Search by keyword in expense_code or description
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('expense_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Sorting
        $allowedSorts = [
            'id',
            'expense_code',
            'amount',
            'payment_method',
            'expense_date',
            'approval_status',
            'created_at',
            'updated_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'expense_date';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $expenses = $query->orderBy($sortBy, $sortDirection)
            ->orderBy('id', $sortDirection)
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách phiếu chi thành công.',
            'data' => ExpenseResource::collection($expenses),
            'meta' => [
                'current_page' => $expenses->currentPage(),
                'from' => $expenses->firstItem(),
                'last_page' => $expenses->lastPage(),
                'per_page' => $expenses->perPage(),
                'to' => $expenses->lastItem(),
                'total' => $expenses->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created expense in storage.
     * Generates EXP-... code, sets approval_status = PENDING,
     * and automatically creates an ApprovalRequest.
     */
    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $expense = DB::transaction(function () use ($request) {
            $code = $request->filled('expense_code')
                ? (string) $request->input('expense_code')
                : $this->generateExpenseCode();

            $expenseDate = $request->filled('expense_date')
                ? Carbon::parse($request->input('expense_date'))
                : now();

            $currentUserId = $request->user()?->id;

            $exp = Expense::create([
                'expense_code' => $code,
                'category_id' => (int) $request->input('category_id'),
                'amount' => round((float) $request->input('amount'), 2),
                'payment_method' => (string) $request->input('payment_method'),
                'expense_date' => $expenseDate,
                'description' => $request->input('description'),
                'approval_status' => 'PENDING',
                'created_by' => $currentUserId,
            ]);

            // Automatically create approval request
            ApprovalRequest::create([
                'request_type' => 'EXPENSE_APPROVAL',
                'reference_type' => 'Expense',
                'reference_id' => $exp->id,
                'requested_by' => $currentUserId,
                'status' => 'PENDING',
                'reason' => $exp->description ?: ("Đề xuất phiếu chi {$exp->expense_code}"),
                'created_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $currentUserId,
                'module' => 'expenses',
                'action' => 'create_expense',
                'table_name' => 'expenses',
                'record_id' => (string) $exp->id,
                'old_values' => null,
                'new_values' => $exp->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $exp;
        });

        return response()->json([
            'success' => true,
            'message' => 'Lập phiếu chi thành công, phiếu đang chờ Quản lý phê duyệt.',
            'data' => new ExpenseResource($expense->load(['category', 'creator', 'approvalRequests'])),
        ], 201);
    }

    /**
     * Display the specified expense.
     */
    public function show(Expense $expense): JsonResponse
    {
        $expense->load(['category', 'creator', 'approver', 'cashTransactions', 'approvalRequests']);

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết phiếu chi thành công.',
            'data' => new ExpenseResource($expense),
        ], 200);
    }

    /**
     * Update the specified expense.
     * Allowed only when approval_status == 'PENDING'.
     */
    public function update(UpdateExpenseRequest $request, Expense $expense): JsonResponse
    {
        if ($expense->approval_status !== 'PENDING') {
            return response()->json([
                'success' => false,
                'message' => 'Chỉ có thể chỉnh sửa phiếu chi ở trạng thái chờ duyệt (PENDING).',
                'errors' => [
                    'approval_status' => ['Chỉ có thể chỉnh sửa phiếu chi ở trạng thái chờ duyệt (PENDING).'],
                ],
            ], 422);
        }

        $updated = DB::transaction(function () use ($request, $expense) {
            /** @var Expense $locked */
            $locked = Expense::whereKey($expense->id)->lockForUpdate()->firstOrFail();

            if ($locked->approval_status !== 'PENDING') {
                return response()->json([
                    'success' => false,
                    'message' => 'Chỉ có thể chỉnh sửa phiếu chi ở trạng thái chờ duyệt (PENDING).',
                    'errors' => [
                        'approval_status' => ['Chỉ có thể chỉnh sửa phiếu chi ở trạng thái chờ duyệt (PENDING).'],
                    ],
                ], 422);
            }

            $oldValues = $locked->toArray();

            if ($request->has('category_id')) {
                $locked->category_id = (int) $request->input('category_id');
            }
            if ($request->has('amount')) {
                $locked->amount = round((float) $request->input('amount'), 2);
            }
            if ($request->has('payment_method')) {
                $locked->payment_method = (string) $request->input('payment_method');
            }
            if ($request->has('expense_date')) {
                $locked->expense_date = Carbon::parse($request->input('expense_date'));
            }
            if ($request->has('description')) {
                $locked->description = $request->input('description');
            }

            $locked->save();

            // Synchronize approval request reason
            ApprovalRequest::where(function ($q) {
                $q->where('reference_type', 'Expense')
                    ->orWhere('reference_type', Expense::class);
            })->where('reference_id', $locked->id)
                ->where('status', 'PENDING')
                ->update([
                    'reason' => $locked->description ?: ("Đề xuất phiếu chi {$locked->expense_code}"),
                ]);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'expenses',
                'action' => 'update_expense',
                'table_name' => 'expenses',
                'record_id' => (string) $locked->id,
                'old_values' => $oldValues,
                'new_values' => $locked->fresh()->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $locked;
        });

        if ($updated instanceof JsonResponse) {
            return $updated;
        }

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật phiếu chi thành công.',
            'data' => new ExpenseResource($updated->load(['category', 'creator', 'approver', 'approvalRequests'])),
        ], 200);
    }

    /**
     * Approve the specified expense.
     * Uses lockForUpdate(), marks APPROVED, updates ApprovalRequest,
     * and automatically writes CashTransaction (OUT).
     */
    public function approve(Request $request, Expense $expense): JsonResponse
    {
        return DB::transaction(function () use ($request, $expense) {
            /** @var Expense $locked */
            $locked = Expense::whereKey($expense->id)->lockForUpdate()->firstOrFail();

            if ($locked->approval_status !== 'PENDING') {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiếu chi này đã được xử lý trước đó.',
                    'errors' => [
                        'approval_status' => ['Phiếu chi này đã được xử lý trước đó.'],
                    ],
                ], 422);
            }

            $currentUserId = $request->user()?->id;
            $now = now();

            $oldValues = $locked->toArray();

            $locked->approval_status = 'APPROVED';
            $locked->approved_by = $currentUserId;
            $locked->approved_at = $now;
            $locked->save();

            // Synchronize linked ApprovalRequest
            ApprovalRequest::where(function ($q) {
                $q->where('reference_type', 'Expense')
                    ->orWhere('reference_type', Expense::class);
            })->where('reference_id', $locked->id)
                ->where('status', 'PENDING')
                ->update([
                    'status' => 'APPROVED',
                    'approved_by' => $currentUserId,
                    'approved_at' => $now,
                ]);

            // Automatically record CashTransaction (OUT)
            $hasCashTx = CashTransaction::where(function ($q) {
                $q->where('reference_type', 'Expense')
                    ->orWhere('reference_type', Expense::class);
            })->where('reference_id', $locked->id)->exists();

            if (! $hasCashTx) {
                $txCode = $this->generateCashTransactionCode();
                CashTransaction::create([
                    'transaction_code' => $txCode,
                    'transaction_type' => 'OUT',
                    'reference_type' => 'Expense',
                    'reference_id' => $locked->id,
                    'amount' => $locked->amount,
                    'payment_method' => $locked->payment_method ?? 'CASH',
                    'transaction_date' => $locked->expense_date ?? $now,
                    'description' => $locked->description ?: ("Chi tiền theo phiếu chi {$locked->expense_code}"),
                    'created_by' => $currentUserId,
                    'created_at' => $now,
                ]);
            }

            AuditLog::create([
                'user_id' => $currentUserId,
                'module' => 'expenses',
                'action' => 'approve_expense',
                'table_name' => 'expenses',
                'record_id' => (string) $locked->id,
                'old_values' => $oldValues,
                'new_values' => $locked->fresh()->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Phê duyệt phiếu chi thành công và tự động ghi sổ quỹ (OUT).',
                'data' => new ExpenseResource($locked->fresh(['category', 'creator', 'approver', 'cashTransactions', 'approvalRequests'])),
            ], 200);
        });
    }

    /**
     * Reject the specified expense.
     * Requires rejection reason, updates status to REJECTED,
     * and synchronizes ApprovalRequest.
     */
    public function reject(Request $request, Expense $expense): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required_without:rejection_reason', 'nullable', 'string', 'max:1000'],
            'rejection_reason' => ['required_without:reason', 'nullable', 'string', 'max:1000'],
        ], [
            'reason.required_without' => 'Vui lòng cung cấp lý do từ chối phiếu chi.',
            'rejection_reason.required_without' => 'Vui lòng cung cấp lý do từ chối phiếu chi.',
            'reason.max' => 'Lý do từ chối không được vượt quá 1000 ký tự.',
            'rejection_reason.max' => 'Lý do từ chối không được vượt quá 1000 ký tự.',
        ]);

        $reason = trim((string) ($request->input('reason') ?? $request->input('rejection_reason')));
        if ($reason === '') {
            return response()->json([
                'success' => false,
                'message' => 'Vui lòng cung cấp lý do từ chối phiếu chi.',
                'errors' => [
                    'reason' => ['Vui lòng cung cấp lý do từ chối phiếu chi.'],
                ],
            ], 422);
        }

        return DB::transaction(function () use ($request, $expense, $reason) {
            /** @var Expense $locked */
            $locked = Expense::whereKey($expense->id)->lockForUpdate()->firstOrFail();

            if ($locked->approval_status !== 'PENDING') {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiếu chi này đã được xử lý trước đó.',
                    'errors' => [
                        'approval_status' => ['Phiếu chi này đã được xử lý trước đó.'],
                    ],
                ], 422);
            }

            $currentUserId = $request->user()?->id;
            $now = now();

            $oldValues = $locked->toArray();

            $locked->approval_status = 'REJECTED';
            $locked->approved_by = $currentUserId;
            $locked->approved_at = $now;
            $locked->save();

            // Synchronize linked ApprovalRequest
            ApprovalRequest::where(function ($q) {
                $q->where('reference_type', 'Expense')
                    ->orWhere('reference_type', Expense::class);
            })->where('reference_id', $locked->id)
                ->where('status', 'PENDING')
                ->update([
                    'status' => 'REJECTED',
                    'rejection_reason' => $reason,
                    'approved_by' => $currentUserId,
                    'approved_at' => $now,
                ]);

            AuditLog::create([
                'user_id' => $currentUserId,
                'module' => 'expenses',
                'action' => 'reject_expense',
                'table_name' => 'expenses',
                'record_id' => (string) $locked->id,
                'old_values' => $oldValues,
                'new_values' => $locked->fresh()->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Từ chối phiếu chi thành công.',
                'data' => new ExpenseResource($locked->fresh(['category', 'creator', 'approver', 'approvalRequests'])),
            ], 200);
        });
    }

    /**
     * Remove the specified expense from storage.
     * Allowed only when approval_status == 'PENDING'.
     */
    public function destroy(Request $request, Expense $expense): JsonResponse
    {
        if ($expense->approval_status !== 'PENDING') {
            return response()->json([
                'success' => false,
                'message' => 'Chỉ có thể xóa phiếu chi ở trạng thái chờ duyệt (PENDING).',
                'errors' => [
                    'approval_status' => ['Chỉ có thể xóa phiếu chi ở trạng thái chờ duyệt (PENDING).'],
                ],
            ], 422);
        }

        return DB::transaction(function () use ($request, $expense) {
            /** @var Expense $locked */
            $locked = Expense::whereKey($expense->id)->lockForUpdate()->firstOrFail();

            if ($locked->approval_status !== 'PENDING') {
                return response()->json([
                    'success' => false,
                    'message' => 'Chỉ có thể xóa phiếu chi ở trạng thái chờ duyệt (PENDING).',
                    'errors' => [
                        'approval_status' => ['Chỉ có thể xóa phiếu chi ở trạng thái chờ duyệt (PENDING).'],
                    ],
                ], 422);
            }

            $oldValues = $locked->toArray();

            // Delete pending approval requests
            ApprovalRequest::where(function ($q) {
                $q->where('reference_type', 'Expense')
                    ->orWhere('reference_type', Expense::class);
            })->where('reference_id', $locked->id)->delete();

            $locked->delete();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'expenses',
                'action' => 'delete_expense',
                'table_name' => 'expenses',
                'record_id' => (string) $expense->id,
                'old_values' => $oldValues,
                'new_values' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Xóa phiếu chi thành công.',
                'data' => null,
            ], 200);
        });
    }

    /**
     * Generate unique concurrency-safe expense code.
     * Format: EXP-XXXXXX (e.g. EXP-000001)
     */
    protected function generateExpenseCode(): string
    {
        $allCodes = DB::table('expenses')->pluck('expense_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:EXP-?|PC-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'EXP-'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('expenses')->where('expense_code', $candidate)->exists();
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
