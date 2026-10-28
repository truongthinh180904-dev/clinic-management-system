<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExpenseCategoryResource;
use App\Models\AuditLog;
use App\Models\ExpenseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseCategoryController extends Controller
{
    /**
     * Display a listing of expense categories with search and filter.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ExpenseCategory::query()
            ->withCount('expenses')
            ->withSum(['expenses as total_amount' => function ($q) {
                $q->where('approval_status', 'APPROVED');
            }], 'amount');

        // Search by name or description
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Sorting
        $allowedSorts = ['id', 'name', 'status', 'created_at'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'name';
        $order = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'asc'))) === 'desc'
            ? 'desc'
            : 'asc';

        $query->orderBy($sortBy, $order)->orderBy('id', 'asc');

        if ($request->boolean('all') || $request->input('per_page') === 'all') {
            $categories = $query->get();

            return response()->json([
                'success' => true,
                'message' => 'Lấy danh mục chi phí thành công.',
                'data' => ExpenseCategoryResource::collection($categories),
            ], 200);
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 50)));
        $categories = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh mục chi phí thành công.',
            'data' => ExpenseCategoryResource::collection($categories),
            'meta' => [
                'current_page' => $categories->currentPage(),
                'from' => $categories->firstItem(),
                'last_page' => $categories->lastPage(),
                'per_page' => $categories->perPage(),
                'to' => $categories->lastItem(),
                'total' => $categories->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created expense category.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:expense_categories,name'],
            'description' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'string', 'in:ACTIVE,INACTIVE'],
        ], [
            'name.required' => 'Vui lòng nhập tên danh mục chi phí.',
            'name.unique' => 'Tên danh mục chi phí đã tồn tại.',
            'name.max' => 'Tên danh mục không được vượt quá 100 ký tự.',
            'description.max' => 'Mô tả không được vượt quá 500 ký tự.',
            'status.in' => 'Trạng thái phải là ACTIVE hoặc INACTIVE.',
        ]);

        $category = ExpenseCategory::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'ACTIVE',
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'expenses',
            'action' => 'create_category',
            'table_name' => 'expense_categories',
            'record_id' => (string) $category->id,
            'new_values' => $category->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Thêm danh mục chi phí thành công.',
            'data' => new ExpenseCategoryResource($category),
        ], 201);
    }

    /**
     * Display the specified expense category.
     */
    public function show(ExpenseCategory $expenseCategory): JsonResponse
    {
        $expenseCategory->loadCount('expenses');
        $expenseCategory->total_amount = $expenseCategory->expenses()
            ->where('approval_status', 'APPROVED')
            ->sum('amount');

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết danh mục chi phí thành công.',
            'data' => new ExpenseCategoryResource($expenseCategory),
        ], 200);
    }

    /**
     * Update the specified expense category.
     */
    public function update(Request $request, ExpenseCategory $expenseCategory): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('expense_categories', 'name')->ignore($expenseCategory->id)],
            'description' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'string', 'in:ACTIVE,INACTIVE'],
        ], [
            'name.required' => 'Vui lòng nhập tên danh mục chi phí.',
            'name.unique' => 'Tên danh mục chi phí đã tồn tại.',
            'name.max' => 'Tên danh mục không được vượt quá 100 ký tự.',
            'description.max' => 'Mô tả không được vượt quá 500 ký tự.',
            'status.in' => 'Trạng thái phải là ACTIVE hoặc INACTIVE.',
        ]);

        $oldValues = $expenseCategory->toArray();
        $expenseCategory->update($validated);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'expenses',
            'action' => 'update_category',
            'table_name' => 'expense_categories',
            'record_id' => (string) $expenseCategory->id,
            'old_values' => $oldValues,
            'new_values' => $expenseCategory->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật danh mục chi phí thành công.',
            'data' => new ExpenseCategoryResource($expenseCategory->fresh()),
        ], 200);
    }

    /**
     * Remove the specified expense category.
     */
    public function destroy(Request $request, ExpenseCategory $expenseCategory): JsonResponse
    {
        if ($expenseCategory->expenses()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa danh mục đã phát sinh phiếu chi. Vui lòng chuyển trạng thái sang INACTIVE.',
                'errors' => [
                    'expenses_count' => [$expenseCategory->expenses()->count()],
                ],
            ], 422);
        }

        $oldValues = $expenseCategory->toArray();
        $expenseCategory->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'expenses',
            'action' => 'delete_category',
            'table_name' => 'expense_categories',
            'record_id' => (string) $expenseCategory->id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa danh mục chi phí thành công.',
            'data' => null,
        ], 200);
    }
}
