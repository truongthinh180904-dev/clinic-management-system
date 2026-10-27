<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class RbacAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed roles & permissions matrix
        $this->seed(RolePermissionSeeder::class);

        // Register custom test routes to specifically verify permission & role middleware on various actions
        Route::middleware(['auth:sanctum', 'active_user', 'permission:invoices.create'])->post('/api/v1/test/financial-create', function () {
            return response()->json(['success' => true, 'message' => 'Financial action authorized.']);
        });

        Route::middleware(['auth:sanctum', 'active_user', 'permission:users.create'])->post('/api/v1/test/user-create', function () {
            return response()->json(['success' => true, 'message' => 'User create authorized.']);
        });

        Route::middleware(['auth:sanctum', 'active_user', 'role:ADMIN|MANAGER'])->get('/api/v1/test/admin-manager-only', function () {
            return response()->json(['success' => true, 'message' => 'Admin or Manager authorized.']);
        });
    }

    /**
     * Helper to create a user attached to a role with an optional employee.
     */
    protected function createUserWithRole(string $roleName, string $status = 'ACTIVE', ?string $username = null): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'position' => $roleName,
            'department' => 'Test Department',
            'hire_date' => '2023-01-01',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => $username ?? 'user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Password@123'),
            'status' => $status,
        ]);

        $role = Role::where('name', $roleName)->firstOrFail();
        $user->roles()->attach($role->id, ['created_at' => now()]);

        return $user;
    }

    /**
     * Helper to authenticate a user using personal access token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->withToken($token);
    }

    public function test_user_has_role_and_has_all_roles_methods(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $this->assertTrue($admin->hasRole('ADMIN'));
        $this->assertTrue($admin->hasRole(['ADMIN', 'DOCTOR']));
        $this->assertFalse($admin->hasRole('DOCTOR'));
        $this->assertTrue($admin->hasAllRoles(['ADMIN']));
        $this->assertFalse($admin->hasAllRoles(['ADMIN', 'DOCTOR']));

        // Attach second role
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();
        $admin->roles()->attach($doctorRole->id, ['created_at' => now()]);
        $admin->unsetRelation('roles');

        $this->assertTrue($admin->hasRole('DOCTOR'));
        $this->assertTrue($admin->hasAllRoles(['ADMIN', 'DOCTOR']));
    }

    public function test_user_has_permission_and_has_all_permissions_methods(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $this->assertTrue($doctor->hasPermission('medical_records.view'));
        $this->assertTrue($doctor->hasPermission('medical_records.create'));
        $this->assertTrue($doctor->hasPermission(['medical_records.view', 'non.existent.permission']));
        $this->assertTrue($doctor->hasAllPermissions(['medical_records.view', 'medical_records.create']));

        // Doctor should not have roles.manage
        $this->assertFalse($doctor->hasPermission('roles.manage'));
        $this->assertFalse($doctor->hasAllPermissions(['medical_records.view', 'roles.manage']));
    }

    public function test_admin_implicitly_has_all_permissions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $this->assertTrue($admin->hasPermission('roles.manage'));
        $this->assertTrue($admin->hasPermission('medical_records.create'));
        $this->assertTrue($admin->hasPermission('non.existent.arbitrary.permission'));
        $this->assertTrue($admin->hasAllPermissions(['anything.one', 'anything.two']));
    }

    public function test_check_permission_middleware_blocks_unauthenticated_request_with_401(): void
    {
        $response = $this->getJson('/api/v1/roles');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_check_permission_middleware_blocks_inactive_user_with_403(): void
    {
        $inactiveAdmin = $this->createUserWithRole('ADMIN', 'INACTIVE');

        $response = $this->authenticate($inactiveAdmin)->getJson('/api/v1/roles');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_check_permission_middleware_blocks_user_without_required_permission_with_403(): void
    {
        // DOCTOR role does not have 'roles.view'
        $doctor = $this->createUserWithRole('DOCTOR');

        $response = $this->authenticate($doctor)->getJson('/api/v1/roles');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);
    }

    public function test_check_permission_middleware_allows_user_with_required_permission(): void
    {
        // Create a custom user with only roles.view
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => 'Auditor',
            'phone' => '09'.fake()->numerify('########'),
            'email' => 'auditor@clinic.local',
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'position' => 'Auditor',
            'department' => 'Audit',
            'hire_date' => '2023-01-01',
            'status' => 'ACTIVE',
        ]);

        $customRole = Role::create([
            'name' => 'ROLE_AUDITOR',
            'description' => 'Role for auditing roles and permissions',
        ]);
        $rolesViewPerm = Permission::where('permission_key', 'roles.view')->firstOrFail();
        $customRole->permissions()->attach($rolesViewPerm->id, ['created_at' => now()]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'auditor_user',
            'email' => $employee->email,
            'password_hash' => bcrypt('Auditor@123'),
            'status' => 'ACTIVE',
        ]);
        $user->roles()->attach($customRole->id, ['created_at' => now()]);

        $response = $this->authenticate($user)->getJson('/api/v1/roles');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Danh sách vai trò người dùng.',
            ]);
    }

    public function test_admin_can_access_permission_protected_routes(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->getJson('/api/v1/roles');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Danh sách vai trò người dùng.',
            ]);
    }

    public function test_get_roles_list_returns_all_roles_with_permissions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->getJson('/api/v1/roles');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'description',
                        'permissions' => [
                            '*' => [
                                'id',
                                'module',
                                'action',
                                'permission_key',
                                'description',
                            ],
                        ],
                    ],
                ],
            ]);

        $this->assertGreaterThanOrEqual(8, count($response->json('data')));
    }

    public function test_get_permissions_list_returns_all_permissions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->getJson('/api/v1/permissions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'module',
                        'action',
                        'permission_key',
                        'description',
                    ],
                ],
            ]);

        $this->assertGreaterThanOrEqual(30, count($response->json('data')));
    }

    public function test_update_role_permissions_successfully_by_authorized_user(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        $perm1 = Permission::where('permission_key', 'medical_records.view')->firstOrFail();
        $perm2 = Permission::where('permission_key', 'medical_records.create')->firstOrFail();

        $response = $this->authenticate($admin)->putJson("/api/v1/roles/{$doctorRole->id}/permissions", [
            'permission_ids' => [$perm1->id, $perm2->id],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật danh sách quyền cho vai trò thành công.',
                'data' => [
                    'id' => $doctorRole->id,
                    'name' => 'DOCTOR',
                ],
            ]);

        $this->assertDatabaseHas('role_permissions', [
            'role_id' => $doctorRole->id,
            'permission_id' => $perm1->id,
        ]);
        $this->assertDatabaseHas('role_permissions', [
            'role_id' => $doctorRole->id,
            'permission_id' => $perm2->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'auth',
            'action' => 'update_role_permissions',
            'table_name' => 'role_permissions',
            'record_id' => $doctorRole->id,
        ]);
    }

    public function test_update_role_permissions_accepts_permission_keys(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        $response = $this->authenticate($admin)->putJson("/api/v1/roles/{$doctorRole->name}/permissions", [
            'permission_keys' => ['medical_records.view', 'patients.view'],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertSame(2, $doctorRole->fresh()->permissions()->count());
    }

    public function test_update_role_permissions_fails_for_user_without_roles_manage_permission(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $managerRole = Role::where('name', 'MANAGER')->firstOrFail();

        $response = $this->authenticate($doctor)->putJson("/api/v1/roles/{$managerRole->id}/permissions", [
            'permission_ids' => [1],
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);
    }

    public function test_update_role_permissions_fails_with_invalid_permissions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        $response = $this->authenticate($admin)->putJson("/api/v1/roles/{$doctorRole->id}/permissions", [
            'permission_ids' => [999999],
        ]);

        $response->assertStatus(422);
    }

    public function test_update_user_roles_successfully_by_authorized_user(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('EMPLOYEE');

        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();
        $managerRole = Role::where('name', 'MANAGER')->firstOrFail();

        $response = $this->authenticate($admin)->putJson("/api/v1/users/{$targetUser->id}/roles", [
            'role_ids' => [$doctorRole->id, $managerRole->id],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật vai trò người dùng thành công.',
                'data' => [
                    'id' => $targetUser->id,
                ],
            ]);

        $this->assertDatabaseHas('user_roles', [
            'user_id' => $targetUser->id,
            'role_id' => $doctorRole->id,
        ]);
        $this->assertDatabaseHas('user_roles', [
            'user_id' => $targetUser->id,
            'role_id' => $managerRole->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'auth',
            'action' => 'update_user_roles',
            'table_name' => 'user_roles',
            'record_id' => $targetUser->id,
        ]);
    }

    public function test_update_user_roles_accepts_role_names(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('EMPLOYEE');

        $response = $this->authenticate($admin)->putJson("/api/v1/users/{$targetUser->username}/roles", [
            'role_names' => ['DOCTOR', 'MANAGER'],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertTrue($targetUser->fresh()->hasRole('DOCTOR'));
        $this->assertTrue($targetUser->fresh()->hasRole('MANAGER'));
    }

    public function test_update_user_roles_fails_for_unauthorized_user(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $targetUser = $this->createUserWithRole('EMPLOYEE');

        $response = $this->authenticate($receptionist)->putJson("/api/v1/users/{$targetUser->id}/roles", [
            'role_names' => ['DOCTOR'],
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);
    }

    public function test_update_user_roles_cannot_remove_admin_role_from_last_active_admin(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        // Ensure this admin is the only active ADMIN
        User::where('id', '!=', $admin->id)->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))->delete();

        $response = $this->authenticate($admin)->putJson("/api/v1/users/{$admin->id}/roles", [
            'role_ids' => [$doctorRole->id],
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể xóa vai trò Quản trị viên của tài khoản ADMIN hoạt động cuối cùng.',
            ]);
    }

    public function test_viewer_role_cannot_call_create_update_or_delete_actions(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();
        $targetUser = $this->createUserWithRole('EMPLOYEE');

        // VIEWER cannot update role permissions
        $resRole = $this->authenticate($viewer)->putJson("/api/v1/roles/{$doctorRole->id}/permissions", [
            'permission_keys' => ['services.view'],
        ]);
        $resRole->assertStatus(403);

        // VIEWER cannot update user roles
        $resUser = $this->authenticate($viewer)->putJson("/api/v1/users/{$targetUser->id}/roles", [
            'role_names' => ['EMPLOYEE'],
        ]);
        $resUser->assertStatus(403);

        // VIEWER cannot execute user create endpoint
        $resCreate = $this->authenticate($viewer)->postJson('/api/v1/test/user-create', []);
        $resCreate->assertStatus(403);

        // Model level verification: VIEWER has no mutation permissions
        $this->assertFalse($viewer->hasPermission('users.create'));
        $this->assertFalse($viewer->hasPermission('users.update'));
        $this->assertFalse($viewer->hasPermission('users.delete'));
        $this->assertFalse($viewer->hasPermission('patients.create'));
        $this->assertFalse($viewer->hasPermission('roles.manage'));
    }

    public function test_receptionist_has_no_financial_permissions(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $cashier = $this->createUserWithRole('CASHIER');

        // Model level verification: RECEPTIONIST has no financial permissions
        $this->assertFalse($receptionist->hasPermission('invoices.view'));
        $this->assertFalse($receptionist->hasPermission('invoices.create'));
        $this->assertFalse($receptionist->hasPermission('invoices.update'));
        $this->assertFalse($receptionist->hasPermission('payments.view'));
        $this->assertFalse($receptionist->hasPermission('payments.create'));
        $this->assertFalse($receptionist->hasPermission('expenses.view'));
        $this->assertFalse($receptionist->hasPermission('expenses.create'));
        $this->assertFalse($receptionist->hasPermission('expenses.approve'));

        // Middleware verification: RECEPTIONIST is blocked on financial endpoints with 403
        $blockedResponse = $this->authenticate($receptionist)->postJson('/api/v1/test/financial-create', []);
        $blockedResponse->assertStatus(403);

        // CASHIER has invoices.create, so CASHIER gets 200
        $allowedResponse = $this->authenticate($cashier)->postJson('/api/v1/test/financial-create', []);
        $allowedResponse->assertStatus(200);
    }

    public function test_check_role_middleware_blocks_or_allows_roles(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $manager = $this->createUserWithRole('MANAGER');
        $admin = $this->createUserWithRole('ADMIN');

        // Doctor is not ADMIN or MANAGER -> 403
        $resDoctor = $this->authenticate($doctor)->getJson('/api/v1/test/admin-manager-only');
        $resDoctor->assertStatus(403);

        // Manager is allowed -> 200
        $resManager = $this->authenticate($manager)->getJson('/api/v1/test/admin-manager-only');
        $resManager->assertStatus(200);

        // Admin is allowed (bypass) -> 200
        $resAdmin = $this->authenticate($admin)->getJson('/api/v1/test/admin-manager-only');
        $resAdmin->assertStatus(200);
    }
}
