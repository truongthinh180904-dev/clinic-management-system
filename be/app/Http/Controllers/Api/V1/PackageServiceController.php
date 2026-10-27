<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServicePackage\StorePackageServiceRequest;
use App\Http\Requests\ServicePackage\UpdatePackageServiceRequest;
use App\Http\Resources\PackageServiceResource;
use App\Models\AuditLog;
use App\Models\PackageService;
use App\Models\Service;
use App\Models\ServicePackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PackageServiceController extends Controller
{
    /**
     * Resolve the ServicePackage instance from an ID, code, or model.
     */
    protected function findPackage(mixed $package): ?ServicePackage
    {
        if ($package instanceof ServicePackage) {
            return $package;
        }

        if (is_numeric($package)) {
            return ServicePackage::find($package);
        }

        return ServicePackage::where('id', $package)
            ->orWhere('package_code', $package)
            ->first();
    }

    /**
     * Resolve the service ID from URL parameter or request payload.
     */
    protected function resolveServiceId(Request $request, mixed $service = null): ?int
    {
        if ($service instanceof Service) {
            return (int) $service->id;
        }

        if (! empty($service)) {
            if (is_numeric($service)) {
                return (int) $service;
            }

            $found = Service::where('service_code', $service)->first();
            if ($found) {
                return (int) $found->id;
            }
        }

        if ($request->filled('service_id')) {
            return (int) $request->input('service_id');
        }

        return null;
    }

    /**
     * Display a listing of services configured in the specified package.
     */
    public function index(Request $request, mixed $package): JsonResponse
    {
        $pkg = $this->findPackage($package);
        if (! $pkg) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
                'errors' => null,
            ], 404);
        }

        $packageServices = PackageService::where('package_id', $pkg->id)
            ->with('service')
            ->orderBy('service_id', 'asc')
            ->get();

        $totalQuantity = (int) $packageServices->sum('quantity');

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách dịch vụ trong gói thành công.',
            'data' => PackageServiceResource::collection($packageServices),
            'meta' => [
                'package_id' => $pkg->id,
                'package_code' => $pkg->package_code,
                'package_name' => $pkg->name,
                'total_services' => $packageServices->count(),
                'total_quantity' => $totalQuantity,
            ],
        ], 200);
    }

    /**
     * Store (add) a service into the specified service package.
     * Prevents duplicate (package_id, service_id) combinations by returning 409 Conflict.
     */
    public function store(StorePackageServiceRequest $request, mixed $package): JsonResponse
    {
        $pkg = $this->findPackage($package);
        if (! $pkg) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
                'errors' => null,
            ], 404);
        }

        $validated = $request->validated();

        return DB::transaction(function () use ($request, $pkg, $validated) {
            // Case 1: Batch services provided
            if (! empty($validated['services'])) {
                $serviceIds = array_column($validated['services'], 'service_id');
                $existing = DB::table('package_services')
                    ->where('package_id', $pkg->id)
                    ->whereIn('service_id', $serviceIds)
                    ->pluck('service_id')
                    ->toArray();

                if (! empty($existing)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Dịch vụ đã tồn tại trong gói dịch vụ. Không thể thêm trùng.',
                        'errors' => [
                            'service_id' => ['Một hoặc nhiều dịch vụ đã tồn tại trong gói: '.implode(', ', $existing)],
                        ],
                    ], 409);
                }

                $inserted = [];
                $now = now();
                foreach ($validated['services'] as $item) {
                    $qty = isset($item['quantity']) ? (int) $item['quantity'] : 1;
                    if ($qty < 1) {
                        $qty = 1;
                    }

                    DB::table('package_services')->insert([
                        'package_id' => $pkg->id,
                        'service_id' => (int) $item['service_id'],
                        'quantity' => $qty,
                        'created_at' => $now,
                    ]);

                    $inserted[] = [
                        'package_id' => $pkg->id,
                        'service_id' => (int) $item['service_id'],
                        'quantity' => $qty,
                    ];
                }

                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'module' => 'service_packages',
                    'action' => 'add_package_services_batch',
                    'table_name' => 'package_services',
                    'record_id' => (string) $pkg->id,
                    'old_values' => null,
                    'new_values' => $inserted,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'created_at' => now(),
                ]);

                $records = PackageService::where('package_id', $pkg->id)
                    ->whereIn('service_id', $serviceIds)
                    ->with('service')
                    ->get();

                return response()->json([
                    'success' => true,
                    'message' => 'Thêm danh sách dịch vụ vào gói thành công.',
                    'data' => PackageServiceResource::collection($records),
                ], 201);
            }

            // Case 2: Single service
            $serviceId = (int) $validated['service_id'];
            $quantity = isset($validated['quantity']) ? (int) $validated['quantity'] : 1;
            if ($quantity < 1) {
                $quantity = 1;
            }

            $exists = DB::table('package_services')
                ->where('package_id', $pkg->id)
                ->where('service_id', $serviceId)
                ->exists();

            if ($exists) {
                return response()->json([
                    'success' => false,
                    'message' => 'Dịch vụ này đã tồn tại trong gói dịch vụ. Không thể thêm trùng.',
                    'errors' => [
                        'service_id' => ['Dịch vụ đã tồn tại trong gói dịch vụ.'],
                    ],
                ], 409);
            }

            $now = now();
            DB::table('package_services')->insert([
                'package_id' => $pkg->id,
                'service_id' => $serviceId,
                'quantity' => $quantity,
                'created_at' => $now,
            ]);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'service_packages',
                'action' => 'add_package_service',
                'table_name' => 'package_services',
                'record_id' => (string) $pkg->id,
                'old_values' => null,
                'new_values' => [
                    'package_id' => $pkg->id,
                    'service_id' => $serviceId,
                    'quantity' => $quantity,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            $record = PackageService::where('package_id', $pkg->id)
                ->where('service_id', $serviceId)
                ->with('service')
                ->first();

            return response()->json([
                'success' => true,
                'message' => 'Thêm dịch vụ vào gói thành công.',
                'data' => new PackageServiceResource($record),
            ], 201);
        });
    }

    /**
     * Update the quantity of a specific service inside the package.
     */
    public function update(UpdatePackageServiceRequest $request, mixed $package, mixed $service = null): JsonResponse
    {
        $pkg = $this->findPackage($package);
        if (! $pkg) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
                'errors' => null,
            ], 404);
        }

        $serviceId = $this->resolveServiceId($request, $service);
        if (! $serviceId) {
            if ($request->has('services')) {
                return $this->syncOrUpdate($request, $package);
            }

            return response()->json([
                'success' => false,
                'message' => 'Vui lòng xác định dịch vụ cần cập nhật.',
                'errors' => [
                    'service_id' => ['ID dịch vụ không được để trống.'],
                ],
            ], 422);
        }

        $existing = DB::table('package_services')
            ->where('package_id', $pkg->id)
            ->where('service_id', $serviceId)
            ->first();

        if (! $existing) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy dịch vụ này trong gói để cập nhật.',
                'errors' => null,
            ], 404);
        }

        $quantity = (int) $request->input('quantity', $existing->quantity);
        if ($quantity < 1) {
            return response()->json([
                'success' => false,
                'message' => 'Số lượng buổi dịch vụ phải lớn hơn hoặc bằng 1.',
                'errors' => [
                    'quantity' => ['Số lượng buổi dịch vụ phải lớn hơn hoặc bằng 1.'],
                ],
            ], 422);
        }

        return DB::transaction(function () use ($request, $pkg, $serviceId, $quantity, $existing) {
            $oldValues = (array) $existing;

            DB::table('package_services')
                ->where('package_id', $pkg->id)
                ->where('service_id', $serviceId)
                ->update(['quantity' => $quantity]);

            $newValues = [
                'package_id' => $pkg->id,
                'service_id' => $serviceId,
                'quantity' => $quantity,
            ];

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'service_packages',
                'action' => 'update_package_service_quantity',
                'table_name' => 'package_services',
                'record_id' => (string) $pkg->id,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            $record = PackageService::where('package_id', $pkg->id)
                ->where('service_id', $serviceId)
                ->with('service')
                ->first();

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật số lượng dịch vụ trong gói thành công.',
                'data' => new PackageServiceResource($record),
            ], 200);
        });
    }

    /**
     * Batch sync or update multiple services in the package.
     */
    public function syncOrUpdate(UpdatePackageServiceRequest $request, mixed $package): JsonResponse
    {
        $pkg = $this->findPackage($package);
        if (! $pkg) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
                'errors' => null,
            ], 404);
        }

        if ($request->filled('service_id')) {
            return $this->update($request, $package, (string) $request->input('service_id'));
        }

        $services = $request->input('services');
        if (! is_array($services)) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu cấu hình dịch vụ không hợp lệ.',
                'errors' => [
                    'services' => ['Danh sách dịch vụ hoặc ID dịch vụ là bắt buộc.'],
                ],
            ], 422);
        }

        return DB::transaction(function () use ($request, $pkg, $services) {
            $oldRecords = DB::table('package_services')
                ->where('package_id', $pkg->id)
                ->get()
                ->toArray();

            $now = now();
            $syncData = [];
            foreach ($services as $item) {
                $sId = (int) $item['service_id'];
                $qty = isset($item['quantity']) ? (int) $item['quantity'] : 1;
                if ($qty < 1) {
                    $qty = 1;
                }
                $syncData[$sId] = [
                    'quantity' => $qty,
                    'created_at' => $now,
                ];
            }

            $pkg->services()->sync($syncData);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'service_packages',
                'action' => 'sync_package_services',
                'table_name' => 'package_services',
                'record_id' => (string) $pkg->id,
                'old_values' => $oldRecords,
                'new_values' => $syncData,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            $records = PackageService::where('package_id', $pkg->id)
                ->with('service')
                ->get();

            return response()->json([
                'success' => true,
                'message' => 'Đồng bộ danh sách dịch vụ trong gói thành công.',
                'data' => PackageServiceResource::collection($records),
            ], 200);
        });
    }

    /**
     * Remove a service from the specified service package.
     */
    public function destroy(Request $request, mixed $package, mixed $service = null): JsonResponse
    {
        $pkg = $this->findPackage($package);
        if (! $pkg) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
                'errors' => null,
            ], 404);
        }

        $serviceId = $this->resolveServiceId($request, $service);
        if (! $serviceId) {
            return response()->json([
                'success' => false,
                'message' => 'Vui lòng xác định dịch vụ cần xóa khỏi gói.',
                'errors' => [
                    'service_id' => ['ID dịch vụ không được để trống.'],
                ],
            ], 422);
        }

        $existing = DB::table('package_services')
            ->where('package_id', $pkg->id)
            ->where('service_id', $serviceId)
            ->first();

        if (! $existing) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy dịch vụ này trong gói để xóa.',
                'errors' => null,
            ], 404);
        }

        return DB::transaction(function () use ($request, $pkg, $serviceId, $existing) {
            $oldValues = (array) $existing;

            DB::table('package_services')
                ->where('package_id', $pkg->id)
                ->where('service_id', $serviceId)
                ->delete();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'service_packages',
                'action' => 'remove_package_service',
                'table_name' => 'package_services',
                'record_id' => (string) $pkg->id,
                'old_values' => $oldValues,
                'new_values' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Xóa dịch vụ khỏi gói thành công.',
                'data' => [
                    'package_id' => $pkg->id,
                    'service_id' => $serviceId,
                ],
            ], 200);
        });
    }
}
