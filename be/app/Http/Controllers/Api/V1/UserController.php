<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\ChangePasswordRequest;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Requests\User\UpdateUserStatusRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Helper to retrieve a user model with relationships by ID or username.
     */
    protected function findUser(string $idOrUsername): ?User
    {
        $query = User::with(['roles.permissions', 'employee']);

        if (is_numeric($idOrUsername)) {
            return $query->find((int) $idOrUsername);
        }

        return $query->where('username', $idOrUsername)->first();
    }

    /**
     * Helper to revoke all active tokens/sessions for a user.
     */
    protected function revokeUserSessions(User $user): void
    {
        $tokens = Cache::get('user_tokens:'.$user->id, []);
        foreach ($tokens as $hashedToken) {
            Cache::forget('auth_token:'.$hashedToken);
        }
        Cache::forget('user_tokens:'.$user->id);
    }

    /**
     * Display a listing of user accounts with search, filter, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with(['roles.permissions', 'employee']);

        // Search by keyword across username, email, employee full_name, employee_code, phone
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('username', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('email', 'LIKE', "%{$searchTerm}%")
                    ->orWhereHas('employee', function ($eq) use ($searchTerm) {
                        $eq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('employee_code', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('phone', 'LIKE', "%{$searchTerm}%");
                    });
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter by role (name or id)
        if ($request->filled('role')) {
            $role = $request->input('role');
            $query->whereHas('roles', function ($rq) use ($role) {
                if (is_numeric($role)) {
                    $rq->where('roles.id', (int) $role);
                } else {
                    $rq->where('roles.name', (string) $role);
                }
            });
        }

        // Filter by employee_id
        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->input('employee_id'));
        }

        // Sorting
        $allowedSorts = ['id', 'username', 'email', 'status', 'last_login_at', 'created_at'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'id';
        $sortDirection = strtolower((string) ($request->input('order') ?? $request->input('sort_direction', 'desc'))) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        $users = $query->orderBy($sortBy, $sortDirection)->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách tài khoản thành công.',
            'data' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'from' => $users->firstItem(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'to' => $users->lastItem(),
                'total' => $users->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $roleIds = $request->getResolvedRoleIds();

        // Prevent privilege escalation: only ADMIN can assign ADMIN role
        $adminRole = Role::where('name', 'ADMIN')->first();
        if ($adminRole && in_array($adminRole->id, $roleIds, true)) {
            if (! $request->user()?->hasRole('ADMIN')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Bạn không có quyền gán vai trò Quản trị viên (ADMIN).',
                    'errors' => null,
                ], 403);
            }
        }

        $user = User::create([
            'username' => (string) $request->input('username'),
            'email' => (string) $request->input('email'),
            'password_hash' => Hash::make((string) $request->input('password')),
            'employee_id' => $request->input('employee_id'),
            'status' => (string) ($request->input('status') ?? 'ACTIVE'),
        ]);

        if (! empty($roleIds)) {
            $syncPayload = [];
            $now = now();
            foreach ($roleIds as $rId) {
                $syncPayload[$rId] = ['created_at' => $now];
            }
            $user->roles()->sync($syncPayload);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'users',
            'action' => 'create',
            'table_name' => 'users',
            'record_id' => (string) $user->id,
            'old_values' => null,
            'new_values' => [
                'username' => $user->username,
                'email' => $user->email,
                'employee_id' => $user->employee_id,
                'status' => $user->status,
                'role_ids' => $roleIds,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        $user->load(['roles.permissions', 'employee']);

        return response()->json([
            'success' => true,
            'message' => 'Tạo tài khoản người dùng thành công.',
            'data' => new UserResource($user),
        ], 201);
    }

    /**
     * Display the specified user.
     */
    public function show(string $id): JsonResponse
    {
        $user = $this->findUser($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản người dùng yêu cầu.',
                'errors' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Chi tiết tài khoản người dùng.',
            'data' => new UserResource($user),
        ], 200);
    }

    /**
     * Update the specified user in storage.
     */
    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        $user = $this->findUser($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản người dùng yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $adminRole = Role::where('name', 'ADMIN')->first();
        $roleIds = $request->getResolvedRoleIds();

        // Role update logic & protection against privilege escalation and removing last ADMIN
        if ($roleIds !== null && $adminRole) {
            $assigningAdmin = in_array($adminRole->id, $roleIds, true);
            $currentlyAdmin = $user->hasRole('ADMIN');

            // Prevent privilege escalation: non-admin cannot grant ADMIN role
            if ($assigningAdmin && ! $currentlyAdmin && ! $request->user()?->hasRole('ADMIN')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Bạn không có quyền gán vai trò Quản trị viên (ADMIN).',
                    'errors' => null,
                ], 403);
            }

            // Prevent removing ADMIN role from the last active ADMIN
            if ($currentlyAdmin && ! $assigningAdmin && $user->status === 'ACTIVE') {
                $otherActiveAdmins = User::where('status', 'ACTIVE')
                    ->where('id', '!=', $user->id)
                    ->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
                    ->count();

                if ($otherActiveAdmins === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Không thể xóa vai trò Quản trị viên của tài khoản ADMIN hoạt động cuối cùng.',
                        'errors' => null,
                    ], 422);
                }
            }
        }

        // Prevent disabling last active ADMIN via status update
        if ($request->has('status')) {
            $newStatus = (string) $request->input('status');
            if ($newStatus !== 'ACTIVE' && $user->status === 'ACTIVE' && $user->hasRole('ADMIN')) {
                $otherActiveAdmins = User::where('status', 'ACTIVE')
                    ->where('id', '!=', $user->id)
                    ->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
                    ->count();

                if ($otherActiveAdmins === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Không thể vô hiệu hóa tài khoản Quản trị viên (ADMIN) hoạt động cuối cùng của hệ thống.',
                        'errors' => null,
                    ], 422);
                }
            }
        }

        $oldValues = [
            'username' => $user->username,
            'email' => $user->email,
            'employee_id' => $user->employee_id,
            'status' => $user->status,
            'role_ids' => $user->roles->pluck('id')->all(),
        ];

        // Update fillable attributes (ignoring password)
        if ($request->has('username')) {
            $user->username = (string) $request->input('username');
        }
        if ($request->has('email')) {
            $user->email = (string) $request->input('email');
        }
        if ($request->has('employee_id')) {
            $user->employee_id = $request->input('employee_id');
        }
        if ($request->has('status')) {
            $user->status = (string) $request->input('status');
        }

        $user->save();

        if ($roleIds !== null) {
            $syncPayload = [];
            $now = now();
            foreach ($roleIds as $rId) {
                $syncPayload[$rId] = ['created_at' => $now];
            }
            $user->roles()->sync($syncPayload);
        }

        if ($user->status !== 'ACTIVE') {
            $this->revokeUserSessions($user);
        }

        $user->unsetRelation('roles');
        $user->load(['roles.permissions', 'employee']);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'users',
            'action' => 'update',
            'table_name' => 'users',
            'record_id' => (string) $user->id,
            'old_values' => $oldValues,
            'new_values' => [
                'username' => $user->username,
                'email' => $user->email,
                'employee_id' => $user->employee_id,
                'status' => $user->status,
                'role_ids' => $user->roles->pluck('id')->all(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật tài khoản người dùng thành công.',
            'data' => new UserResource($user),
        ], 200);
    }

    /**
     * Update the status of the specified user.
     */
    public function updateStatus(UpdateUserStatusRequest $request, string $id): JsonResponse
    {
        $user = $this->findUser($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản người dùng yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $newStatus = (string) $request->input('status');

        if ($newStatus !== 'ACTIVE' && $user->status === 'ACTIVE' && $user->hasRole('ADMIN')) {
            $otherActiveAdmins = User::where('status', 'ACTIVE')
                ->where('id', '!=', $user->id)
                ->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
                ->count();

            if ($otherActiveAdmins === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể vô hiệu hóa tài khoản Quản trị viên (ADMIN) hoạt động cuối cùng của hệ thống.',
                    'errors' => null,
                ], 422);
            }
        }

        $oldStatus = $user->status;
        $user->update(['status' => $newStatus]);

        if ($newStatus !== 'ACTIVE') {
            $this->revokeUserSessions($user);
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'users',
            'action' => 'status_update',
            'table_name' => 'users',
            'record_id' => (string) $user->id,
            'old_values' => ['status' => $oldStatus],
            'new_values' => ['status' => $newStatus],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái tài khoản thành công.',
            'data' => new UserResource($user->fresh(['roles.permissions', 'employee'])),
        ], 200);
    }

    /**
     * Change password for the specified user.
     */
    public function changePassword(ChangePasswordRequest $request, string $id): JsonResponse
    {
        $user = $this->findUser($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản người dùng yêu cầu.',
                'errors' => null,
            ], 404);
        }

        // Verify current password if provided
        if ($request->filled('current_password')) {
            if (! Hash::check((string) $request->input('current_password'), (string) $user->password_hash)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mật khẩu hiện tại không chính xác.',
                    'errors' => [
                        'current_password' => ['Mật khẩu hiện tại không chính xác.'],
                    ],
                ], 422);
            }
        }

        $newPassword = $request->getNewPassword();
        $user->update([
            'password_hash' => Hash::make($newPassword),
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'users',
            'action' => 'change_password',
            'table_name' => 'users',
            'record_id' => (string) $user->id,
            'old_values' => null,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Đổi mật khẩu người dùng thành công.',
            'data' => new UserResource($user->fresh(['roles.permissions', 'employee'])),
        ], 200);
    }

    /**
     * Remove the specified user from storage.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $this->findUser($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản người dùng yêu cầu.',
                'errors' => null,
            ], 404);
        }

        // Prevent deleting the last active admin
        if ($user->status === 'ACTIVE' && $user->hasRole('ADMIN')) {
            $otherActiveAdmins = User::where('status', 'ACTIVE')
                ->where('id', '!=', $user->id)
                ->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
                ->count();

            if ($otherActiveAdmins === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể xóa tài khoản Quản trị viên (ADMIN) hoạt động cuối cùng của hệ thống.',
                    'errors' => null,
                ], 422);
            }
        }

        // Prevent deleting accounts with existing business records
        $hasAppointments = $user->createdAppointments()->exists();
        $hasVisits = $user->createdVisits()->exists();
        $hasInvoices = $user->createdInvoices()->exists();
        $hasPayments = $user->receivedPayments()->exists();

        if ($hasAppointments || $hasVisits || $hasInvoices || $hasPayments) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa tài khoản đã có lịch sử tạo dữ liệu nghiệp vụ. Vui lòng chuyển sang trạng thái Vô hiệu hóa (INACTIVE/LOCKED).',
                'errors' => [
                    'appointments_count' => $user->createdAppointments()->count(),
                    'visits_count' => $user->createdVisits()->count(),
                    'invoices_count' => $user->createdInvoices()->count(),
                    'payments_count' => $user->receivedPayments()->count(),
                ],
            ], 400);
        }

        $oldValues = [
            'username' => $user->username,
            'email' => $user->email,
            'employee_id' => $user->employee_id,
            'status' => $user->status,
        ];

        $this->revokeUserSessions($user);
        $user->roles()->detach();
        $user->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'users',
            'action' => 'delete',
            'table_name' => 'users',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa tài khoản người dùng thành công.',
            'data' => null,
        ], 200);
    }
}
