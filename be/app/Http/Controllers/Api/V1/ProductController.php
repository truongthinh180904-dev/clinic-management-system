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
        $this->ensureClinicalProductsSeeded();

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

    /**
     * Ensure clinic pharmacy products and initial stock exist in database.
     */
    protected function ensureClinicalProductsSeeded(): void
    {
        if (Product::where('product_code', 'PRD-000001')->exists()) {
            return;
        }

        $items = [
            ['product_code' => 'PRD-000001', 'name' => 'Paracetamol 500mg (Hạ sốt, giảm đau)', 'unit' => 'Viên', 'minimum_stock' => 50, 'initial_stock' => 450],
            ['product_code' => 'PRD-000002', 'name' => 'Augmentin 1g (Amoxicillin + Clavulanate)', 'unit' => 'Viên', 'minimum_stock' => 20, 'initial_stock' => 120],
            ['product_code' => 'PRD-000003', 'name' => 'Amoxicillin 500mg', 'unit' => 'Viên', 'minimum_stock' => 30, 'initial_stock' => 320],
            ['product_code' => 'PRD-000004', 'name' => 'Alpha Choay (Chymotrypsin kháng viêm phù nề)', 'unit' => 'Viên', 'minimum_stock' => 30, 'initial_stock' => 260],
            ['product_code' => 'PRD-000005', 'name' => 'Ibuprofen 400mg (Giảm đau, kháng viêm NSAID)', 'unit' => 'Viên', 'minimum_stock' => 25, 'initial_stock' => 190],
            ['product_code' => 'PRD-000006', 'name' => 'Omeprazole 20mg (Ức chế acid dạ dày)', 'unit' => 'Viên', 'minimum_stock' => 30, 'initial_stock' => 215],
            ['product_code' => 'PRD-000007', 'name' => 'Phosphalugel (Gel nhôm phosphat chữ P)', 'unit' => 'Gói', 'minimum_stock' => 20, 'initial_stock' => 95],
            ['product_code' => 'PRD-000008', 'name' => 'Cetirizine 10mg (Chống dị ứng, kháng Histamin)', 'unit' => 'Viên', 'minimum_stock' => 20, 'initial_stock' => 180],
            ['product_code' => 'PRD-000009', 'name' => 'Dextromethorphan 15mg (Giảm ho khan)', 'unit' => 'Viên', 'minimum_stock' => 20, 'initial_stock' => 140],
            ['product_code' => 'PRD-000010', 'name' => 'Men vi sinh Enterogermina (2 tỷ bào tử)', 'unit' => 'Ống', 'minimum_stock' => 15, 'initial_stock' => 85],
            ['product_code' => 'PRD-000011', 'name' => 'Bột pha bù nước Oresol 245mg', 'unit' => 'Gói', 'minimum_stock' => 30, 'initial_stock' => 350],
            ['product_code' => 'PRD-000012', 'name' => 'Nước súc miệng Chlorhexidine 0.12%', 'unit' => 'Chai', 'minimum_stock' => 10, 'initial_stock' => 45],
            ['product_code' => 'PRD-000013', 'name' => 'Vitamin C 500mg (Tăng sức đề kháng)', 'unit' => 'Viên', 'minimum_stock' => 40, 'initial_stock' => 500],
            ['product_code' => 'PRD-000014', 'name' => 'Spiramycin + Metronidazole (Rodogyl)', 'unit' => 'Viên', 'minimum_stock' => 20, 'initial_stock' => 110],
            ['product_code' => 'PRD-000015', 'name' => 'Bơm tiêm vô trùng 5ml', 'unit' => 'Cái', 'minimum_stock' => 50, 'initial_stock' => 200],
            ['product_code' => 'PRD-000016', 'name' => 'Cồn y tế 70 độ 500ml', 'unit' => 'Chai', 'minimum_stock' => 10, 'initial_stock' => 50],
            ['product_code' => 'PRD-000017', 'name' => 'Găng tay y tế Nitrile (Hộp 100 chiếc)', 'unit' => 'Hộp', 'minimum_stock' => 10, 'initial_stock' => 40],
        ];

        DB::transaction(function () use ($items) {
            foreach ($items as $item) {
                $initialStock = $item['initial_stock'];
                unset($item['initial_stock']);
                $item['status'] = 'ACTIVE';

                $prod = Product::firstOrCreate(
                    ['product_code' => $item['product_code']],
                    $item
                );

                if (! $prod->inventoryTransactions()->exists()) {
                    InventoryTransaction::create([
                        'product_id' => $prod->id,
                        'transaction_type' => 'IN',
                        'quantity' => $initialStock,
                        'reference_type' => 'INITIAL_STOCK',
                        'reference_id' => null,
                        'transaction_date' => now()->subDays(5),
                        'created_by' => null,
                        'created_at' => now()->subDays(5),
                    ]);
                }
            }
        });
    }
}
