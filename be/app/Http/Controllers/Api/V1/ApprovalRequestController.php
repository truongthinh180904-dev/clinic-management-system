<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ApprovalRequestResource;
use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApprovalRequestController extends Controller
{
    /**
     * Display a listing of approval requests with filtering, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ApprovalRequest::query()->with([
            'requester',
            'approver',
            'reference',
        ]);

        // Filter by status (PENDING, APPROVED, REJECTED)
        if ($request->filled('status')) {
            $status = strtoupper(trim((string) $request->input('status')));
            $query->where('status', $status);
        }

        // Filter by request_type
        if ($request->filled('request_type')) {
            $type = trim((string) $request->input('request_type'));
            $query->where('request_type', $type);
        }

        // Filter by reference_type
        if ($request->filled('reference_type')) {
            $refType = trim((string) $request->input('reference_type'));
            $query->where(function ($q) use ($refType) {
                $q->where('reference_type', $refType);
                if (strcasecmp($refType, 'Expense') === 0) {
                    $q->orWhere('reference_type', Expense::class);
                }
                if (strcasecmp($refType, 'Invoice') === 0) {
                    $q->orWhere('reference_type', Invoice::class);
                }
            });
        }

        // Filter by reference_id
        if ($request->filled('reference_id')) {
            $query->where('reference_id', (int) $request->input('reference_id'));
        }

        // Filter by requested_by
        if ($request->filled('requested_by')) {
            $query->where('requested_by', (int) $request->input('requested_by'));
        }

        // Filter by approved_by
        if ($request->filled('approved_by')) {
            $query->where('approved_by', (int) $request->input('approved_by'));
        }

        // Filter by date range (created_at)
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('created_at', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('created_at', '<=', (string) $endDate);
        }

        // Search in reason, rejection_reason, or request_type
        $search = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'LIKE', "%{$search}%")
                    ->orWhere('rejection_reason', 'LIKE', "%{$search}%")
                    ->orWhere('request_type', 'LIKE', "%{$search}%");
            });
        }

        // Sorting
        $allowedSorts = ['id', 'status', 'request_type', 'created_at', 'approved_at'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'id';
        $order = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $paginated = $query->orderBy($sortBy, $order)
            ->orderBy('id', $order)
            ->paginate($perPage);

        $pendingCount = ApprovalRequest::where('status', 'PENDING')->count();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách yêu cầu phê duyệt thành công.',
            'pending_count' => $pendingCount,
            'data' => ApprovalRequestResource::collection($paginated),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'from' => $paginated->firstItem(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'to' => $paginated->lastItem(),
                'total' => $paginated->total(),
                'pending_count' => $pendingCount,
            ],
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'last_page' => $paginated->lastPage(),
            ],
        ], 200);
    }

    /**
     * Display a specific approval request.
     */
    public function show(Request $request, ApprovalRequest|int|string $approvalRequest): JsonResponse
    {
        $approval = $approvalRequest instanceof ApprovalRequest
            ? $approvalRequest
            : ApprovalRequest::findOrFail($approvalRequest);

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết yêu cầu phê duyệt thành công.',
            'data' => new ApprovalRequestResource($approval->load(['requester', 'approver', 'reference'])),
        ], 200);
    }

    /**
     * Store a newly created approval request.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'request_type' => 'required|string|max:50',
            'reference_type' => 'nullable|string|max:100',
            'reference_id' => 'nullable|integer',
            'reason' => 'nullable|string|max:1000',
            'requested_by' => 'nullable|integer|exists:users,id',
        ], [
            'request_type.required' => 'Loại yêu cầu phê duyệt là bắt buộc.',
        ]);

        $approval = ApprovalRequest::create([
            'request_type' => $validated['request_type'],
            'reference_type' => $validated['reference_type'] ?? null,
            'reference_id' => $validated['reference_id'] ?? null,
            'requested_by' => $validated['requested_by'] ?? $request->user()?->id,
            'status' => 'PENDING',
            'reason' => $validated['reason'] ?? null,
            'created_at' => now(),
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'approvals',
            'action' => 'create_request',
            'table_name' => 'approval_requests',
            'record_id' => $approval->id,
            'new_values' => [
                'request_type' => $approval->request_type,
                'reference_type' => $approval->reference_type,
                'reference_id' => $approval->reference_id,
                'status' => 'PENDING',
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo yêu cầu phê duyệt thành công.',
            'data' => new ApprovalRequestResource($approval->load(['requester', 'reference'])),
        ], 201);
    }

    /**
     * Approve an approval request.
     * Synchronizes underlying reference (Expense -> APPROVED, writes CashTransaction OUT) and notifies requester.
     */
    public function approve(Request $request, ApprovalRequest|int|string $approvalRequest): JsonResponse
    {
        $id = $approvalRequest instanceof ApprovalRequest ? $approvalRequest->id : (int) $approvalRequest;

        return DB::transaction(function () use ($request, $id) {
            $approval = ApprovalRequest::whereKey($id)->lockForUpdate()->firstOrFail();

            if ($approval->status !== 'PENDING') {
                return response()->json([
                    'success' => false,
                    'message' => 'Yêu cầu phê duyệt này đã được xử lý trước đó.',
                    'errors' => [
                        'status' => ['Yêu cầu phê duyệt này đã được xử lý trước đó.'],
                    ],
                ], 422);
            }

            $currentUserId = $request->user()?->id;
            $approval->status = 'APPROVED';
            $approval->approved_by = $currentUserId;
            $approval->approved_at = now();
            $approval->save();

            // Synchronize with reference if reference is Expense
            $isExpense = in_array($approval->reference_type, ['Expense', 'expense', Expense::class, 'App\\Models\\Expense'], true)
                || $approval->reference instanceof Expense;

            if ($isExpense && $approval->reference_id) {
                $expense = Expense::whereKey($approval->reference_id)->lockForUpdate()->first();
                if ($expense) {
                    $expense->approval_status = 'APPROVED';
                    $expense->approved_by = $currentUserId;
                    $expense->approved_at = now();
                    $expense->save();

                    // Check if CashTransaction (OUT) already created for this expense
                    $hasCashTx = CashTransaction::where(function ($q) {
                        $q->where('reference_type', 'Expense')
                            ->orWhere('reference_type', Expense::class);
                    })->where('reference_id', $expense->id)->exists();

                    if (! $hasCashTx) {
                        $txCode = $this->generateCashTransactionCode();
                        CashTransaction::create([
                            'transaction_code' => $txCode,
                            'transaction_type' => 'OUT',
                            'reference_type' => 'Expense',
                            'reference_id' => $expense->id,
                            'amount' => $expense->amount,
                            'payment_method' => $expense->payment_method ?? 'CASH',
                            'transaction_date' => $expense->expense_date ?? now(),
                            'description' => $expense->description ?: ("Chi tiền theo phiếu chi {$expense->expense_code}"),
                            'created_by' => $currentUserId,
                            'created_at' => now(),
                        ]);
                    }
                }
            }

            // Send notification to requester
            if ($approval->requested_by) {
                Notification::create([
                    'user_id' => $approval->requested_by,
                    'type' => 'APPROVAL_APPROVED',
                    'title' => 'Yêu cầu phê duyệt đã được chấp thuận',
                    'message' => "Yêu cầu phê duyệt [{$approval->request_type}] #{$approval->id} đã được chấp thuận.",
                    'reference_type' => 'ApprovalRequest',
                    'reference_id' => $approval->id,
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }

            // Audit log
            AuditLog::create([
                'user_id' => $currentUserId,
                'module' => 'approvals',
                'action' => 'approve_request',
                'table_name' => 'approval_requests',
                'record_id' => $approval->id,
                'new_values' => [
                    'status' => 'APPROVED',
                    'approved_by' => $currentUserId,
                    'approved_at' => now()->toIso8601String(),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Phê duyệt yêu cầu thành công.',
                'data' => new ApprovalRequestResource($approval->fresh(['requester', 'approver', 'reference'])),
            ], 200);
        });
    }

    /**
     * Reject an approval request.
     * Requires rejection_reason, updates status to REJECTED, synchronizes Expense, and notifies requester.
     */
    public function reject(Request $request, ApprovalRequest|int|string $approvalRequest): JsonResponse
    {
        $validated = $request->validate([
            'rejection_reason' => 'required|string|min:1|max:1000',
        ], [
            'rejection_reason.required' => 'Vui lòng cung cấp lý do từ chối yêu cầu phê duyệt.',
        ]);

        $rejectionReason = trim((string) $validated['rejection_reason']);
        $id = $approvalRequest instanceof ApprovalRequest ? $approvalRequest->id : (int) $approvalRequest;

        return DB::transaction(function () use ($request, $id, $rejectionReason) {
            $approval = ApprovalRequest::whereKey($id)->lockForUpdate()->firstOrFail();

            if ($approval->status !== 'PENDING') {
                return response()->json([
                    'success' => false,
                    'message' => 'Yêu cầu phê duyệt này đã được xử lý trước đó.',
                    'errors' => [
                        'status' => ['Yêu cầu phê duyệt này đã được xử lý trước đó.'],
                    ],
                ], 422);
            }

            $currentUserId = $request->user()?->id;
            $approval->status = 'REJECTED';
            $approval->approved_by = $currentUserId;
            $approval->approved_at = now();
            $approval->rejection_reason = $rejectionReason;
            $approval->save();

            // Synchronize with reference if reference is Expense
            $isExpense = in_array($approval->reference_type, ['Expense', 'expense', Expense::class, 'App\\Models\\Expense'], true)
                || $approval->reference instanceof Expense;

            if ($isExpense && $approval->reference_id) {
                $expense = Expense::whereKey($approval->reference_id)->lockForUpdate()->first();
                if ($expense) {
                    $expense->approval_status = 'REJECTED';
                    $expense->approved_by = $currentUserId;
                    $expense->approved_at = now();
                    $expense->save();
                }
            }

            // Send notification to requester
            if ($approval->requested_by) {
                Notification::create([
                    'user_id' => $approval->requested_by,
                    'type' => 'APPROVAL_REJECTED',
                    'title' => 'Yêu cầu phê duyệt bị từ chối',
                    'message' => "Yêu cầu phê duyệt [{$approval->request_type}] #{$approval->id} đã bị từ chối. Lý do: {$rejectionReason}",
                    'reference_type' => 'ApprovalRequest',
                    'reference_id' => $approval->id,
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }

            // Audit log
            AuditLog::create([
                'user_id' => $currentUserId,
                'module' => 'approvals',
                'action' => 'reject_request',
                'table_name' => 'approval_requests',
                'record_id' => $approval->id,
                'new_values' => [
                    'status' => 'REJECTED',
                    'approved_by' => $currentUserId,
                    'approved_at' => now()->toIso8601String(),
                    'rejection_reason' => $rejectionReason,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Từ chối yêu cầu phê duyệt thành công.',
                'data' => new ApprovalRequestResource($approval->fresh(['requester', 'approver', 'reference'])),
            ], 200);
        });
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
