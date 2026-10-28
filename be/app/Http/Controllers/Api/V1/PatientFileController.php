<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PatientFile\UploadPatientFileRequest;
use App\Http\Resources\PatientFileResource;
use App\Models\AuditLog;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PatientFileController extends Controller
{
    /**
     * Allowed MIME types for patient clinical files.
     */
    protected const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/tiff',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/dicom',
        'application/octet-stream',
    ];

    /**
     * Maximum file size in bytes (10MB).
     */
    protected const MAX_FILE_SIZE_BYTES = 10485760;

    /**
     * Display a listing of files for a specific patient.
     */
    public function indexByPatient(Request $request, string $patientId): JsonResponse
    {
        $patient = Patient::find($patientId);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin bệnh nhân.',
            ], 404);
        }

        $query = PatientFile::with(['uploader', 'visit'])
            ->where('patient_id', $patient->id);

        if ($request->filled('visit_id')) {
            $query->where('visit_id', $request->input('visit_id'));
        }

        if ($request->filled('search')) {
            $query->where('file_name', 'like', '%'.$request->input('search').'%');
        }

        $files = $query->latest('id')->get();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách tệp đính kèm thành công.',
            'data' => PatientFileResource::collection($files),
        ], 200);
    }

    /**
     * Display a listing of files for a specific visit.
     */
    public function indexByVisit(Request $request, string $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        $files = PatientFile::with(['uploader', 'patient'])
            ->where('visit_id', $visit->id)
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách tệp đính kèm lượt khám thành công.',
            'data' => PatientFileResource::collection($files),
        ], 200);
    }

    /**
     * Upload and store a clinical file for a patient.
     */
    public function uploadForPatient(UploadPatientFileRequest $request, string $patientId): JsonResponse
    {
        $patient = Patient::find($patientId);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin bệnh nhân.',
            ], 404);
        }

        $visitId = null;
        if ($request->filled('visit_id')) {
            $visit = Visit::where('id', $request->input('visit_id'))
                ->where('patient_id', $patient->id)
                ->first();

            if (! $visit) {
                return response()->json([
                    'success' => false,
                    'message' => 'Lượt khám không thuộc về bệnh nhân này.',
                    'errors' => [
                        'visit_id' => ['Lượt khám không thuộc về bệnh nhân này.'],
                    ],
                ], 422);
            }

            if ($visit->status === Visit::STATUS_CANCELLED) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể tải lên tệp đính kèm cho lượt khám đã hủy.',
                    'errors' => [
                        'visit' => ['Không thể tải lên tệp đính kèm cho lượt khám đã hủy.'],
                    ],
                ], 422);
            }

            $visitId = $visit->id;
        }

        $file = $request->file('file');
        $validationError = $this->validateUploadedFileSecurity($file);
        if ($validationError) {
            return response()->json([
                'success' => false,
                'message' => $validationError,
                'errors' => ['file' => [$validationError]],
            ], 422);
        }

        $patientFile = $this->storePatientFile($file, $patient->id, $visitId, $request);

        return response()->json([
            'success' => true,
            'message' => 'Tải lên tài liệu y tế thành công.',
            'data' => new PatientFileResource($patientFile->load(['patient', 'visit', 'uploader'])),
        ], 201);
    }

    /**
     * Upload and store a clinical file for a visit.
     */
    public function uploadForVisit(UploadPatientFileRequest $request, string $visitId): JsonResponse
    {
        $visit = Visit::with('patient')->find($visitId);

        if (! $visit) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin lượt khám.',
            ], 404);
        }

        if ($visit->status === Visit::STATUS_CANCELLED) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể tải lên tệp đính kèm cho lượt khám đã hủy.',
                'errors' => [
                    'visit' => ['Không thể tải lên tệp đính kèm cho lượt khám đã hủy.'],
                ],
            ], 422);
        }

        $file = $request->file('file');
        $validationError = $this->validateUploadedFileSecurity($file);
        if ($validationError) {
            return response()->json([
                'success' => false,
                'message' => $validationError,
                'errors' => ['file' => [$validationError]],
            ], 422);
        }

        $patientFile = $this->storePatientFile($file, $visit->patient_id, $visit->id, $request);

        return response()->json([
            'success' => true,
            'message' => 'Tải lên tài liệu y tế thành công.',
            'data' => new PatientFileResource($patientFile->load(['patient', 'visit', 'uploader'])),
        ], 201);
    }

    /**
     * Display a specific patient file record.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $file = PatientFile::with(['patient', 'visit', 'uploader'])->find($id);

        if (! $file) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ], 404);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patient_files',
            'action' => 'view',
            'table_name' => 'patient_files',
            'record_id' => (string) $file->id,
            'old_values' => null,
            'new_values' => [
                'file_name' => $file->file_name,
                'patient_id' => $file->patient_id,
                'mime_type' => $file->mime_type,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin tệp đính kèm thành công.',
            'data' => new PatientFileResource($file),
        ], 200);
    }

    /**
     * Preview a clinical file directly in the browser (inline).
     */
    public function preview(Request $request, string $id): StreamedResponse|BinaryFileResponse|JsonResponse
    {
        $file = PatientFile::find($id);

        if (! $file) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ], 404);
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($file->storage_path)) {
            return response()->json([
                'success' => false,
                'message' => 'Tệp tin không tồn tại trên hệ thống lưu trữ.',
            ], 404);
        }

        $stream = $disk->readStream($file->storage_path);
        if (! $stream) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể đọc tệp tin từ hệ thống lưu trữ.',
            ], 500);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patient_files',
            'action' => 'preview',
            'table_name' => 'patient_files',
            'record_id' => (string) $file->id,
            'old_values' => null,
            'new_values' => [
                'file_name' => $file->file_name,
                'patient_id' => $file->patient_id,
                'mime_type' => $file->mime_type,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->stream(function () use ($stream) {
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $file->mime_type,
            'Content-Disposition' => 'inline; filename="'.addslashes($file->file_name).'"',
            'Content-Length' => $file->file_size,
        ]);
    }

    /**
     * Download a clinical file as an attachment.
     */
    public function download(Request $request, string $id): StreamedResponse|BinaryFileResponse|JsonResponse
    {
        $file = PatientFile::find($id);

        if (! $file) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ], 404);
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($file->storage_path)) {
            return response()->json([
                'success' => false,
                'message' => 'Tệp tin không tồn tại trên hệ thống lưu trữ.',
            ], 404);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patient_files',
            'action' => 'download',
            'table_name' => 'patient_files',
            'record_id' => (string) $file->id,
            'old_values' => null,
            'new_values' => [
                'file_name' => $file->file_name,
                'patient_id' => $file->patient_id,
                'mime_type' => $file->mime_type,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return $disk->download($file->storage_path, $file->file_name, [
            'Content-Type' => $file->mime_type,
        ]);
    }

    /**
     * Delete a patient clinical file.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $file = PatientFile::find($id);

        if (! $file) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ], 404);
        }

        $oldValues = $file->toArray();

        DB::transaction(function () use ($file, $oldValues, $request) {
            $storagePath = $file->storage_path;

            // Audit log
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'module' => 'patient_files',
                'action' => 'delete',
                'table_name' => 'patient_files',
                'record_id' => (string) $file->id,
                'old_values' => $oldValues,
                'new_values' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);

            $file->delete();

            // Delete from disk after DB record deletion
            if (Storage::disk('local')->exists($storagePath)) {
                Storage::disk('local')->delete($storagePath);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Xóa tệp đính kèm y tế thành công.',
        ], 200);
    }

    /**
     * Validate security constraints on uploaded file.
     */
    protected function validateUploadedFileSecurity($file): ?string
    {
        if (! $file || ! $file->isValid()) {
            return 'Tệp tin tải lên bị lỗi hoặc không hợp lệ.';
        }

        if ($file->getSize() > self::MAX_FILE_SIZE_BYTES) {
            return 'Dung lượng tệp vượt quá giới hạn tối đa 10MB.';
        }

        $mimeType = $file->getClientMimeType() ?: $file->getMimeType();
        $extension = strtolower($file->getClientOriginalExtension());

        // Dangerous executable extensions
        $dangerousExtensions = ['php', 'phtml', 'phar', 'exe', 'sh', 'bat', 'cmd', 'js', 'vbs', 'html', 'htm', 'jar'];
        if (in_array($extension, $dangerousExtensions, true)) {
            return 'Định dạng tệp có nguy cơ bảo mật, không được phép tải lên.';
        }

        return null;
    }

    /**
     * Store the file to local storage and create database record.
     */
    protected function storePatientFile($file, int $patientId, ?int $visitId, Request $request): PatientFile
    {
        $originalName = $request->input('file_name') ?: $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $cleanBaseName = Str::slug(pathinfo($originalName, PATHINFO_FILENAME));
        $uniqueFilename = (string) Str::uuid().'_'.($cleanBaseName ?: 'file').($extension ? '.'.$extension : '');

        $directory = "patient_files/{$patientId}";
        $storedPath = $file->storeAs($directory, $uniqueFilename, 'local');

        return PatientFile::create([
            'patient_id' => $patientId,
            'visit_id' => $visitId,
            'file_name' => $originalName,
            'storage_path' => $storedPath,
            'mime_type' => $file->getClientMimeType() ?: $file->getMimeType(),
            'file_size' => $file->getSize(),
            'uploaded_by' => $request->user()?->id,
            'created_at' => now(),
        ]);
    }
}
