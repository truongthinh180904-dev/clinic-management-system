<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\KpiTarget\StoreKpiTargetRequest;
use App\Http\Requests\KpiTarget\UpdateKpiTargetRequest;
use App\Http\Resources\KpiTargetResource;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\KpiTarget;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class KpiTargetController extends Controller
{
    /**
     * Display a listing of KPI targets with filters, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = KpiTarget::query()->with(['employee', 'creator']);

        // Filter by employee_id or route parameter {employee}
        $employeeParam = $request->input('employee_id') ?? $request->route('employee');
        if (! empty($employeeParam)) {
            $empId = $employeeParam instanceof Employee ? $employeeParam->id : (int) $employeeParam;
            $query->where('employee_id', $empId);
        }

        // Filter by period start range
        $startDate = $request->input('start_date') ?? $request->input('period_start') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('period_start', '>=', (string) $startDate);
        }

        // Filter by period end range
        $endDate = $request->input('end_date') ?? $request->input('period_end') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('period_end', '<=', (string) $endDate);
        }

        // Search by employee code or full name
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->whereHas('employee', function ($eq) use ($searchTerm) {
                $eq->where('full_name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('employee_code', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Sorting
        $allowedSorts = [
            'id',
            'period_start',
            'period_end',
            'target_revenue',
            'target_visits',
            'created_at',
            'updated_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'period_start';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $query->orderBy($sortBy, $sortDirection);

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        // Handle dynamic evaluation_status filter
        if ($request->filled('status') || $request->filled('evaluation_status')) {
            $filterStatus = strtoupper((string) ($request->input('status') ?? $request->input('evaluation_status')));
            $all = $query->get()->filter(function ($target) use ($filterStatus) {
                return $target->calculatePerformance()['evaluation_status'] === $filterStatus;
            })->values();

            $page = max(1, (int) $request->input('page', 1));
            $slice = $all->slice(($page - 1) * $perPage, $perPage)->values();
            $targets = new LengthAwarePaginator(
                $slice,
                $all->count(),
                $perPage,
                $page,
                ['path' => $request->url(), 'query' => $request->query()]
            );
        } else {
            $targets = $query->paginate($perPage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách chỉ tiêu KPI thành công.',
            'data' => KpiTargetResource::collection($targets),
            'meta' => [
                'current_page' => $targets->currentPage(),
                'from' => $targets->firstItem(),
                'last_page' => $targets->lastPage(),
                'per_page' => $targets->perPage(),
                'to' => $targets->lastItem(),
                'total' => $targets->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created KPI target in storage.
     */
    public function store(StoreKpiTargetRequest $request): JsonResponse
    {
        $data = $request->validated();

        $employeeId = (int) $data['employee_id'];
        $periodStart = Carbon::parse($data['period_start'])->toDateString();
        $periodEnd = Carbon::parse($data['period_end'])->toDateString();

        // Check overlapping period for the same employee
        $overlapping = KpiTarget::where('employee_id', $employeeId)
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->where('period_start', '<=', $periodEnd)
                    ->where('period_end', '>=', $periodStart);
            })
            ->exists();

        if ($overlapping) {
            return response()->json([
                'success' => false,
                'message' => 'Nhân viên đã có chỉ tiêu KPI trong khoảng thời gian này (trùng kỳ hạn chồng lấn).',
                'errors' => [
                    'period_start' => ['Kỳ hạn KPI bị chồng lấn với chỉ tiêu đã có của nhân viên này.'],
                ],
            ], 422);
        }

        $target = DB::transaction(function () use ($data, $periodStart, $periodEnd, $request) {
            $kpiTarget = KpiTarget::create([
                'employee_id' => $data['employee_id'],
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'target_revenue' => $data['target_revenue'],
                'target_visits' => $data['target_visits'],
                'created_by' => $request->user()?->id,
            ]);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'kpi_targets',
                'action' => 'create',
                'table_name' => 'kpi_targets',
                'record_id' => (string) $kpiTarget->id,
                'old_values' => null,
                'new_values' => $kpiTarget->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $kpiTarget;
        });

        $loaded = $target->load(['employee', 'creator']);

        return response()->json([
            'success' => true,
            'message' => 'Giao chỉ tiêu KPI mới cho nhân viên thành công.',
            'data' => new KpiTargetResource($loaded),
        ], 201);
    }

    /**
     * Display the specified KPI target.
     */
    public function show(Request $request, string|int $id): JsonResponse
    {
        $target = KpiTarget::with(['employee', 'creator'])->find($id);

        if (! $target) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy chỉ tiêu KPI.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin chi tiết chỉ tiêu KPI thành công.',
            'data' => new KpiTargetResource($target),
        ], 200);
    }

    /**
     * Update the specified KPI target in storage.
     */
    public function update(UpdateKpiTargetRequest $request, string|int $id): JsonResponse
    {
        $target = KpiTarget::find($id);

        if (! $target) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy chỉ tiêu KPI để cập nhật.',
                'errors' => null,
            ], 404);
        }

        $data = $request->validated();
        $employeeId = isset($data['employee_id']) ? (int) $data['employee_id'] : (int) $target->employee_id;
        $periodStart = isset($data['period_start'])
            ? Carbon::parse($data['period_start'])->toDateString()
            : ($target->period_start ? Carbon::parse($target->period_start)->toDateString() : null);
        $periodEnd = isset($data['period_end'])
            ? Carbon::parse($data['period_end'])->toDateString()
            : ($target->period_end ? Carbon::parse($target->period_end)->toDateString() : null);

        // Check overlapping period for the same employee, excluding current record
        $overlapping = KpiTarget::where('employee_id', $employeeId)
            ->where('id', '!=', $target->id)
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->where('period_start', '<=', $periodEnd)
                    ->where('period_end', '>=', $periodStart);
            })
            ->exists();

        if ($overlapping) {
            return response()->json([
                'success' => false,
                'message' => 'Nhân viên đã có chỉ tiêu KPI trong khoảng thời gian này (trùng kỳ hạn chồng lấn).',
                'errors' => [
                    'period_start' => ['Kỳ hạn KPI bị chồng lấn với chỉ tiêu đã có của nhân viên này.'],
                ],
            ], 422);
        }

        $updatedTarget = DB::transaction(function () use ($target, $data, $request) {
            $oldValues = $target->toArray();
            $target->update($data);

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'kpi_targets',
                'action' => 'update',
                'table_name' => 'kpi_targets',
                'record_id' => (string) $target->id,
                'old_values' => $oldValues,
                'new_values' => $target->toArray(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $target;
        });

        $loaded = $updatedTarget->load(['employee', 'creator']);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật chỉ tiêu KPI thành công.',
            'data' => new KpiTargetResource($loaded),
        ], 200);
    }

    /**
     * Remove the specified KPI target from storage.
     */
    public function destroy(Request $request, string|int $id): JsonResponse
    {
        $target = KpiTarget::find($id);

        if (! $target) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy chỉ tiêu KPI để xóa.',
                'errors' => null,
            ], 404);
        }

        DB::transaction(function () use ($target, $id, $request) {
            $oldValues = $target->toArray();
            $target->delete();

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'kpi_targets',
                'action' => 'delete',
                'table_name' => 'kpi_targets',
                'record_id' => (string) $id,
                'old_values' => $oldValues,
                'new_values' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Xóa chỉ tiêu KPI thành công.',
        ], 200);
    }

    /**
     * Get aggregated KPI summary statistics.
     */
    public function summary(Request $request): JsonResponse
    {
        $query = KpiTarget::query();

        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->input('employee_id'));
        }

        $startDate = $request->input('start_date') ?? $request->input('period_start');
        if ($startDate) {
            $query->whereDate('period_start', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('period_end');
        if ($endDate) {
            $query->whereDate('period_end', '<=', (string) $endDate);
        }

        $targets = $query->get();

        $totalTargets = $targets->count();
        $totalEmployees = $targets->pluck('employee_id')->unique()->count();

        $exceededCount = 0;
        $onTrackCount = 0;
        $behindCount = 0;

        $totalTargetRevenue = 0.0;
        $totalActualRevenue = 0.0;
        $totalTargetVisits = 0;
        $totalActualVisits = 0;
        $sumRate = 0.0;

        foreach ($targets as $target) {
            $perf = $target->calculatePerformance();

            $totalTargetRevenue += (float) $target->target_revenue;
            $totalActualRevenue += (float) $perf['actual_revenue'];
            $totalTargetVisits += (int) $target->target_visits;
            $totalActualVisits += (int) $perf['actual_visits'];
            $sumRate += (float) $perf['completion_rate'];

            if ($perf['evaluation_status'] === 'EXCEEDED') {
                $exceededCount++;
            } elseif ($perf['evaluation_status'] === 'ON_TRACK') {
                $onTrackCount++;
            } else {
                $behindCount++;
            }
        }

        $avgCompletionRate = $totalTargets > 0 ? round($sumRate / $totalTargets, 2) : 0.0;

        return response()->json([
            'success' => true,
            'message' => 'Lấy thống kê tổng quan KPI thành công.',
            'data' => [
                'total_targets' => $totalTargets,
                'total_employees_assigned' => $totalEmployees,
                'exceeded_count' => $exceededCount,
                'on_track_count' => $onTrackCount,
                'behind_count' => $behindCount,
                'total_target_revenue' => round($totalTargetRevenue, 2),
                'total_actual_revenue' => round($totalActualRevenue, 2),
                'total_target_visits' => $totalTargetVisits,
                'total_actual_visits' => $totalActualVisits,
                'average_completion_rate' => $avgCompletionRate,
            ],
        ], 200);
    }
}
