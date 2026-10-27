<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Appointment\StoreAppointmentRequest;
use App\Http\Requests\Appointment\UpdateAppointmentRequest;
use App\Http\Requests\Appointment\UpdateAppointmentStatusRequest;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Services\AppointmentOverlapException;
use App\Services\AppointmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class AppointmentController extends Controller
{
    public function __construct(
        protected AppointmentService $appointmentService
    ) {}

    /**
     * Display a listing of appointments with search, filters, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Appointment::query()
            ->with(['patient', 'employee', 'service', 'creator'])
            ->withCount('visits');

        // Search by keyword across appointment_code, patient full_name, phone, employee full_name
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('appointment_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhereHas('patient', function ($pq) use ($searchTerm) {
                        $pq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%");
                    })
                    ->orWhereHas('employee', function ($eq) use ($searchTerm) {
                        $eq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('employee_code', 'LIKE', "%{$searchTerm}%");
                    });
            });
        }

        // Filter by exact appointment date
        if ($request->filled('appointment_date')) {
            $query->whereDate('appointment_date', (string) $request->input('appointment_date'));
        }

        // Filter by date range
        if ($request->filled('from_date')) {
            $query->whereDate('appointment_date', '>=', (string) $request->input('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('appointment_date', '<=', (string) $request->input('to_date'));
        }

        // Filter by employee
        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->input('employee_id'));
        }

        // Filter by patient
        if ($request->filled('patient_id')) {
            $query->where('patient_id', (int) $request->input('patient_id'));
        }

        // Filter by service
        if ($request->filled('service_id')) {
            $query->where('service_id', (int) $request->input('service_id'));
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Sorting
        $allowedSorts = [
            'id',
            'appointment_code',
            'appointment_date',
            'start_time',
            'end_time',
            'status',
            'created_at',
            'updated_at',
        ];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'appointment_date';

        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc'
            ? 'asc'
            : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $appointments = $query
            ->orderBy($sortBy, $sortDirection)
            ->orderBy('start_time', 'asc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách lịch hẹn thành công.',
            'data' => AppointmentResource::collection($appointments),
            'meta' => [
                'current_page' => $appointments->currentPage(),
                'from' => $appointments->firstItem(),
                'last_page' => $appointments->lastPage(),
                'per_page' => $appointments->perPage(),
                'to' => $appointments->lastItem(),
                'total' => $appointments->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created appointment with overlap prevention.
     */
    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        try {
            $appointment = $this->appointmentService->createAppointment(
                $request->validated(),
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Đặt lịch hẹn khám thành công.',
                'data' => new AppointmentResource($appointment->load(['patient', 'employee', 'service', 'creator'])),
            ], 201);
        } catch (AppointmentOverlapException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'time_slot' => [$e->getMessage()],
                ],
            ], 409);
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
     * Display the specified appointment.
     */
    public function show(string $id): JsonResponse
    {
        $appointment = Appointment::with(['patient', 'employee', 'service', 'creator'])
            ->withCount('visits')
            ->find($id);

        if (! $appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lịch hẹn.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin chi tiết lịch hẹn thành công.',
            'data' => new AppointmentResource($appointment),
        ], 200);
    }

    /**
     * Update the specified appointment.
     */
    public function update(UpdateAppointmentRequest $request, string $id): JsonResponse
    {
        $appointment = Appointment::find($id);

        if (! $appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lịch hẹn.',
            ], 404);
        }

        try {
            $updated = $this->appointmentService->updateAppointment(
                $appointment,
                $request->validated(),
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật lịch hẹn khám thành công.',
                'data' => new AppointmentResource($updated->load(['patient', 'employee', 'service', 'creator'])),
            ], 200);
        } catch (AppointmentOverlapException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'time_slot' => [$e->getMessage()],
                ],
            ], 409);
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
     * Update the status of the specified appointment.
     */
    public function updateStatus(UpdateAppointmentStatusRequest $request, string $id): JsonResponse
    {
        $appointment = Appointment::find($id);

        if (! $appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lịch hẹn.',
            ], 404);
        }

        $newStatus = (string) $request->input('status');
        $notes = $request->input('notes');

        try {
            if ($newStatus === 'CANCELLED') {
                $updated = $this->appointmentService->cancelAppointment(
                    $appointment,
                    $notes,
                    $request->user(),
                    $request->ip(),
                    $request->userAgent()
                );
            } else {
                $payload = ['status' => $newStatus];
                if ($notes !== null) {
                    $payload['notes'] = $notes;
                }
                $updated = $this->appointmentService->updateAppointment(
                    $appointment,
                    $payload,
                    $request->user(),
                    $request->ip(),
                    $request->userAgent()
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật trạng thái lịch hẹn thành công.',
                'data' => new AppointmentResource($updated->load(['patient', 'employee', 'service', 'creator'])),
            ], 200);
        } catch (AppointmentOverlapException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => [
                    'time_slot' => [$e->getMessage()],
                ],
            ], 409);
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
     * Cancel an appointment.
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $appointment = Appointment::find($id);

        if (! $appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lịch hẹn.',
            ], 404);
        }

        $reason = $request->input('reason') ?? $request->input('notes');

        $cancelled = $this->appointmentService->cancelAppointment(
            $appointment,
            $reason,
            $request->user(),
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Hủy lịch hẹn thành công.',
            'data' => new AppointmentResource($cancelled->load(['patient', 'employee', 'service', 'creator'])),
        ], 200);
    }

    /**
     * Remove the specified appointment.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $appointment = Appointment::find($id);

        if (! $appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lịch hẹn.',
            ], 404);
        }

        try {
            $this->appointmentService->deleteAppointment(
                $appointment,
                $request->user(),
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Xóa lịch hẹn thành công.',
            ], 200);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}
