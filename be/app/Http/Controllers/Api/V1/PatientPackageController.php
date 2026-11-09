<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PatientPackage\StorePatientPackageRequest;
use App\Http\Requests\PatientPackage\UpdatePatientPackageStatusRequest;
use App\Http\Resources\PatientPackageResource;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\ServicePackage;
use App\Services\PatientPackageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class PatientPackageController extends Controller
{
    public function __construct(
        protected PatientPackageService $packageService
    ) {}

    /**
     * Display a listing of packages assigned across all patients (admin/reception view).
     */
    public function index(Request $request): JsonResponse
    {
        $query = PatientPackage::query()->with(['patient', 'package.services']);

        // Search by patient name, phone, code or package name
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->whereHas('patient', function ($pq) use ($searchTerm) {
                    $pq->where('full_name', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('phone', 'LIKE', "%{$searchTerm}%");
                })->orWhereHas('package', function ($pkgQ) use ($searchTerm) {
                    $pkgQ->where('name', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('package_code', 'LIKE', "%{$searchTerm}%");
                });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', (int) $request->input('patient_id'));
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $packages = $query->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách gói dịch vụ bệnh nhân thành công.',
            'data' => PatientPackageResource::collection($packages),
            'meta' => [
                'current_page' => $packages->currentPage(),
                'from' => $packages->firstItem(),
                'last_page' => $packages->lastPage(),
                'per_page' => $packages->perPage(),
                'to' => $packages->lastItem(),
                'total' => $packages->total(),
            ],
        ]);
    }

    /**
     * List packages specifically assigned to a single patient.
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

        $query = PatientPackage::query()
            ->with(['package.services', 'patient'])
            ->where('patient_id', $patient->id);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $packages = $query->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách gói dịch vụ của bệnh nhân thành công.',
            'data' => PatientPackageResource::collection($packages),
            'meta' => [
                'current_page' => $packages->currentPage(),
                'from' => $packages->firstItem(),
                'last_page' => $packages->lastPage(),
                'per_page' => $packages->perPage(),
                'to' => $packages->lastItem(),
                'total' => $packages->total(),
            ],
        ]);
    }

    /**
     * Assign a service package to a patient.
     */
    public function store(StorePatientPackageRequest $request, string $patientId): JsonResponse
    {
        $patient = Patient::find($patientId);

        if (! $patient) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin bệnh nhân.',
            ], 404);
        }

        $package = ServicePackage::find($request->input('package_id'));

        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy gói dịch vụ được chọn.',
            ], 404);
        }

        try {
            $patientPackage = $this->packageService->assignPackage(
                patient: $patient,
                package: $package,
                data: $request->validated(),
                actor: $request->user(),
                ipAddress: $request->ip(),
                userAgent: $request->userAgent()
            );

            $patientPackage->load(['patient', 'package.services']);

            return response()->json([
                'success' => true,
                'message' => 'Cấp gói dịch vụ cho bệnh nhân thành công.',
                'data' => new PatientPackageResource($patientPackage),
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Display a specific patient package by ID.
     */
    public function show(string $id): JsonResponse
    {
        $patientPackage = PatientPackage::with(['patient', 'package.services', 'visits'])->find($id);

        if (! $patientPackage) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ của bệnh nhân.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết gói dịch vụ bệnh nhân thành công.',
            'data' => new PatientPackageResource($patientPackage),
        ]);
    }

    /**
     * Update the status of an assigned patient package.
     */
    public function updateStatus(UpdatePatientPackageStatusRequest $request, string $id): JsonResponse
    {
        $patientPackage = PatientPackage::with(['patient', 'package.services'])->find($id);

        if (! $patientPackage) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ của bệnh nhân.',
            ], 404);
        }

        $updatedPackage = $this->packageService->updateStatus(
            patientPackage: $patientPackage,
            newStatus: (string) $request->input('status'),
            actor: $request->user(),
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái gói dịch vụ của bệnh nhân thành công.',
            'data' => new PatientPackageResource($updatedPackage),
        ]);
    }
}
