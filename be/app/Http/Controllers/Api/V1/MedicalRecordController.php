<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MedicalRecord\StoreMedicalRecordRequest;
use App\Http\Requests\MedicalRecord\UpdateMedicalRecordRequest;
use App\Http\Resources\MedicalRecordResource;
use App\Models\AuditLog;
use App\Models\MedicalRecord;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedicalRecordController extends Controller
{
    /**
     * Display the medical record for a specific visit.
     */
    public function show(Request $request, string $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        $medicalRecord = MedicalRecord::with(['doctor', 'visit.patient'])
            ->where('visit_id', $visit->id)
            ->first();

        if (! $medicalRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Lượt khám này chưa có hồ sơ bệnh án.',
            ], 404);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'medical_records',
            'action' => 'view',
            'table_name' => 'medical_records',
            'record_id' => (string) $medicalRecord->id,
            'old_values' => null,
            'new_values' => [
                'visit_id' => $visit->id,
                'patient_id' => $visit->patient_id,
                'doctor_id' => $medicalRecord->doctor_id,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin hồ sơ bệnh án thành công.',
            'data' => new MedicalRecordResource($medicalRecord),
        ], 200);
    }

    /**
     * Store a newly created medical record for a specific visit.
     */
    public function store(StoreMedicalRecordRequest $request, string $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        if ($visit->medicalRecord()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Lượt khám này đã có hồ sơ bệnh án.',
                'errors' => [
                    'visit_id' => ['Lượt khám này đã có hồ sơ bệnh án.'],
                ],
            ], 409);
        }

        if ($visit->status === Visit::STATUS_CANCELLED) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể tạo hồ sơ bệnh án cho lượt khám đã hủy.',
                'errors' => [
                    'visit' => ['Không thể tạo hồ sơ bệnh án cho lượt khám đã hủy.'],
                ],
            ], 422);
        }

        $data = $request->validated();
        $doctorId = $data['doctor_id'] ?? $visit->employee_id ?? $request->user()?->employee_id;

        $medicalRecord = DB::transaction(function () use ($visit, $data, $doctorId, $request) {
            $record = MedicalRecord::create([
                'visit_id' => $visit->id,
                'doctor_id' => $doctorId,
                'medical_history' => $data['medical_history'] ?? null,
                'diagnosis' => $data['diagnosis'],
                'indication' => $data['indication'] ?? null,
                'result' => $data['result'] ?? null,
                'treatment' => $data['treatment'] ?? null,
                'follow_up_date' => $data['follow_up_date'] ?? null,
            ]);

            // Sync visit status to COMPLETED upon creating the medical record
            if ($visit->status !== Visit::STATUS_COMPLETED) {
                $visit->update(['status' => Visit::STATUS_COMPLETED]);
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'medical_records',
                'action' => 'create',
                'table_name' => 'medical_records',
                'record_id' => (string) $record->id,
                'old_values' => null,
                'new_values' => array_merge($record->toArray(), [
                    'edit_reason' => $request->input('edit_reason') ?? $request->input('reason') ?? 'Khởi tạo hồ sơ bệnh án ban đầu',
                ]),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            return $record;
        });

        return response()->json([
            'success' => true,
            'message' => 'Tạo hồ sơ bệnh án thành công.',
            'data' => new MedicalRecordResource($medicalRecord->load(['doctor', 'visit.patient'])),
        ], 201);
    }

    /**
     * Update the medical record for a specific visit.
     */
    public function update(UpdateMedicalRecordRequest $request, string $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        $medicalRecord = MedicalRecord::where('visit_id', $visit->id)->first();

        if (! $medicalRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Lượt khám này chưa có hồ sơ bệnh án để cập nhật.',
            ], 404);
        }

        $data = $request->validated();
        $oldValues = $medicalRecord->toArray();
        $editReason = $request->input('edit_reason')
            ?? $request->input('reason')
            ?? ($visit->status === Visit::STATUS_COMPLETED ? 'Cập nhật bổ sung bệnh án sau khi hoàn tất lượt khám' : 'Cập nhật hồ sơ bệnh án');

        $recordData = collect($data)
            ->except(['edit_reason', 'reason'])
            ->toArray();

        DB::transaction(function () use ($medicalRecord, $recordData, $oldValues, $editReason, $request) {
            $medicalRecord->update($recordData);

            $newValues = $medicalRecord->fresh()->toArray();
            $newValues['edit_reason'] = $editReason;

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'medical_records',
                'action' => 'update',
                'table_name' => 'medical_records',
                'record_id' => (string) $medicalRecord->id,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật hồ sơ bệnh án thành công.',
            'data' => new MedicalRecordResource($medicalRecord->fresh()->load(['doctor', 'visit'])),
        ], 200);
    }

    /**
     * Display the audit trail history for a visit's medical record.
     */
    public function history(Request $request, string $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        $medicalRecord = MedicalRecord::where('visit_id', $visit->id)->first();

        if (! $medicalRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Lượt khám này chưa có hồ sơ bệnh án.',
            ], 404);
        }

        return $this->formatAuditTrailResponse($medicalRecord);
    }

    /**
     * Display a specific medical record by ID.
     */
    public function showRecord(Request $request, string $id): JsonResponse
    {
        $medicalRecord = MedicalRecord::with(['doctor', 'visit.patient'])->find($id);

        if (! $medicalRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh án.',
            ], 404);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'medical_records',
            'action' => 'view',
            'table_name' => 'medical_records',
            'record_id' => (string) $medicalRecord->id,
            'old_values' => null,
            'new_values' => [
                'visit_id' => $medicalRecord->visit_id,
                'patient_id' => $medicalRecord->visit?->patient_id,
                'doctor_id' => $medicalRecord->doctor_id,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin hồ sơ bệnh án thành công.',
            'data' => new MedicalRecordResource($medicalRecord),
        ], 200);
    }

    /**
     * Update a specific medical record by ID.
     */
    public function updateRecord(UpdateMedicalRecordRequest $request, string $id): JsonResponse
    {
        $medicalRecord = MedicalRecord::find($id);

        if (! $medicalRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh án để cập nhật.',
            ], 404);
        }

        $data = $request->validated();
        $oldValues = $medicalRecord->toArray();
        $editReason = $request->input('edit_reason')
            ?? $request->input('reason')
            ?? 'Cập nhật hồ sơ bệnh án';

        $recordData = collect($data)
            ->except(['edit_reason', 'reason'])
            ->toArray();

        DB::transaction(function () use ($medicalRecord, $recordData, $oldValues, $editReason, $request) {
            $medicalRecord->update($recordData);

            $newValues = $medicalRecord->fresh()->toArray();
            $newValues['edit_reason'] = $editReason;

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'medical_records',
                'action' => 'update',
                'table_name' => 'medical_records',
                'record_id' => (string) $medicalRecord->id,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật hồ sơ bệnh án thành công.',
            'data' => new MedicalRecordResource($medicalRecord->fresh()->load(['doctor', 'visit'])),
        ], 200);
    }

    /**
     * Display the audit trail history for a specific medical record by ID.
     */
    public function recordHistory(Request $request, string $id): JsonResponse
    {
        $medicalRecord = MedicalRecord::find($id);

        if (! $medicalRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh án.',
            ], 404);
        }

        return $this->formatAuditTrailResponse($medicalRecord);
    }

    /**
     * Format and return audit trail history response.
     */
    protected function formatAuditTrailResponse(MedicalRecord $medicalRecord): JsonResponse
    {
        $logs = AuditLog::with(['user.employee', 'user.roles'])
            ->where(function ($query) use ($medicalRecord) {
                $query->where('record_id', (string) $medicalRecord->id)
                    ->where(function ($q) {
                        $q->where('module', 'medical_records')
                            ->orWhere('table_name', 'medical_records');
                    });
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $data = $logs->map(function (AuditLog $log) {
            $user = $log->user;
            $userName = $user?->employee?->full_name ?? $user?->username ?? 'Hệ thống';
            $roleName = $user?->roles?->first()?->name ?? 'STAFF';
            $reason = $log->new_values['edit_reason'] ?? $log->new_values['reason'] ?? null;

            return [
                'id' => $log->id,
                'action' => $log->action,
                'action_label' => $log->action === 'create' ? 'Khởi tạo bệnh án' : 'Chỉnh sửa bệnh án',
                'user_id' => $log->user_id,
                'user_name' => $userName,
                'user_role' => $roleName,
                'edit_reason' => $reason,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'created_at' => $log->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Lấy lịch sử chỉnh sửa bệnh án thành công.',
            'data' => $data,
        ], 200);
    }
}
