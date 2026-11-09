<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Service\StoreServiceRequest;
use App\Http\Requests\Service\UpdateServiceRequest;
use App\Http\Requests\Service\UpdateServiceStatusRequest;
use App\Http\Resources\ServiceResource;
use App\Models\AuditLog;
use App\Models\Service;
use App\Services\ServiceCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function __construct(
        protected ServiceCodeGenerator $codeGenerator
    ) {}

    /**
     * Display a listing of services with search, filter, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Service::query()->withCount(['appointments', 'visits', 'packages']);

        // Search by keyword across code, name, and description
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('service_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter by price range
        if ($request->filled('min_price')) {
            $query->where('price', '>=', (float) $request->input('min_price'));
        }
        if ($request->filled('max_price')) {
            $query->where('price', '<=', (float) $request->input('max_price'));
        }

        // Sorting
        $allowedSorts = [
            'id',
            'service_code',
            'name',
            'price',
            'duration_minutes',
            'status',
            'created_at',
            'updated_at',
        ];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $services = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh mục dịch vụ thành công.',
            'data' => ServiceResource::collection($services),
            'meta' => [
                'current_page' => $services->currentPage(),
                'from' => $services->firstItem(),
                'last_page' => $services->lastPage(),
                'per_page' => $services->perPage(),
                'to' => $services->lastItem(),
                'total' => $services->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created service in storage.
     */
    public function store(StoreServiceRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (empty($data['service_code'])) {
            $data['service_code'] = $this->codeGenerator->generate();
        }

        if (empty($data['status'])) {
            $data['status'] = 'ACTIVE';
        }

        $service = Service::create($data);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'services',
            'action' => 'create',
            'table_name' => 'services',
            'record_id' => (string) $service->id,
            'old_values' => null,
            'new_values' => $service->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo dịch vụ mới thành công.',
            'data' => new ServiceResource($service->loadCount(['appointments', 'visits', 'packages'])),
        ], 201);
    }

    /**
     * Display the specified service.
     */
    public function show(string $id): JsonResponse
    {
        $service = Service::withCount(['appointments', 'visits', 'packages'])->find($id);

        if (! $service) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin dịch vụ.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin chi tiết dịch vụ thành công.',
            'data' => new ServiceResource($service),
        ], 200);
    }

    /**
     * Update the specified service in storage.
     */
    public function update(UpdateServiceRequest $request, string $id): JsonResponse
    {
        $service = Service::find($id);

        if (! $service) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin dịch vụ để cập nhật.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $service->toArray();
        $service->update($request->validated());

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'services',
            'action' => 'update',
            'table_name' => 'services',
            'record_id' => (string) $service->id,
            'old_values' => $oldValues,
            'new_values' => $service->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật dịch vụ thành công.',
            'data' => new ServiceResource($service->fresh()->loadCount(['appointments', 'visits', 'packages'])),
        ], 200);
    }

    /**
     * Update status for a specific service.
     */
    public function updateStatus(UpdateServiceStatusRequest $request, string $id): JsonResponse
    {
        $service = Service::find($id);

        if (! $service) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin dịch vụ để cập nhật trạng thái.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $service->toArray();
        $service->update([
            'status' => $request->validated()['status'],
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'services',
            'action' => 'update_status',
            'table_name' => 'services',
            'record_id' => (string) $service->id,
            'old_values' => $oldValues,
            'new_values' => $service->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái dịch vụ thành công.',
            'data' => new ServiceResource($service->fresh()->loadCount(['appointments', 'visits', 'packages'])),
        ], 200);
    }

    /**
     * Remove the specified service from storage.
     * Preserves clinical history for past visits, appointments, and package bundles.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $service = Service::find($id);

        if (! $service) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy dịch vụ để xóa.',
                'errors' => null,
            ], 404);
        }

        // Prevent deletion if service has clinical, appointment, or package history
        $hasAppointments = $service->appointments()->exists();
        $hasVisits = $service->visits()->exists();
        $hasPackages = $service->packageServices()->exists();

        if ($hasAppointments || $hasVisits || $hasPackages) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa dịch vụ đã phát sinh lịch hẹn, lượt khám hoặc thuộc gói dịch vụ. Vui lòng chuyển trạng thái sang INACTIVE để ngừng áp dụng mà vẫn bảo toàn lịch sử.',
                'errors' => [
                    'appointments_count' => $service->appointments()->count(),
                    'visits_count' => $service->visits()->count(),
                    'packages_count' => $service->packageServices()->count(),
                ],
            ], 400);
        }

        $oldValues = $service->toArray();
        $service->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'services',
            'action' => 'delete',
            'table_name' => 'services',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa dịch vụ thành công.',
            'data' => null,
        ], 200);
    }
}
