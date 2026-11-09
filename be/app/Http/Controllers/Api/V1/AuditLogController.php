<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Display a paginated listing of audit logs.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user.employee']);

        // Filter by module
        if ($request->filled('module')) {
            $query->where('module', $request->input('module'));
        }

        // Filter by action
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        // Filter by user_id
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Filter by table_name
        if ($request->filled('table_name')) {
            $query->where('table_name', $request->input('table_name'));
        }

        // Filter by record_id
        if ($request->filled('record_id')) {
            $query->where('record_id', (string) $request->input('record_id'));
        }

        // Filter by date range (created_at)
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->where('created_at', '>=', Carbon::parse((string) $startDate)->startOfDay());
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->where('created_at', '<=', Carbon::parse((string) $endDate)->endOfDay());
        }

        // Free-text search across module, action, table_name, record_id, ip_address or username
        $search = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('module', 'like', "%{$search}%")
                    ->orWhere('action', 'like', "%{$search}%")
                    ->orWhere('table_name', 'like', "%{$search}%")
                    ->orWhere('record_id', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('username', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        // Sorting
        $allowedSorts = ['id', 'created_at', 'module', 'action'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $order = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 20)));

        $logs = $query->orderBy($sortBy, $order)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách nhật ký kiểm toán thành công.',
            'data' => AuditLogResource::collection($logs),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'from' => $logs->firstItem(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'to' => $logs->lastItem(),
                'total' => $logs->total(),
            ],
        ], 200);
    }

    /**
     * Display a specific audit log record.
     */
    public function show(string $id): JsonResponse
    {
        $log = AuditLog::with(['user.employee'])->find($id);

        if (! $log) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy bản ghi nhật ký kiểm toán.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Chi tiết nhật ký kiểm toán.',
            'data' => new AuditLogResource($log),
        ], 200);
    }

    /**
     * Get distinct modules and actions for filter dropdowns.
     */
    public function metadata(): JsonResponse
    {
        $modules = AuditLog::query()->select('module')->distinct()->pluck('module')->filter()->values();
        $actions = AuditLog::query()->select('action')->distinct()->pluck('action')->filter()->values();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh mục phân loại nhật ký kiểm toán thành công.',
            'data' => [
                'modules' => $modules,
                'actions' => $actions,
            ],
        ], 200);
    }
}
