<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create an employee with an attached user having a specific role.
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
            'password_hash' => Hash::make('Secret@123'),
            'status' => $status,
        ]);

        $role = Role::where('name', $roleName)->firstOrFail();
        $user->roles()->attach($role->id, ['created_at' => now()]);

        return $user;
    }

    /**
     * Helper to create a user with specific custom permissions.
     *
     * @param  list<string>  $permissionKeys
     */
    protected function createUserWithPermissions(array $permissionKeys, string $status = 'ACTIVE'): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'custom_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => Hash::make('Secret@123'),
            'status' => $status,
        ]);

        $role = Role::create([
            'name' => 'CUSTOM_ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Custom role for testing',
        ]);

        $permissionIds = Permission::whereIn('permission_key', $permissionKeys)->pluck('id');
        $syncData = [];
        foreach ($permissionIds as $id) {
            $syncData[$id] = ['created_at' => now()];
        }
        $role->permissions()->sync($syncData);

        $user->roles()->attach($role->id, ['created_at' => now()]);

        return $user;
    }

    /**
     * Helper to authenticate a user using bearer token in test.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->withToken($token);
    }

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $this->getJson('/api/v1/users')
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);

        $this->postJson('/api/v1/users', ['username' => 'testuser'])
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_inactive_user_is_forbidden_with_403(): void
    {
        $inactiveAdmin = $this->createUserWithRole('ADMIN', 'INACTIVE');

        $this->authenticate($inactiveAdmin)
            ->getJson('/api/v1/users')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
            ]);
    }

    public function test_user_without_users_view_permission_cannot_list_users(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');

        $this->authenticate($viewer)
            ->getJson('/api/v1/users')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);
    }

    public function test_user_with_users_view_can_list_users_with_pagination(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Create several users
        for ($i = 1; $i <= 10; $i++) {
            $this->createUserWithRole('EMPLOYEE', 'ACTIVE', 'employee_user_'.$i);
        }

        $response = $this->authenticate($admin)
            ->getJson('/api/v1/users?per_page=5&page=1')
            ->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'username',
                        'email',
                        'status',
                        'employee',
                        'roles',
                        'permissions',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'from',
                    'last_page',
                    'per_page',
                    'to',
                    'total',
                ],
            ]);

        $this->assertCount(5, $response->json('data'));
        $this->assertSame(1, $response->json('meta.current_page'));
        $this->assertGreaterThanOrEqual(11, $response->json('meta.total'));
    }

    public function test_search_users_by_keyword_and_filter_by_status_and_role(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $doctorEmployee = Employee::create([
            'employee_code' => 'NV-DOC-001',
            'full_name' => 'Nguyen Van Doctor',
            'phone' => '0911223344',
            'email' => 'doctor.search@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $doctorUser = User::create([
            'employee_id' => $doctorEmployee->id,
            'username' => 'searchable_doctor',
            'email' => 'doctor.search@clinic.local',
            'password_hash' => Hash::make('Secret@123'),
            'status' => 'ACTIVE',
        ]);
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();
        $doctorUser->roles()->attach($doctorRole->id, ['created_at' => now()]);

        $lockedUser = User::create([
            'username' => 'locked_account_user',
            'email' => 'locked@clinic.local',
            'password_hash' => Hash::make('Secret@123'),
            'status' => 'LOCKED',
        ]);

        // Search by username
        $respUsername = $this->authenticate($admin)
            ->getJson('/api/v1/users?search=searchable_doctor')
            ->assertStatus(200);
        $this->assertTrue(collect($respUsername->json('data'))->contains('username', 'searchable_doctor'));
        $this->assertFalse(collect($respUsername->json('data'))->contains('username', 'locked_account_user'));

        // Search by employee code
        $respEmpCode = $this->authenticate($admin)
            ->getJson('/api/v1/users?search=DOC-001')
            ->assertStatus(200);
        $this->assertTrue(collect($respEmpCode->json('data'))->contains('username', 'searchable_doctor'));

        // Filter by status
        $respStatus = $this->authenticate($admin)
            ->getJson('/api/v1/users?status=LOCKED')
            ->assertStatus(200);
        $this->assertTrue(collect($respStatus->json('data'))->contains('username', 'locked_account_user'));
        $this->assertFalse(collect($respStatus->json('data'))->contains('username', 'searchable_doctor'));

        // Filter by role
        $respRole = $this->authenticate($admin)
            ->getJson('/api/v1/users?role=DOCTOR')
            ->assertStatus(200);
        $this->assertTrue(collect($respRole->json('data'))->contains('username', 'searchable_doctor'));
    }

    public function test_create_user_successfully_with_employee_and_roles(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $employee = Employee::create([
            'employee_code' => 'NV-LINK-001',
            'full_name' => 'Nguyen Van Link',
            'phone' => '0933445566',
            'email' => 'link@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/users', [
                'username' => 'new_doctor_user',
                'email' => 'new.doctor@clinic.local',
                'password' => 'SecurePass@123',
                'employee_id' => $employee->id,
                'status' => 'ACTIVE',
                'roles' => ['DOCTOR'],
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo tài khoản người dùng thành công.',
                'data' => [
                    'username' => 'new_doctor_user',
                    'email' => 'new.doctor@clinic.local',
                    'status' => 'ACTIVE',
                    'employee' => [
                        'id' => $employee->id,
                        'employee_code' => 'NV-LINK-001',
                        'full_name' => 'Nguyen Van Link',
                    ],
                ],
            ]);

        $newUserId = $response->json('data.id');
        $this->assertDatabaseHas('users', [
            'id' => $newUserId,
            'username' => 'new_doctor_user',
            'email' => 'new.doctor@clinic.local',
        ]);

        $this->assertDatabaseHas('user_roles', [
            'user_id' => $newUserId,
            'role_id' => $doctorRole->id,
        ]);

        // Audit log created and does not contain plain password
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'users',
            'action' => 'create',
            'record_id' => (string) $newUserId,
        ]);

        // Response must not leak password_hash
        $this->assertArrayNotHasKey('password_hash', $response->json('data'));
        $this->assertStringNotContainsString('password_hash', (string) $response->getContent());
        $this->assertStringNotContainsString('SecurePass@123', (string) $response->getContent());
    }

    public function test_create_user_validation_errors(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Missing required fields
        $this->authenticate($admin)
            ->postJson('/api/v1/users', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['username', 'email', 'password']);

        // Duplicate username and email
        $existing = $this->createUserWithRole('EMPLOYEE', 'ACTIVE', 'existing_username');

        $this->authenticate($admin)
            ->postJson('/api/v1/users', [
                'username' => 'existing_username',
                'email' => $existing->email,
                'password' => 'Secret@123',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['username', 'email']);

        // Invalid email format and too short password
        $this->authenticate($admin)
            ->postJson('/api/v1/users', [
                'username' => 'valid_user',
                'email' => 'not-an-email',
                'password' => '123',
                'status' => 'INVALID_STATUS',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password', 'status']);
    }

    public function test_privilege_escalation_non_admin_cannot_assign_admin_role_on_create(): void
    {
        $manager = $this->createUserWithPermissions(['users.create', 'users.view']);

        $response = $this->authenticate($manager)
            ->postJson('/api/v1/users', [
                'username' => 'illegal_admin_user',
                'email' => 'illegal.admin@clinic.local',
                'password' => 'HackerPass@123',
                'roles' => ['ADMIN'],
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền gán vai trò Quản trị viên (ADMIN).',
            ]);

        $this->assertDatabaseMissing('users', [
            'username' => 'illegal_admin_user',
        ]);
    }

    public function test_show_user_details_by_id_and_username_and_not_found(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('DOCTOR', 'ACTIVE', 'target_doc_user');

        // Show by ID
        $resById = $this->authenticate($admin)
            ->getJson('/api/v1/users/'.$targetUser->id)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $targetUser->id,
                    'username' => 'target_doc_user',
                ],
            ]);
        $this->assertArrayNotHasKey('password_hash', $resById->json('data'));

        // Show by username
        $resByUsername = $this->authenticate($admin)
            ->getJson('/api/v1/users/target_doc_user')
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $targetUser->id,
                    'username' => 'target_doc_user',
                ],
            ]);

        // Not found
        $this->authenticate($admin)
            ->getJson('/api/v1/users/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_update_user_details_successfully(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('EMPLOYEE', 'ACTIVE', 'user_to_update');

        $response = $this->authenticate($admin)
            ->putJson('/api/v1/users/'.$targetUser->id, [
                'email' => 'updated.email@clinic.local',
                'roles' => ['DOCTOR'],
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật tài khoản người dùng thành công.',
                'data' => [
                    'id' => $targetUser->id,
                    'email' => 'updated.email@clinic.local',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'email' => 'updated.email@clinic.local',
        ]);

        $this->assertTrue($targetUser->fresh()->hasRole('DOCTOR'));

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'users',
            'action' => 'update',
            'record_id' => (string) $targetUser->id,
        ]);
    }

    public function test_update_user_validation_unique_checks(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $user1 = $this->createUserWithRole('EMPLOYEE', 'ACTIVE', 'user_one');
        $user2 = $this->createUserWithRole('EMPLOYEE', 'ACTIVE', 'user_two');

        // Updating user1 with its own email is fine
        $this->authenticate($admin)
            ->putJson('/api/v1/users/'.$user1->id, [
                'email' => $user1->email,
            ])
            ->assertStatus(200);

        // Updating user1 with user2's email fails
        $this->authenticate($admin)
            ->putJson('/api/v1/users/'.$user1->id, [
                'email' => $user2->email,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_update_user_status_specifically(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('EMPLOYEE', 'ACTIVE', 'status_test_user');

        $response = $this->authenticate($admin)
            ->patchJson('/api/v1/users/'.$targetUser->id.'/status', [
                'status' => 'LOCKED',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $targetUser->id,
                    'status' => 'LOCKED',
                ],
            ]);

        $this->assertSame('LOCKED', $targetUser->fresh()->status);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'users',
            'action' => 'status_update',
            'record_id' => (string) $targetUser->id,
        ]);
    }

    public function test_cannot_deactivate_last_active_admin_user(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Ensure this is the sole active ADMIN
        User::where('id', '!=', $admin->id)
            ->whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
            ->delete();

        // 1. Cannot set to INACTIVE via PUT update
        $resPut = $this->authenticate($admin)
            ->putJson('/api/v1/users/'.$admin->id, [
                'status' => 'INACTIVE',
            ]);
        $resPut->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể vô hiệu hóa tài khoản Quản trị viên (ADMIN) hoạt động cuối cùng của hệ thống.',
            ]);

        // 2. Cannot set to LOCKED via PATCH status
        $resPatch = $this->authenticate($admin)
            ->patchJson('/api/v1/users/'.$admin->id.'/status', [
                'status' => 'LOCKED',
            ]);
        $resPatch->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể vô hiệu hóa tài khoản Quản trị viên (ADMIN) hoạt động cuối cùng của hệ thống.',
            ]);

        // 3. Cannot delete the last active admin
        $resDelete = $this->authenticate($admin)
            ->deleteJson('/api/v1/users/'.$admin->id);
        $resDelete->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể xóa tài khoản Quản trị viên (ADMIN) hoạt động cuối cùng của hệ thống.',
            ]);

        $this->assertSame('ACTIVE', $admin->fresh()->status);

        // 4. If a second active admin exists, deactivating one succeeds
        $secondAdmin = $this->createUserWithRole('ADMIN', 'ACTIVE', 'second_admin');

        $resSecond = $this->authenticate($admin)
            ->patchJson('/api/v1/users/'.$secondAdmin->id.'/status', [
                'status' => 'LOCKED',
            ]);
        $resSecond->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertSame('LOCKED', $secondAdmin->fresh()->status);
    }

    public function test_privilege_escalation_non_admin_cannot_assign_admin_role_on_update(): void
    {
        $manager = $this->createUserWithPermissions(['users.update', 'users.view']);
        $targetUser = $this->createUserWithRole('EMPLOYEE');

        $response = $this->authenticate($manager)
            ->putJson('/api/v1/users/'.$targetUser->id, [
                'roles' => ['ADMIN'],
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền gán vai trò Quản trị viên (ADMIN).',
            ]);

        $this->assertFalse($targetUser->fresh()->hasRole('ADMIN'));
    }

    public function test_change_password_successfully_and_can_login_with_new_password(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('DOCTOR', 'ACTIVE', 'pwd_doc_user');

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/users/'.$targetUser->id.'/change-password', [
                'new_password' => 'NewSecurePassword@999',
                'new_password_confirmation' => 'NewSecurePassword@999',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Đổi mật khẩu người dùng thành công.',
            ]);

        // Audit log created without passwords
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'users',
            'action' => 'change_password',
            'record_id' => (string) $targetUser->id,
        ]);

        // Attempt login with old password fails
        $this->postJson('/api/v1/auth/login', [
            'username' => 'pwd_doc_user',
            'password' => 'Secret@123',
        ])->assertStatus(401);

        // Attempt login with new password succeeds
        $this->postJson('/api/v1/auth/login', [
            'username' => 'pwd_doc_user',
            'password' => 'NewSecurePassword@999',
        ])->assertStatus(200);
    }

    public function test_change_password_validation_errors(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('DOCTOR');

        // Mismatched confirmation
        $this->authenticate($admin)
            ->postJson('/api/v1/users/'.$targetUser->id.'/change-password', [
                'new_password' => 'Password123',
                'new_password_confirmation' => 'DifferentPassword123',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['new_password']);

        // Wrong current password
        $this->authenticate($admin)
            ->postJson('/api/v1/users/'.$targetUser->id.'/change-password', [
                'current_password' => 'WrongCurrentPassword',
                'new_password' => 'NewPassword123',
                'new_password_confirmation' => 'NewPassword123',
            ])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Mật khẩu hiện tại không chính xác.',
            ]);
    }

    public function test_session_revocation_when_user_is_deactivated(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $user = $this->createUserWithRole('DOCTOR', 'ACTIVE', 'session_user');

        // User authenticates and receives token
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'username' => 'session_user',
            'password' => 'Secret@123',
        ])->assertStatus(200);
        $userToken = $loginRes->json('data.token');

        // Token works before deactivation
        $this->withToken($userToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(200);

        // Admin deactivates user to LOCKED
        $this->authenticate($admin)
            ->patchJson('/api/v1/users/'.$user->id.'/status', [
                'status' => 'LOCKED',
            ])
            ->assertStatus(200);

        // Token is immediately rejected with 403
        $this->withToken($userToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
            ]);
    }

    public function test_delete_user_restrictions_and_success(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // 1. Create a user with appointments
        $busyDoctor = $this->createUserWithRole('DOCTOR');
        $patient = Patient::create([
            'patient_code' => 'BN-USERTEST-01',
            'full_name' => 'Benh Nhan Test',
            'phone' => '0912345678',
            'status' => 'ACTIVE',
        ]);
        $service = Service::create([
            'service_code' => 'DV-USERTEST-01',
            'name' => 'Dich vu Test',
            'price' => 100000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);
        Appointment::create([
            'appointment_code' => 'LH-USERTEST-01',
            'patient_id' => $patient->id,
            'employee_id' => $busyDoctor->employee_id,
            'service_id' => $service->id,
            'appointment_date' => '2026-10-31',
            'start_time' => '10:00:00',
            'end_time' => '10:30:00',
            'status' => 'CONFIRMED',
            'created_by' => $busyDoctor->id,
        ]);

        $this->authenticate($admin)
            ->deleteJson('/api/v1/users/'.$busyDoctor->id)
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('users', ['id' => $busyDoctor->id]);

        // 2. Free unused user can be deleted
        $freeUser = $this->createUserWithRole('EMPLOYEE');
        $this->authenticate($admin)
            ->deleteJson('/api/v1/users/'.$freeUser->id)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa tài khoản người dùng thành công.',
            ]);

        $this->assertDatabaseMissing('users', ['id' => $freeUser->id]);
    }

    public function test_password_hash_is_never_leaked_in_any_response(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('DOCTOR', 'ACTIVE', 'no_leak_user');

        // Check index
        $indexRes = $this->authenticate($admin)->getJson('/api/v1/users');
        $this->assertStringNotContainsString('password_hash', (string) $indexRes->getContent());

        // Check show
        $showRes = $this->authenticate($admin)->getJson('/api/v1/users/'.$targetUser->id);
        $this->assertStringNotContainsString('password_hash', (string) $showRes->getContent());

        // Check update
        $updateRes = $this->authenticate($admin)->putJson('/api/v1/users/'.$targetUser->id, [
            'email' => 'no.leak@clinic.local',
        ]);
        $this->assertStringNotContainsString('password_hash', (string) $updateRes->getContent());

        // Check status update
        $statusRes = $this->authenticate($admin)->patchJson('/api/v1/users/'.$targetUser->id.'/status', [
            'status' => 'INACTIVE',
        ]);
        $this->assertStringNotContainsString('password_hash', (string) $statusRes->getContent());

        // Check change password
        $pwdRes = $this->authenticate($admin)->postJson('/api/v1/users/'.$targetUser->id.'/change-password', [
            'new_password' => 'SafeNewPassword@123',
            'new_password_confirmation' => 'SafeNewPassword@123',
        ]);
        $this->assertStringNotContainsString('password_hash', (string) $pwdRes->getContent());
    }
}
