<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Requests\Product\UpdateProductStatusRequest;
use App\Http\Resources\ProductResource;
use App\Models\AuditLog;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Services\ProductCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function __construct(
        protected ProductCodeGenerator $codeGenerator
    ) {}

    /**
     * Display a listing of products with dynamic current stock, filters, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->withCurrentStock();

        // Search by product_code or name
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('product_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('name', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Filter by status (ACTIVE / INACTIVE)
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter low stock only
        if ($request->boolean('low_stock_only') || $request->input('low_stock_only') === '1') {
            $query->whereRaw(Product::stockSubquerySql().' <= products.minimum_stock');
        }

        // Filter by specific stock status
        if ($request->filled('stock_status')) {
            $stockStatus = strtoupper((string) $request->input('stock_status'));
            if ($stockStatus === 'OUT_OF_STOCK') {
                $query->whereRaw(Product::stockSubquerySql().' <= 0');
            } elseif ($stockStatus === 'LOW_STOCK') {
                $query->whereRaw(Product::stockSubquerySql().' > 0 AND '.Product::stockSubquerySql().' <= products.minimum_stock');
            } elseif ($stockStatus === 'IN_STOCK') {
                $query->whereRaw(Product::stockSubquerySql().' > products.minimum_stock');
            }
        }

        // Sorting
        $allowedSorts = [
            'id',
            'product_code',
            'name',
            'unit',
            'minimum_stock',
            'status',
            'created_at',
            'updated_at',
            'current_stock',
        ];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        if ($sortBy === 'current_stock') {
            $query->orderByRaw(Product::stockSubquerySql().' '.$sortDirection);
        } else {
            $query->orderBy($sortBy, $sortDirection);
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $products = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh mục sản phẩm thành công.',
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(),
                'from' => $products->firstItem(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'to' => $products->lastItem(),
                'total' => $products->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created product in storage.
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $data = $request->validated();

        $product = DB::transaction(function () use ($data, $request) {
            if (empty($data['product_code'])) {
                $data['product_code'] = $this->codeGenerator->generate();
            }

            $data['minimum_stock'] = $data['minimum_stock'] ?? 0;
            $data['status'] = $data['status'] ?? 'ACTIVE';

            $initialStock = isset($data['initial_stock']) ? (float) $data['initial_stock'] : 0.0;
            unset($data['initial_stock']);

            $product = Product::create($data);

            if ($initialStock > 0) {
                InventoryTransaction::create([
                    'product_id' => $product->id,
                    'transaction_type' => 'IN',
                    'quantity' => $initialStock,
                    'reference_type' => 'INITIAL_STOCK',
                    'reference_id' => $product->id,
                    'transaction_date' => now(),
                    'created_by' => $request->user()?->id,
                    'created_at' => now(),
                ]);
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'products',
                'action' => 'create',
                'table_name' => 'products',
                'record_id' => (string) $product->id,
                'old_values' => null,
                'new_values' => $product->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $product;
        });

        $loadedProduct = Product::withCurrentStock()->findOrFail($product->id);

        return response()->json([
            'success' => true,
            'message' => 'Tạo sản phẩm mới thành công.',
            'data' => new ProductResource($loadedProduct),
        ], 201);
    }

    /**
     * Display the specified product.
     */
    public function show(string|int $id): JsonResponse
    {
        $product = Product::withCurrentStock()->find($id);

        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin sản phẩm.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin chi tiết sản phẩm thành công.',
            'data' => new ProductResource($product),
        ], 200);
    }

    /**
     * Update the specified product in storage.
     */
    public function update(UpdateProductRequest $request, string|int $id): JsonResponse
    {
        $product = Product::find($id);

        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy sản phẩm để cập nhật.',
                'errors' => null,
            ], 404);
        }

        $data = $request->validated();
        $oldValues = $product->toArray();

        $product->update($data);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'products',
            'action' => 'update',
            'table_name' => 'products',
            'record_id' => (string) $product->id,
            'old_values' => $oldValues,
            'new_values' => $product->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        $loadedProduct = Product::withCurrentStock()->findOrFail($product->id);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật sản phẩm thành công.',
            'data' => new ProductResource($loadedProduct),
        ], 200);
    }

    /**
     * Update status for a specific product.
     */
    public function updateStatus(UpdateProductStatusRequest $request, string|int $id): JsonResponse
    {
        $product = Product::find($id);

        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin sản phẩm để cập nhật trạng thái.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $product->toArray();
        $product->update([
            'status' => $request->validated()['status'],
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'products',
            'action' => 'update_status',
            'table_name' => 'products',
            'record_id' => (string) $product->id,
            'old_values' => $oldValues,
            'new_values' => $product->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        $loadedProduct = Product::withCurrentStock()->findOrFail($product->id);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái sản phẩm thành công.',
            'data' => new ProductResource($loadedProduct),
        ], 200);
    }

    /**
     * Remove the specified product from storage.
     */
    public function destroy(Request $request, string|int $id): JsonResponse
    {
        $product = Product::find($id);

        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy sản phẩm để xóa.',
                'errors' => null,
            ], 404);
        }

        if ($product->inventoryTransactions()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa sản phẩm đã có lịch sử biến động kho. Vui lòng chuyển trạng thái sang INACTIVE để ngừng áp dụng mà vẫn bảo toàn lịch sử.',
                'errors' => [
                    'inventory_transactions_count' => $product->inventoryTransactions()->count(),
                ],
            ], 422);
        }

        $oldValues = $product->toArray();
        $product->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'products',
            'action' => 'delete',
            'table_name' => 'products',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa sản phẩm thành công.',
        ], 200);
    }
}
