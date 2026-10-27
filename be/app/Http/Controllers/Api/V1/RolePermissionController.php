<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Rbac\UpdateRolePermissionsRequest;
use App\Http\Requests\Rbac\UpdateUserRolesRequest;
use App\Http\Resources\PermissionResource;
use App\Http\Resources\RoleResource;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RolePermissionController extends Controller
{
    /**
     * Retrieve list of all roles with their permissions.
     */
    public function roles(Request $request): JsonResponse
    {
        $roles = Role::with('permissions')->orderBy('id')->get();

        return response()->json([
            'success' => true,
            'message' => 'Danh sách vai trò người dùng.',
            'data' => RoleResource::collection($roles),
        ], 200);
    }

    /**
     * Retrieve list of all permissions registered in the system.
     */
    public function permissions(Request $request): JsonResponse
    {
        $permissions = Permission::orderBy('module')->orderBy('id')->get();

        return response()->json([
            'success' => true,
            'message' => 'Danh mục quyền hệ thống.',
            'data' => PermissionResource::collection($permissions),
        ], 200);
    }

    /**
     * Update permissions allocated to a specific role.
     */
    public function updateRolePermissions(UpdateRolePermissionsRequest $request, string $role): JsonResponse
    {
        $roleModel = is_numeric($role)
            ? Role::find((int) $role)
            : Role::where('name', $role)->first();

        if (! $roleModel) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy vai trò yêu cầu.',
                'errors' => null,
            ], 404);
        }

        $permissionIds = $request->getResolvedPermissionIds();
        $oldPermissionIds = $roleModel->permissions()->pluck('permissions.id')->all();

        $syncPayload = [];
        $now = now();
        foreach ($permissionIds as $id) {
            $syncPayload[$id] = ['created_at' => $now];
        }

        $roleModel->permissions()->sync($syncPayload);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'auth',
            'action' => 'update_role_permissions',
            'table_name' => 'role_permissions',
            'record_id' => $roleModel->id,
            'old_values' => ['permission_ids' => $oldPermissionIds],
            'new_values' => ['permission_ids' => $permissionIds],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => $now,
        ]);

        $roleModel->unsetRelation('permissions');
        $roleModel->load('permissions');

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật danh sách quyền cho vai trò thành công.',
            'data' => new RoleResource($roleModel),
        ], 200);
    }

    /**
     * Update roles assigned to a specific user.
     */
    public function updateUserRoles(UpdateUserRolesRequest $request, string $user): JsonResponse
    {
        $userModel = is_numeric($user)
            ? User::find((int) $user)
            : User::where('username', $user)->first();

        if (! $userModel) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản người dùng.',
                'errors' => null,
            ], 404);
        }

        $roleIds = $request->getResolvedRoleIds();

        // Check if removing ADMIN role from the last active ADMIN
        $adminRole = Role::where('name', 'ADMIN')->first();
        if ($adminRole && $userModel->status === 'ACTIVE' && $userModel->hasRole('ADMIN')) {
            if (! in_array($adminRole->id, $roleIds, true)) {
                $otherActiveAdminsCount = User::where('status', 'ACTIVE')
                    ->where('id', '!=', $userModel->id)
                    ->whereHas('roles', function ($q) {
                        $q->where('name', 'ADMIN');
                    })
                    ->count();

                if ($otherActiveAdminsCount === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Không thể xóa vai trò Quản trị viên của tài khoản ADMIN hoạt động cuối cùng.',
                        'errors' => null,
                    ], 422);
                }
            }
        }

        $oldRoleIds = $userModel->roles()->pluck('roles.id')->all();

        $syncPayload = [];
        $now = now();
        foreach ($roleIds as $id) {
            $syncPayload[$id] = ['created_at' => $now];
        }

        $userModel->roles()->sync($syncPayload);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'auth',
            'action' => 'update_user_roles',
            'table_name' => 'user_roles',
            'record_id' => $userModel->id,
            'old_values' => ['role_ids' => $oldRoleIds],
            'new_values' => ['role_ids' => $roleIds],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => $now,
        ]);

        $userModel->unsetRelation('roles');
        $userModel->load(['roles.permissions', 'employee']);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật vai trò người dùng thành công.',
            'data' => new UserResource($userModel),
        ], 200);
    }
}
