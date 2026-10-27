<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeStatusRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Services\EmployeeCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function __construct(
        protected EmployeeCodeGenerator $codeGenerator
    ) {}

    /**
     * Display a listing of employees with search, filter, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Employee::with('user');

        // Search by keyword across code, name, phone, email
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('employee_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('full_name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('email', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter by department
        if ($request->filled('department')) {
            $query->where('department', (string) $request->input('department'));
        }

        // Filter by position
        if ($request->filled('position')) {
            $query->where('position', (string) $request->input('position'));
        }

        // Sorting
        $allowedSorts = ['id', 'employee_code', 'full_name', 'department', 'position', 'hire_date', 'status', 'created_at'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $employees = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách nhân viên thành công.',
            'data' => EmployeeResource::collection($employees),
            'meta' => [
                'current_page' => $employees->currentPage(),
                'from' => $employees->firstItem(),
                'last_page' => $employees->lastPage(),
                'per_page' => $employees->perPage(),
                'to' => $employees->lastItem(),
                'total' => $employees->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created employee in storage.
     */
    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (empty($data['employee_code'])) {
            $data['employee_code'] = $this->codeGenerator->generate();
        }

        if (empty($data['status'])) {
            $data['status'] = 'ACTIVE';
        }

        $employee = Employee::create($data);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'employees',
            'action' => 'create',
            'table_name' => 'employees',
            'record_id' => (string) $employee->id,
            'old_values' => null,
            'new_values' => $employee->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo hồ sơ nhân viên mới thành công.',
            'data' => new EmployeeResource($employee),
        ], 201);
    }

    /**
     * Display the specified employee.
     */
    public function show(string $id): JsonResponse
    {
        $employee = Employee::with('user')->find($id);

        if (! $employee) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ nhân viên yêu cầu.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Chi tiết thông tin nhân viên.',
            'data' => new EmployeeResource($employee),
        ], 200);
    }

    /**
     * Update the specified employee in storage.
     */
    public function update(UpdateEmployeeRequest $request, string $id): JsonResponse
    {
        $employee = Employee::find($id);

        if (! $employee) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ nhân viên yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $oldValues = $employee->toArray();
        $employee->update($request->validated());

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'employees',
            'action' => 'update',
            'table_name' => 'employees',
            'record_id' => (string) $employee->id,
            'old_values' => $oldValues,
            'new_values' => $employee->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật hồ sơ nhân viên thành công.',
            'data' => new EmployeeResource($employee->fresh()->load('user')),
        ], 200);
    }

    /**
     * Update the status of the specified employee.
     */
    public function updateStatus(UpdateEmployeeStatusRequest $request, string $id): JsonResponse
    {
        $employee = Employee::find($id);

        if (! $employee) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ nhân viên yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $oldStatus = $employee->status;
        $newStatus = (string) $request->validated('status');

        $employee->update(['status' => $newStatus]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'employees',
            'action' => 'status_update',
            'table_name' => 'employees',
            'record_id' => (string) $employee->id,
            'old_values' => ['status' => $oldStatus],
            'new_values' => ['status' => $newStatus],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái nhân viên thành công.',
            'data' => new EmployeeResource($employee->fresh()),
        ], 200);
    }

    /**
     * Remove the specified employee from storage.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $employee = Employee::find($id);

        if (! $employee) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ nhân viên yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $hasAppointments = $employee->appointments()->exists();
        $hasVisits = $employee->visits()->exists();
        $hasMedicalRecords = $employee->medicalRecords()->exists();

        if ($hasAppointments || $hasVisits || $hasMedicalRecords) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa nhân viên đã có lịch hẹn hoặc lịch sử khám chữa bệnh.',
                'errors' => [
                    'appointments_count' => $employee->appointments()->count(),
                    'visits_count' => $employee->visits()->count(),
                    'medical_records_count' => $employee->medicalRecords()->count(),
                ],
            ], 400);
        }

        if ($employee->users()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa nhân viên đang được liên kết với tài khoản người dùng hệ thống.',
                'errors' => [
                    'users_count' => $employee->users()->count(),
                ],
            ], 400);
        }

        $oldValues = $employee->toArray();
        $employee->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'employees',
            'action' => 'delete',
            'table_name' => 'employees',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa hồ sơ nhân viên thành công.',
            'data' => null,
        ], 200);
    }
}
