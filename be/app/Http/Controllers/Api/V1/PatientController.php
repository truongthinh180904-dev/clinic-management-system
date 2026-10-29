<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Patient\CheckDuplicatePatientRequest;
use App\Http\Requests\Patient\StorePatientRequest;
use App\Http\Requests\Patient\UpdatePatientRequest;
use App\Http\Requests\Patient\UpdatePatientStatusRequest;
use App\Http\Resources\PatientResource;
use App\Models\AuditLog;
use App\Models\Patient;
use App\Services\PatientCodeGenerator;
use App\Services\PatientDuplicateService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    public function __construct(
        protected PatientCodeGenerator $codeGenerator,
        protected PatientDuplicateService $duplicateService
    ) {}

    /**
     * Display a listing of patients with search, filter, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Patient::query();

        // Eager count relationships when requested to avoid N+1 count queries
        if ($request->boolean('with_counts') || $request->boolean('include_counts')) {
            $query->withCount(['appointments', 'visits', 'invoices', 'patientPackages']);
        }

        // Search by keyword across code, name, phone, email, emergency phone
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('patient_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('full_name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('email', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('emergency_contact_phone', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter by gender
        if ($request->filled('gender')) {
            $query->where('gender', (string) $request->input('gender'));
        }

        // Sorting
        $allowedSorts = [
            'id',
            'patient_code',
            'full_name',
            'phone',
            'date_of_birth',
            'first_visit_date',
            'last_visit_date',
            'status',
            'created_at',
        ];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $patients = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách bệnh nhân thành công.',
            'data' => PatientResource::collection($patients),
            'meta' => [
                'current_page' => $patients->currentPage(),
                'from' => $patients->firstItem(),
                'last_page' => $patients->lastPage(),
                'per_page' => $patients->perPage(),
                'to' => $patients->lastItem(),
                'total' => $patients->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created patient in storage with concurrency-safe patient_code and duplicate checks.
     */
    public function store(StorePatientRequest $request): JsonResponse
    {
        $data = $request->validated();

        // 1. Detect duplicate warnings
        $duplicateWarnings = $this->duplicateService->checkDuplicates($data);

        // 2. Default status
        if (empty($data['status'])) {
            $data['status'] = 'ACTIVE';
        }

        // 3. Concurrency-safe creation with retry on patient_code collision
        $patient = null;
        $maxAttempts = 5;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $candidateData = $data;
                if (empty($candidateData['patient_code'])) {
                    $candidateData['patient_code'] = $this->codeGenerator->generate();
                }

                $patient = DB::transaction(function () use ($candidateData) {
                    return Patient::create($candidateData);
                });

                break;
            } catch (QueryException $e) {
                // Retry if collision happened on auto-generated patient_code
                if ($attempt < $maxAttempts && empty($request->input('patient_code'))) {
                    continue;
                }
                throw $e;
            }
        }

        // 4. Audit Log
        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patients',
            'action' => 'create',
            'table_name' => 'patients',
            'record_id' => (string) $patient->id,
            'old_values' => null,
            'new_values' => $patient->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo hồ sơ bệnh nhân mới thành công.',
            'data' => new PatientResource($patient),
            'duplicate_warnings' => $duplicateWarnings,
        ], 201);
    }

    /**
     * Display the specified patient.
     */
    public function show(string $id): JsonResponse
    {
        $patient = Patient::withCount(['appointments', 'visits', 'invoices', 'patientPackages'])->find($id);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh nhân yêu cầu.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Chi tiết thông tin bệnh nhân.',
            'data' => new PatientResource($patient),
        ], 200);
    }

    /**
     * Display patient clinical chronological timeline.
     */
    public function timeline(Request $request, string $id): JsonResponse
    {
        $patient = Patient::find($id);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh nhân yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $canViewMedical = $request->user()?->hasPermission('medical_records.view') ?? false;

        $visits = $patient->visits()
            ->with([
                'employee',
                'service',
                'appointment',
                'medicalRecord' => function ($q) {
                    $q->with('doctor');
                },
            ])
            ->orderBy('visit_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $timeline = $visits->map(function ($visit) use ($canViewMedical) {
            $doctorInfo = $visit->employee ? [
                'id' => $visit->employee->id,
                'employee_code' => $visit->employee->employee_code,
                'full_name' => $visit->employee->full_name,
                'phone' => $visit->employee->phone,
            ] : null;

            $serviceInfo = $visit->service ? [
                'id' => $visit->service->id,
                'service_code' => $visit->service->service_code,
                'name' => $visit->service->name,
                'price' => (float) $visit->service->price,
            ] : null;

            $appointmentInfo = $visit->appointment ? [
                'id' => $visit->appointment->id,
                'appointment_code' => $visit->appointment->appointment_code,
                'appointment_date' => $visit->appointment->appointment_date?->format('Y-m-d'),
                'status' => $visit->appointment->status,
            ] : null;

            $medicalRecordInfo = ($canViewMedical && $visit->medicalRecord) ? [
                'id' => $visit->medicalRecord->id,
                'visit_id' => $visit->medicalRecord->visit_id,
                'doctor_id' => $visit->medicalRecord->doctor_id,
                'doctor_name' => $visit->medicalRecord->doctor?->full_name,
                'medical_history' => $visit->medicalRecord->medical_history,
                'diagnosis' => $visit->medicalRecord->diagnosis,
                'indication' => $visit->medicalRecord->indication,
                'result' => $visit->medicalRecord->result,
                'treatment' => $visit->medicalRecord->treatment,
                'follow_up_date' => $visit->medicalRecord->follow_up_date?->format('Y-m-d'),
                'created_at' => $visit->medicalRecord->created_at?->toIso8601String(),
                'updated_at' => $visit->medicalRecord->updated_at?->toIso8601String(),
            ] : null;

            return [
                'id' => $visit->id,
                'visit_code' => $visit->visit_code,
                'visit_date' => $visit->visit_date?->toIso8601String(),
                'status' => $visit->status,
                'payment_status' => $visit->payment_status,
                'quantity' => (int) $visit->quantity,
                'unit_price' => (float) $visit->unit_price,
                'discount_amount' => (float) $visit->discount_amount,
                'total_amount' => (float) $visit->total_amount,
                'notes' => $visit->notes,
                'doctor' => $doctorInfo,
                'service' => $serviceInfo,
                'appointment' => $appointmentInfo,
                'medical_record' => $medicalRecordInfo,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Lấy trục thời gian lịch sử khám bệnh nhân thành công.',
            'data' => [
                'patient' => new PatientResource($patient),
                'timeline' => $timeline,
                'total_visits' => $timeline->count(),
            ],
        ], 200);
    }

    /**
     * Update the specified patient in storage.
     */
    public function update(UpdatePatientRequest $request, string $id): JsonResponse
    {
        $patient = Patient::find($id);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh nhân để cập nhật.',
                'errors' => null,
            ], 404);
        }

        $data = $request->validated();

        // Detect duplicate warnings excluding current patient
        $duplicateWarnings = $this->duplicateService->checkDuplicates($data, $patient->id);

        $oldValues = $patient->toArray();
        $patient->update($data);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patients',
            'action' => 'update',
            'table_name' => 'patients',
            'record_id' => (string) $patient->id,
            'old_values' => $oldValues,
            'new_values' => $patient->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật hồ sơ bệnh nhân thành công.',
            'data' => new PatientResource($patient->fresh()),
            'duplicate_warnings' => $duplicateWarnings,
        ], 200);
    }

    /**
     * Update status of patient.
     */
    public function updateStatus(UpdatePatientStatusRequest $request, string $id): JsonResponse
    {
        $patient = Patient::find($id);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh nhân để cập nhật trạng thái.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $patient->toArray();
        $patient->status = (string) $request->input('status');

        if ($request->filled('notes')) {
            $prefix = $patient->notes ? $patient->notes."\n" : '';
            $patient->notes = $prefix.'['.now()->format('Y-m-d H:i').'] Đổi trạng thái: '.$request->input('notes');
        }

        $patient->save();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patients',
            'action' => 'update_status',
            'table_name' => 'patients',
            'record_id' => (string) $patient->id,
            'old_values' => $oldValues,
            'new_values' => $patient->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái bệnh nhân thành công.',
            'data' => new PatientResource($patient->fresh()),
        ], 200);
    }

    /**
     * Remove the specified patient from storage.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $patient = Patient::find($id);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh nhân để xóa.',
                'errors' => null,
            ], 404);
        }

        // Prevent deletion if patient has clinical, appointment, package, or financial history
        $hasAppointments = $patient->appointments()->exists();
        $hasVisits = $patient->visits()->exists();
        $hasInvoices = $patient->invoices()->exists();
        $hasPackages = $patient->patientPackages()->exists();

        if ($hasAppointments || $hasVisits || $hasInvoices || $hasPackages) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa bệnh nhân đã có dữ liệu lịch hẹn, lượt khám, gói khám hoặc hóa đơn liên quan.',
                'errors' => [
                    'appointments_count' => $patient->appointments()->count(),
                    'visits_count' => $patient->visits()->count(),
                    'invoices_count' => $patient->invoices()->count(),
                    'patient_packages_count' => $patient->patientPackages()->count(),
                ],
            ], 400);
        }

        $oldValues = $patient->toArray();
        $patient->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patients',
            'action' => 'delete',
            'table_name' => 'patients',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa hồ sơ bệnh nhân thành công.',
            'data' => null,
        ], 200);
    }

    /**
     * Pre-check duplicate patient records for frontend form warnings.
     */
    public function checkDuplicates(CheckDuplicatePatientRequest $request): JsonResponse
    {
        $data = $request->validated();
        $excludeId = $request->filled('exclude_patient_id') ? (int) $request->input('exclude_patient_id') : null;

        $duplicateWarnings = $this->duplicateService->checkDuplicates($data, $excludeId);

        return response()->json([
            'success' => true,
            'message' => 'Kiểm tra trùng hồ sơ bệnh nhân hoàn tất.',
            'data' => [
                'has_duplicates' => ! empty($duplicateWarnings),
                'duplicate_warnings' => $duplicateWarnings,
            ],
        ], 200);
    }
}
