<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StoreInventoryTransactionRequest;
use App\Http\Resources\InventoryTransactionResource;
use App\Models\AuditLog;
use App\Models\InventoryTransaction;
use App\Models\Notification;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryTransactionController extends Controller
{
    /**
     * Display a listing of inventory transactions with filtering, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = InventoryTransaction::query()->with([
            'product' => function ($pq) {
                $pq->withCurrentStock();
            },
            'creator',
        ]);

        // Filter by product_id
        if ($request->filled('product_id')) {
            $query->where('product_id', (int) $request->input('product_id'));
        }

        // Filter by transaction_type (IN, OUT, ADJUST)
        if ($request->filled('transaction_type')) {
            $type = strtoupper(trim((string) $request->input('transaction_type')));
            $query->where('transaction_type', $type);
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

        // Filter by reference_type & reference_id
        if ($request->filled('reference_type')) {
            $query->where('reference_type', (string) $request->input('reference_type'));
        }

        if ($request->filled('reference_id')) {
            $query->where('reference_id', (int) $request->input('reference_id'));
        }

        // Search by keyword in product_code or product name
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->whereHas('product', function ($q) use ($searchTerm) {
                $q->where('product_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('name', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Sorting
        $allowedSorts = [
            'id',
            'product_id',
            'transaction_type',
            'quantity',
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
            'message' => 'Lấy danh sách giao dịch kho thành công.',
            'data' => InventoryTransactionResource::collection($transactions),
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
     * Display the specified inventory transaction.
     */
    public function show(int $id): JsonResponse
    {
        $transaction = InventoryTransaction::with([
            'product' => function ($pq) {
                $pq->withCurrentStock();
            },
            'creator',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết giao dịch kho thành công.',
            'data' => new InventoryTransactionResource($transaction),
        ], 200);
    }

    /**
     * Display warehouse summary metrics and transaction statistics.
     */
    public function summary(Request $request): JsonResponse
    {
        $products = Product::query()->select(['id', 'minimum_stock'])->withCurrentStock()->get();
        $totalProducts = $products->count();
        $inStockCount = 0;
        $lowStockCount = 0;
        $outOfStockCount = 0;

        foreach ($products as $product) {
            $stock = (float) $product->current_stock;
            $min = (float) ($product->minimum_stock ?? 0);

            if ($stock <= 0) {
                $outOfStockCount++;
            } elseif ($stock <= $min) {
                $lowStockCount++;
            } else {
                $inStockCount++;
            }
        }

        // Transactions in period
        $txQuery = InventoryTransaction::query();
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $txQuery->whereDate('transaction_date', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $txQuery->whereDate('transaction_date', '<=', (string) $endDate);
        }

        $transactions = $txQuery->get(['transaction_type', 'quantity']);

        $totalTransactions = $transactions->count();
        $totalInTransactions = $transactions->where('transaction_type', 'IN')->count();
        $totalOutTransactions = $transactions->where('transaction_type', 'OUT')->count();
        $totalAdjustTransactions = $transactions->where('transaction_type', 'ADJUST')->count();

        $totalInQuantity = round((float) $transactions->where('transaction_type', 'IN')->sum('quantity'), 3);
        $totalOutQuantity = round((float) $transactions->where('transaction_type', 'OUT')->sum('quantity'), 3);
        $totalAdjustQuantity = round((float) $transactions->where('transaction_type', 'ADJUST')->sum('quantity'), 3);

        return response()->json([
            'success' => true,
            'message' => 'Lấy thống kê tổng quan kho thành công.',
            'data' => [
                'total_products' => $totalProducts,
                'in_stock_products' => $inStockCount,
                'low_stock_products' => $lowStockCount,
                'out_of_stock_products' => $outOfStockCount,
                'total_items' => $totalProducts,
                'in_stock_count' => $inStockCount,
                'low_stock_count' => $lowStockCount,
                'out_of_stock_count' => $outOfStockCount,
                'total_transactions' => $totalTransactions,
                'total_in_transactions' => $totalInTransactions,
                'total_out_transactions' => $totalOutTransactions,
                'total_adjust_transactions' => $totalAdjustTransactions,
                'total_in_quantity' => $totalInQuantity,
                'total_out_quantity' => $totalOutQuantity,
                'total_adjust_quantity' => $totalAdjustQuantity,
            ],
        ], 200);
    }

    /**
     * Store a newly created inventory transaction with pessimistic locking and negative stock prevention.
     */
    public function store(StoreInventoryTransactionRequest $request): JsonResponse
    {
        $user = $request->user();
        $type = strtoupper((string) $request->input('transaction_type'));

        // Granular permission check
        if ($user) {
            if ($type === 'IN' && ! $user->hasPermission('inventory.in')) {
                abort(403, 'Bạn không có quyền thực hiện nhập kho.');
            }
            if ($type === 'OUT' && ! $user->hasPermission('inventory.out')) {
                abort(403, 'Bạn không có quyền thực hiện xuất kho.');
            }
            if ($type === 'ADJUST' && ! $user->hasPermission('inventory.adjust')) {
                abort(403, 'Bạn không có quyền thực hiện điều chỉnh kiểm kê kho.');
            }
        }

        $result = DB::transaction(function () use ($request, $type, $user) {
            $productId = (int) $request->input('product_id');
            $quantity = (float) $request->input('quantity');

            // 1. Pessimistic lock on Product record to prevent race condition
            $product = Product::whereKey($productId)->lockForUpdate()->firstOrFail();

            // 2. Compute current stock inside the transaction lock
            $currentStock = (float) InventoryTransaction::where('product_id', $product->id)
                ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as total")
                ->value('total');

            // 3. Validate stock bounds per transaction type
            if ($type === 'OUT') {
                if ($quantity <= 0) {
                    throw ValidationException::withMessages([
                        'quantity' => ['Số lượng xuất kho phải lớn hơn 0.'],
                    ]);
                }
                if ($quantity > $currentStock) {
                    throw ValidationException::withMessages([
                        'quantity' => ["Số lượng xuất kho ({$quantity}) vượt quá số lượng tồn hiện tại ({$currentStock})."],
                    ]);
                }
                $newStock = round($currentStock - $quantity, 3);
            } elseif ($type === 'ADJUST') {
                if ($quantity == 0) {
                    throw ValidationException::withMessages([
                        'quantity' => ['Số lượng điều chỉnh kiểm kê không được bằng 0.'],
                    ]);
                }
                $newStock = round($currentStock + $quantity, 3);
                if ($newStock < 0) {
                    throw ValidationException::withMessages([
                        'quantity' => ["Tồn kho sau điều chỉnh không được nhỏ hơn 0 (tồn hiện tại: {$currentStock}, chênh lệch: {$quantity})."],
                    ]);
                }
            } else { // 'IN'
                if ($quantity <= 0) {
                    throw ValidationException::withMessages([
                        'quantity' => ['Số lượng nhập kho phải lớn hơn 0.'],
                    ]);
                }
                $newStock = round($currentStock + $quantity, 3);
            }

            $transactionDate = $request->filled('transaction_date')
                ? Carbon::parse($request->input('transaction_date'))
                : now();

            // 4. Create the inventory transaction record
            $transaction = InventoryTransaction::create([
                'product_id' => $product->id,
                'transaction_type' => $type,
                'quantity' => $quantity,
                'reference_type' => $request->input('reference_type'),
                'reference_id' => $request->input('reference_id'),
                'transaction_date' => $transactionDate,
                'created_by' => $user?->id,
                'created_at' => now(),
            ]);

            // 5. Automatic Low Stock Alert Notification
            $minimumStock = (float) ($product->minimum_stock ?? 0);
            $isLowStock = $newStock <= $minimumStock;

            if ($isLowStock) {
                $managersAndAdmins = User::where('status', 'ACTIVE')
                    ->whereHas('roles', function ($q) {
                        $q->whereIn('name', ['ADMIN', 'MANAGER']);
                    })
                    ->get();

                foreach ($managersAndAdmins as $adminUser) {
                    Notification::create([
                        'user_id' => $adminUser->id,
                        'type' => 'LOW_STOCK',
                        'title' => 'Cảnh báo tồn kho thấp: '.$product->name,
                        'message' => "Sản phẩm {$product->name} ({$product->product_code}) hiện có tồn kho {$newStock} {$product->unit}, đã đạt hoặc dưới định mức tối thiểu ({$minimumStock} {$product->unit}).",
                        'reference_type' => 'Product',
                        'reference_id' => $product->id,
                        'is_read' => false,
                        'created_at' => now(),
                    ]);
                }
            }

            // 6. Record Audit Log
            AuditLog::create([
                'user_id' => $user?->id,
                'module' => 'inventory',
                'action' => 'inventory_'.strtolower($type),
                'table_name' => 'inventory_transactions',
                'record_id' => (string) $transaction->id,
                'old_values' => ['current_stock' => $currentStock],
                'new_values' => [
                    'transaction_id' => $transaction->id,
                    'product_id' => $product->id,
                    'transaction_type' => $type,
                    'quantity' => $quantity,
                    'new_stock' => $newStock,
                    'is_low_stock' => $isLowStock,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return [
                'transaction' => $transaction->load(['product', 'creator']),
                'current_stock' => $newStock,
                'is_low_stock' => $isLowStock,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Giao dịch kho đã được thực hiện thành công.',
            'data' => new InventoryTransactionResource($result['transaction']),
            'current_stock' => $result['current_stock'],
            'is_low_stock' => $result['is_low_stock'],
        ], 201);
    }
}
