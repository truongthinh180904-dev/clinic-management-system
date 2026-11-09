<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServicePackage\StoreServicePackageRequest;
use App\Http\Requests\ServicePackage\UpdateServicePackageRequest;
use App\Http\Requests\ServicePackage\UpdateServicePackageStatusRequest;
use App\Http\Resources\ServicePackageResource;
use App\Models\AuditLog;
use App\Models\ServicePackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServicePackageController extends Controller
{
    /**
     * Display a listing of service packages with search, filter, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ServicePackage::query()->withCount(['services', 'packageServices', 'patientPackages']);

        // Search by keyword across code, name, and description
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('package_code', 'LIKE', "%{$searchTerm}%")
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

        // Filter by total sessions range
        if ($request->filled('min_sessions')) {
            $query->where('total_sessions', '>=', (int) $request->input('min_sessions'));
        }
        if ($request->filled('max_sessions')) {
            $query->where('total_sessions', '<=', (int) $request->input('max_sessions'));
        }

        // Filter by validity days range
        if ($request->filled('min_validity_days')) {
            $query->where('validity_days', '>=', (int) $request->input('min_validity_days'));
        }
        if ($request->filled('max_validity_days')) {
            $query->where('validity_days', '<=', (int) $request->input('max_validity_days'));
        }

        // Sorting
        $allowedSorts = [
            'id',
            'package_code',
            'name',
            'price',
            'total_sessions',
            'validity_days',
            'status',
            'created_at',
            'updated_at',
        ];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $packages = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh mục gói dịch vụ thành công.',
            'data' => ServicePackageResource::collection($packages),
            'meta' => [
                'current_page' => $packages->currentPage(),
                'from' => $packages->firstItem(),
                'last_page' => $packages->lastPage(),
                'per_page' => $packages->perPage(),
                'to' => $packages->lastItem(),
                'total' => $packages->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created service package in storage.
     */
    public function store(StoreServicePackageRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (empty($data['package_code'])) {
            $data['package_code'] = $this->generatePackageCode();
        }

        if (empty($data['status'])) {
            $data['status'] = 'ACTIVE';
        }

        $package = ServicePackage::create($data);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'service_packages',
            'action' => 'create',
            'table_name' => 'service_packages',
            'record_id' => (string) $package->id,
            'old_values' => null,
            'new_values' => $package->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo gói dịch vụ mới thành công.',
            'data' => new ServicePackageResource($package->loadCount(['services', 'packageServices', 'patientPackages'])),
        ], 201);
    }

    /**
     * Display the specified service package.
     */
    public function show(string $id): JsonResponse
    {
        $package = ServicePackage::withCount(['services', 'packageServices', 'patientPackages'])
            ->with('services')
            ->find($id);

        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin chi tiết gói dịch vụ thành công.',
            'data' => new ServicePackageResource($package),
        ], 200);
    }

    /**
     * Update the specified service package in storage.
     * Note: Updating catalog price preserves snapshot prices of already-purchased patient_packages.
     */
    public function update(UpdateServicePackageRequest $request, string $id): JsonResponse
    {
        $package = ServicePackage::find($id);

        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ để cập nhật.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $package->toArray();
        $package->update($request->validated());

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'service_packages',
            'action' => 'update',
            'table_name' => 'service_packages',
            'record_id' => (string) $package->id,
            'old_values' => $oldValues,
            'new_values' => $package->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật gói dịch vụ thành công.',
            'data' => new ServicePackageResource($package->fresh()->loadCount(['services', 'packageServices', 'patientPackages'])),
        ], 200);
    }

    /**
     * Update status for a specific service package.
     */
    public function updateStatus(UpdateServicePackageStatusRequest $request, string $id): JsonResponse
    {
        $package = ServicePackage::find($id);

        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ để cập nhật trạng thái.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $package->toArray();
        $package->update([
            'status' => $request->validated()['status'],
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'service_packages',
            'action' => 'update_status',
            'table_name' => 'service_packages',
            'record_id' => (string) $package->id,
            'old_values' => $oldValues,
            'new_values' => $package->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái gói dịch vụ thành công.',
            'data' => new ServicePackageResource($package->fresh()->loadCount(['services', 'packageServices', 'patientPackages'])),
        ], 200);
    }

    /**
     * Remove the specified service package from storage.
     * Preserves patient package purchase records and package service configurations.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $package = ServicePackage::find($id);

        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy gói dịch vụ để xóa.',
                'errors' => null,
            ], 404);
        }

        $hasPatientPackages = $package->patientPackages()->exists();
        $hasPackageServices = $package->packageServices()->exists();

        if ($hasPatientPackages || $hasPackageServices) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa gói dịch vụ đã có bệnh nhân mua hoặc đã cấu hình dịch vụ thành phần. Vui lòng chuyển trạng thái sang INACTIVE để ngừng áp dụng mà vẫn bảo toàn lịch sử.',
                'errors' => [
                    'patient_packages_count' => $package->patientPackages()->count(),
                    'package_services_count' => $package->packageServices()->count(),
                ],
            ], 400);
        }

        $oldValues = $package->toArray();
        $package->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'service_packages',
            'action' => 'delete',
            'table_name' => 'service_packages',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa gói dịch vụ thành công.',
            'data' => null,
        ], 200);
    }

    /**
     * Generate a unique package code with prefix 'PKG'.
     * Format: PKGxxxxxx (e.g., PKG000001, PKG000002)
     */
    protected function generatePackageCode(): string
    {
        $allCodes = DB::table('service_packages')->pluck('package_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:PKG|GOI|PK-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'PKG'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('service_packages')->where('package_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
