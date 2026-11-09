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
use Tests\TestCase;

class EmployeeApiTest extends TestCase
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
    protected function createUserWithRole(string $roleName, string $status = 'ACTIVE'): User
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
            'username' => 'user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => $status,
        ]);

        $role = Role::where('name', $roleName)->firstOrFail();
        $user->roles()->attach($role->id, ['created_at' => now()]);

        return $user;
    }

    /**
     * Helper to create a user with custom specific permissions.
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
            'password_hash' => bcrypt('Secret@123'),
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
     * Authenticate a user using bearer token in test.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->withToken($token);
    }

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $this->getJson('/api/v1/employees')
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);

        $this->postJson('/api/v1/employees', ['full_name' => 'Test User'])
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_inactive_user_is_forbidden_with_403(): void
    {
        $inactiveUser = $this->createUserWithRole('ADMIN', 'INACTIVE');

        $this->authenticate($inactiveUser)
            ->getJson('/api/v1/employees')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_user_without_permission_cannot_access_employee_endpoints(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');

        // Viewer lacks employees.view, employees.create, employees.update, employees.delete
        $this->authenticate($viewer)
            ->getJson('/api/v1/employees')
            ->assertStatus(403);

        $this->authenticate($viewer)
            ->postJson('/api/v1/employees', ['full_name' => 'Nguyen Van A'])
            ->assertStatus(403);
    }

    public function test_user_with_only_employees_view_can_list_and_show_but_cannot_modify(): void
    {
        $viewUser = $this->createUserWithPermissions(['employees.view']);

        $targetEmployee = Employee::create([
            'employee_code' => 'NV-TARGET-01',
            'full_name' => 'Tran Van Target',
            'status' => 'ACTIVE',
        ]);

        // Can list and show
        $this->authenticate($viewUser)
            ->getJson('/api/v1/employees')
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->authenticate($viewUser)
            ->getJson('/api/v1/employees/'.$targetEmployee->id)
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        // Cannot create
        $this->authenticate($viewUser)
            ->postJson('/api/v1/employees', ['full_name' => 'New Employee'])
            ->assertStatus(403);

        // Cannot update
        $this->authenticate($viewUser)
            ->putJson('/api/v1/employees/'.$targetEmployee->id, ['full_name' => 'Updated Name'])
            ->assertStatus(403);

        // Cannot update status
        $this->authenticate($viewUser)
            ->patchJson('/api/v1/employees/'.$targetEmployee->id.'/status', ['status' => 'INACTIVE'])
            ->assertStatus(403);

        // Cannot delete
        $this->authenticate($viewUser)
            ->deleteJson('/api/v1/employees/'.$targetEmployee->id)
            ->assertStatus(403);
    }

    public function test_user_with_only_employees_create_can_create_but_cannot_list_or_modify(): void
    {
        $createUser = $this->createUserWithPermissions(['employees.create']);

        $targetEmployee = Employee::create([
            'employee_code' => 'NV-TARGET-02',
            'full_name' => 'Le Van Target',
            'status' => 'ACTIVE',
        ]);

        // Cannot list
        $this->authenticate($createUser)
            ->getJson('/api/v1/employees')
            ->assertStatus(403);

        // Can create
        $this->authenticate($createUser)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Created by creator',
                'department' => 'HR',
            ])
            ->assertStatus(201)
            ->assertJson(['success' => true]);

        // Cannot update
        $this->authenticate($createUser)
            ->putJson('/api/v1/employees/'.$targetEmployee->id, ['full_name' => 'Updated by creator'])
            ->assertStatus(403);
    }

    public function test_user_with_only_employees_update_can_update_details_and_status(): void
    {
        $updateUser = $this->createUserWithPermissions(['employees.update']);

        $targetEmployee = Employee::create([
            'employee_code' => 'NV-TARGET-03',
            'full_name' => 'Hoang Van Target',
            'status' => 'ACTIVE',
        ]);

        // Cannot list
        $this->authenticate($updateUser)
            ->getJson('/api/v1/employees')
            ->assertStatus(403);

        // Can update
        $this->authenticate($updateUser)
            ->putJson('/api/v1/employees/'.$targetEmployee->id, [
                'full_name' => 'Hoang Van Target Renamed',
                'department' => 'IT Department',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'full_name' => 'Hoang Van Target Renamed',
                    'department' => 'IT Department',
                ],
            ]);

        // Can update status
        $this->authenticate($updateUser)
            ->patchJson('/api/v1/employees/'.$targetEmployee->id.'/status', [
                'status' => 'INACTIVE',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'INACTIVE',
                ],
            ]);

        $this->assertSame('INACTIVE', $targetEmployee->fresh()->status);
    }

    public function test_admin_and_manager_have_permission_to_manage_employees(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $this->authenticate($manager)
            ->getJson('/api/v1/employees')
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $createResponse = $this->authenticate($manager)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Nhan Vien Moi',
                'position' => 'Duoc si',
                'department' => 'Khoa Duoc',
            ])
            ->assertStatus(201)
            ->assertJson(['success' => true]);

        $createdId = $createResponse->json('data.id');

        $this->authenticate($manager)
            ->getJson('/api/v1/employees/'.$createdId)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $createdId,
                    'full_name' => 'Nhan Vien Moi',
                ],
            ]);
    }

    public function test_list_employees_supports_pagination(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Create 20 distinct employees
        for ($i = 1; $i <= 20; $i++) {
            Employee::create([
                'employee_code' => 'NV-PAGE-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'full_name' => 'Nhan Vien Trang '.$i,
                'status' => 'ACTIVE',
            ]);
        }

        $responsePage1 = $this->authenticate($admin)
            ->getJson('/api/v1/employees?per_page=10&page=1')
            ->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'meta' => [
                    'current_page',
                    'from',
                    'last_page',
                    'per_page',
                    'to',
                    'total',
                ],
            ]);

        $this->assertCount(10, $responsePage1->json('data'));
        $this->assertSame(1, $responsePage1->json('meta.current_page'));
        $this->assertGreaterThanOrEqual(21, $responsePage1->json('meta.total'));

        $responsePage2 = $this->authenticate($admin)
            ->getJson('/api/v1/employees?per_page=10&page=2')
            ->assertStatus(200);

        $this->assertSame(2, $responsePage2->json('meta.current_page'));
        $this->assertCount(10, $responsePage2->json('data'));
    }

    public function test_search_employees_by_keyword(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        Employee::create([
            'employee_code' => 'NV-SRCH-999',
            'full_name' => 'Ngo Thi Thanh Binh',
            'phone' => '0988776655',
            'email' => 'thanhbinh@clinic.local',
            'status' => 'ACTIVE',
        ]);

        Employee::create([
            'employee_code' => 'NV-SRCH-111',
            'full_name' => 'Vu Dinh Trong',
            'phone' => '0911223344',
            'email' => 'dinhtrong@clinic.local',
            'status' => 'ACTIVE',
        ]);

        // Search by name keyword
        $respName = $this->authenticate($admin)
            ->getJson('/api/v1/employees?search=Thanh Binh')
            ->assertStatus(200);
        $this->assertTrue(collect($respName->json('data'))->contains('employee_code', 'NV-SRCH-999'));
        $this->assertFalse(collect($respName->json('data'))->contains('employee_code', 'NV-SRCH-111'));

        // Search by code keyword
        $respCode = $this->authenticate($admin)
            ->getJson('/api/v1/employees?search=SRCH-111')
            ->assertStatus(200);
        $this->assertTrue(collect($respCode->json('data'))->contains('employee_code', 'NV-SRCH-111'));
        $this->assertFalse(collect($respCode->json('data'))->contains('employee_code', 'NV-SRCH-999'));

        // Search by phone keyword
        $respPhone = $this->authenticate($admin)
            ->getJson('/api/v1/employees?q=88776655')
            ->assertStatus(200);
        $this->assertTrue(collect($respPhone->json('data'))->contains('employee_code', 'NV-SRCH-999'));
    }

    public function test_filter_employees_by_status_department_and_position(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        Employee::create([
            'employee_code' => 'NV-FLT-01',
            'full_name' => 'Bac si Sieu Am',
            'department' => 'Chan Doan Hinh Anh',
            'position' => 'Doctor',
            'status' => 'ACTIVE',
        ]);

        Employee::create([
            'employee_code' => 'NV-FLT-02',
            'full_name' => 'Dieu duong Khoa Noi',
            'department' => 'Khoa Noi',
            'position' => 'Nurse',
            'status' => 'LOCKED',
        ]);

        // Filter by status LOCKED
        $respStatus = $this->authenticate($admin)
            ->getJson('/api/v1/employees?status=LOCKED')
            ->assertStatus(200);
        $this->assertTrue(collect($respStatus->json('data'))->contains('employee_code', 'NV-FLT-02'));
        $this->assertFalse(collect($respStatus->json('data'))->contains('employee_code', 'NV-FLT-01'));

        // Filter by department
        $respDept = $this->authenticate($admin)
            ->getJson('/api/v1/employees?department=Chan Doan Hinh Anh')
            ->assertStatus(200);
        $this->assertTrue(collect($respDept->json('data'))->contains('employee_code', 'NV-FLT-01'));
        $this->assertFalse(collect($respDept->json('data'))->contains('employee_code', 'NV-FLT-02'));
    }

    public function test_create_employee_auto_generates_unique_code_when_omitted(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response1 = $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Nguyen Van Thu Nhat',
                'phone' => '0901112223',
                'department' => 'Tiep don',
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'full_name' => 'Nguyen Van Thu Nhat',
                    'status' => 'ACTIVE',
                ],
            ]);

        $code1 = $response1->json('data.employee_code');
        $this->assertMatchesRegularExpression('/^NV\d{6}$/', $code1);

        $response2 = $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Nguyen Van Thu Hai',
                'phone' => '0901112224',
            ])
            ->assertStatus(201);

        $code2 = $response2->json('data.employee_code');
        $this->assertMatchesRegularExpression('/^NV\d{6}$/', $code2);
        $this->assertNotSame($code1, $code2);
    }

    public function test_create_employee_with_custom_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'NV-CUSTOM-001',
                'full_name' => 'Bac si Cao Cap',
                'phone' => '0987654321',
                'email' => 'bscaocap@clinic.local',
                'date_of_birth' => '1985-06-15',
                'gender' => 'MALE',
                'position' => 'Truong khoa',
                'department' => 'Khoa Ngoai',
                'hire_date' => '2020-01-01',
                'status' => 'ACTIVE',
                'notes' => 'Bac si kinh nghiem 15 nam',
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'employee_code' => 'NV-CUSTOM-001',
                    'full_name' => 'Bac si Cao Cap',
                    'gender' => 'MALE',
                    'position' => 'Truong khoa',
                    'department' => 'Khoa Ngoai',
                    'date_of_birth' => '1985-06-15',
                    'hire_date' => '2020-01-01',
                ],
            ]);

        $this->assertDatabaseHas('employees', [
            'employee_code' => 'NV-CUSTOM-001',
            'full_name' => 'Bac si Cao Cap',
        ]);
    }

    public function test_create_employee_validation_errors(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Missing full_name
        $this->authenticate($admin)
            ->postJson('/api/v1/employees', [])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
            ])
            ->assertJsonValidationErrors(['full_name']);

        // Duplicate employee_code
        Employee::create([
            'employee_code' => 'NV-EXISTING',
            'full_name' => 'Da Co Trong He Thong',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'NV-EXISTING',
                'full_name' => 'Nguoi Moi Trung Ma',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['employee_code']);

        // Invalid email format, invalid status, invalid gender, future date_of_birth
        $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Test Errors',
                'email' => 'invalid-email-format',
                'status' => 'INVALID_STATUS',
                'gender' => 'UNKNOWN_GENDER',
                'date_of_birth' => '2099-01-01',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'status', 'gender', 'date_of_birth']);
    }

    public function test_show_employee_returns_details_and_handles_not_found(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $employee = Employee::create([
            'employee_code' => 'NV-SHOW-01',
            'full_name' => 'Tran Thi Detail',
            'phone' => '0912349999',
            'email' => 'detail@clinic.local',
            'department' => 'Tiep Don',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->getJson('/api/v1/employees/'.$employee->id)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $employee->id,
                    'employee_code' => 'NV-SHOW-01',
                    'full_name' => 'Tran Thi Detail',
                ],
            ]);

        // Not found
        $this->authenticate($admin)
            ->getJson('/api/v1/employees/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_update_employee_details_successfully(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $employee = Employee::create([
            'employee_code' => 'NV-UPD-01',
            'full_name' => 'Ten Ban Dau',
            'phone' => '0901234567',
            'department' => 'Phong Cu',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->putJson('/api/v1/employees/'.$employee->id, [
                'full_name' => 'Ten Da Duoc Thay Doi',
                'department' => 'Phong Moi Cap Nhat',
                'position' => 'Pho Giam Doc',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'full_name' => 'Ten Da Duoc Thay Doi',
                    'department' => 'Phong Moi Cap Nhat',
                    'position' => 'Pho Giam Doc',
                ],
            ]);

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'full_name' => 'Ten Da Duoc Thay Doi',
            'department' => 'Phong Moi Cap Nhat',
        ]);
    }

    public function test_update_employee_allows_same_code_but_rejects_another_employees_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $emp1 = Employee::create([
            'employee_code' => 'NV-UNIQUE-1',
            'full_name' => 'Nhan Vien 1',
            'status' => 'ACTIVE',
        ]);

        $emp2 = Employee::create([
            'employee_code' => 'NV-UNIQUE-2',
            'full_name' => 'Nhan Vien 2',
            'status' => 'ACTIVE',
        ]);

        // Updating emp1 with its own employee_code is fine
        $this->authenticate($admin)
            ->putJson('/api/v1/employees/'.$emp1->id, [
                'employee_code' => 'NV-UNIQUE-1',
                'full_name' => 'Nhan Vien 1 Updated',
            ])
            ->assertStatus(200);

        // Updating emp1 with emp2's employee_code fails
        $this->authenticate($admin)
            ->putJson('/api/v1/employees/'.$emp1->id, [
                'employee_code' => 'NV-UNIQUE-2',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['employee_code']);
    }

    public function test_update_employee_status_endpoint(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $employee = Employee::create([
            'employee_code' => 'NV-ST-01',
            'full_name' => 'Dang Hoat Dong',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->patchJson('/api/v1/employees/'.$employee->id.'/status', [
                'status' => 'LOCKED',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $employee->id,
                    'status' => 'LOCKED',
                ],
            ]);

        $this->assertSame('LOCKED', $employee->fresh()->status);

        // Invalid status value
        $this->authenticate($admin)
            ->patchJson('/api/v1/employees/'.$employee->id.'/status', [
                'status' => 'NOT_VALID_STATUS',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        // Not found
        $this->authenticate($admin)
            ->patchJson('/api/v1/employees/999999/status', [
                'status' => 'ACTIVE',
            ])
            ->assertStatus(404);
    }

    public function test_cannot_delete_employee_with_appointments(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $doctor = Employee::create([
            'employee_code' => 'NV-DR-BUSY',
            'full_name' => 'Bac si Co Lich Hen',
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN-TEST-001',
            'full_name' => 'Benh Nhan Test',
            'phone' => '0933221100',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-TEST-001',
            'name' => 'Dich vu Test',
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        Appointment::create([
            'appointment_code' => 'LH-TEST-001',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-10-30',
            'start_time' => '08:30:00',
            'end_time' => '09:00:00',
            'status' => 'CONFIRMED',
            'created_by' => $admin->id,
        ]);

        // Attempt deletion
        $this->authenticate($admin)
            ->deleteJson('/api/v1/employees/'.$doctor->id)
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('employees', [
            'id' => $doctor->id,
        ]);
    }

    public function test_cannot_delete_employee_with_linked_user(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $employee = Employee::create([
            'employee_code' => 'NV-LINKED',
            'full_name' => 'Nhan vien Co User',
            'status' => 'ACTIVE',
        ]);

        User::create([
            'employee_id' => $employee->id,
            'username' => 'linked_user_acc',
            'email' => 'linked@clinic.local',
            'password_hash' => bcrypt('Pass@123'),
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->deleteJson('/api/v1/employees/'.$employee->id)
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
        ]);
    }

    public function test_can_delete_unused_employee_without_history(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $employee = Employee::create([
            'employee_code' => 'NV-FREE-01',
            'full_name' => 'Nhan vien Chua Co Du Lieu',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->deleteJson('/api/v1/employees/'.$employee->id)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseMissing('employees', [
            'id' => $employee->id,
        ]);
    }

    public function test_audit_logs_are_recorded_for_employee_actions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Create
        $resCreate = $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Nhan vien Kiem Toan',
            ]);
        $empId = $resCreate->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'employees',
            'action' => 'create',
            'record_id' => (string) $empId,
        ]);

        // Update
        $this->authenticate($admin)
            ->putJson('/api/v1/employees/'.$empId, [
                'department' => 'Khoa Mắt',
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'employees',
            'action' => 'update',
            'record_id' => (string) $empId,
        ]);

        // Status Update
        $this->authenticate($admin)
            ->patchJson('/api/v1/employees/'.$empId.'/status', [
                'status' => 'INACTIVE',
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'employees',
            'action' => 'status_update',
            'record_id' => (string) $empId,
        ]);

        // Delete
        $this->authenticate($admin)
            ->deleteJson('/api/v1/employees/'.$empId);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'employees',
            'action' => 'delete',
            'record_id' => (string) $empId,
        ]);
    }
}
