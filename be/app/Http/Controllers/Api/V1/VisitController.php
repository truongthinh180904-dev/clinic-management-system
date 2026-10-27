<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Visit\StoreVisitRequest;
use App\Http\Requests\Visit\UpdateVisitRequest;
use App\Http\Requests\Visit\UpdateVisitStatusRequest;
use App\Http\Resources\VisitResource;
use App\Models\Visit;
use App\Services\VisitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class VisitController extends Controller
{
    public function __construct(
        protected VisitService $visitService
    ) {}

    /**
     * Display a listing of visits with search, filters, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Visit::query()
            ->with(['patient', 'employee', 'service', 'patientPackage.package', 'appointment', 'creator']);

        // Search by keyword across visit_code, patient full_name, phone, patient_code, employee full_name, service name
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('visit_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhereHas('patient', function ($pq) use ($searchTerm) {
                        $pq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%");
                    })
                    ->orWhereHas('employee', function ($eq) use ($searchTerm) {
                        $eq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('employee_code', 'LIKE', "%{$searchTerm}%");
                    })
                    ->orWhereHas('service', function ($sq) use ($searchTerm) {
                        $sq->where('name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('service_code', 'LIKE', "%{$searchTerm}%");
                    });
            });
        }

        // Filter by exact visit date
        if ($request->filled('visit_date')) {
            $query->whereDate('visit_date', (string) $request->input('visit_date'));
        }

        // Filter by date range
        if ($request->filled('from_date')) {
            $query->whereDate('visit_date', '>=', (string) $request->input('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('visit_date', '<=', (string) $request->input('to_date'));
        }

        // Filter by patient
        if ($request->filled('patient_id')) {
            $query->where('patient_id', (int) $request->input('patient_id'));
        }

        // Filter by employee
        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->input('employee_id'));
        }

        // Filter by service
        if ($request->filled('service_id')) {
            $query->where('service_id', (int) $request->input('service_id'));
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter by payment status
        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->input('payment_status'));
        }

        // Sorting
        $allowedSorts = [
            'id',
            'visit_code',
            'visit_date',
            'total_amount',
            'status',
            'payment_status',
            'created_at',
            'updated_at',
        ];

        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'visit_date';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $visits = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách lượt khám thành công.',
            'data' => VisitResource::collection($visits),
            'meta' => [
                'current_page' => $visits->currentPage(),
                'from' => $visits->firstItem(),
                'last_page' => $visits->lastPage(),
                'per_page' => $visits->perPage(),
                'to' => $visits->lastItem(),
                'total' => $visits->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created visit in storage.
     */
    public function store(StoreVisitRequest $request): JsonResponse
    {
        try {
            $visit = $this->visitService->createVisit(
                $request->validated(),
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Tạo lượt khám mới thành công.',
                'data' => new VisitResource($visit->load(['patient', 'employee', 'service', 'patientPackage.package', 'appointment', 'creator'])),
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'error' => [$e->getMessage()],
                ],
            ], 422);
        }
    }

    /**
     * Display the specified visit.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $relations = [
            'patient',
            'employee',
            'service',
            'patientPackage.package',
            'appointment',
            'creator',
            'invoices',
        ];

        if ($request->user()?->hasPermission('medical_records.view')) {
            $relations[] = 'medicalRecord.doctor';
        }

        $visit = Visit::with($relations)->find($id);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin chi tiết lượt khám thành công.',
            'data' => new VisitResource($visit),
        ], 200);
    }

    /**
     * Update the specified visit in storage.
     */
    public function update(UpdateVisitRequest $request, string $id): JsonResponse
    {
        $visit = Visit::find($id);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        try {
            $updated = $this->visitService->updateVisit(
                $visit,
                $request->validated(),
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật thông tin lượt khám thành công.',
                'data' => new VisitResource($updated->load(['patient', 'employee', 'service', 'patientPackage.package', 'appointment', 'creator'])),
            ], 200);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'error' => [$e->getMessage()],
                ],
            ], 422);
        }
    }

    /**
     * Update the status of the specified visit.
     */
    public function updateStatus(UpdateVisitStatusRequest $request, string $id): JsonResponse
    {
        $visit = Visit::find($id);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        $newStatus = (string) $request->input('status');
        $notes = $request->input('notes');

        try {
            if ($newStatus === 'CANCELLED') {
                $updated = $this->visitService->cancelVisit(
                    $visit,
                    $notes,
                    $request->user(),
                    $request->ip(),
                    $request->userAgent()
                );
            } else {
                $updated = $this->visitService->updateStatus(
                    $visit,
                    $newStatus,
                    $notes,
                    $request->user(),
                    $request->ip(),
                    $request->userAgent()
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật trạng thái lượt khám thành công.',
                'data' => new VisitResource($updated->load(['patient', 'employee', 'service', 'patientPackage.package', 'appointment', 'creator'])),
            ], 200);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'error' => [$e->getMessage()],
                ],
            ], 422);
        }
    }

    /**
     * Cancel the specified visit.
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $visit = Visit::find($id);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        $reason = $request->input('reason') ?? $request->input('notes');

        try {
            $cancelled = $this->visitService->cancelVisit(
                $visit,
                $reason,
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Hủy lượt khám thành công.',
                'data' => new VisitResource($cancelled->load(['patient', 'employee', 'service', 'patientPackage.package', 'appointment', 'creator'])),
            ], 200);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'error' => [$e->getMessage()],
                ],
            ], 422);
        }
    }

    /**
     * Remove the specified visit from storage.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $visit = Visit::find($id);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        try {
            $this->visitService->deleteVisit(
                $visit,
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Xóa lượt khám thành công.',
            ], 200);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
