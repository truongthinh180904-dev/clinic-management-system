<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PackageServiceConfigApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create a user with a specific role.
     */
    protected function createUserWithRole(string $roleName, string $status = 'ACTIVE'): User
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
     * Helper to create a user with specific permissions.
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
     * Authenticate a user via Sanctum token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withToken($token);
    }

    /**
     * Helper to create a sample service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Dịch vụ '.fake()->words(2, true),
            'description' => 'Mô tả dịch vụ thử nghiệm',
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a sample service package.
     */
    protected function createPackage(array $attributes = []): ServicePackage
    {
        return ServicePackage::create(array_merge([
            'package_code' => 'PKG'.fake()->unique()->numerify('######'),
            'name' => 'Gói dịch vụ '.fake()->words(3, true),
            'description' => 'Mô tả gói dịch vụ thử nghiệm',
            'price' => 1500000,
            'total_sessions' => 10,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $package = $this->createPackage();
        $service = $this->createService();

        $this->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(401)
            ->assertJson(['success' => false]);

        $this->postJson("/api/v1/service-packages/{$package->id}/services", [
            'service_id' => $service->id,
            'quantity' => 1,
        ])
            ->assertStatus(401)
            ->assertJson(['success' => false]);

        $this->putJson("/api/v1/service-packages/{$package->id}/services/{$service->id}", [
            'quantity' => 2,
        ])
            ->assertStatus(401)
            ->assertJson(['success' => false]);

        $this->deleteJson("/api/v1/service-packages/{$package->id}/services/{$service->id}")
            ->assertStatus(401)
            ->assertJson(['success' => false]);
    }

    public function test_inactive_user_is_forbidden_with_403(): void
    {
        $inactiveUser = $this->createUserWithRole('ADMIN', 'INACTIVE');
        $package = $this->createPackage();

        $this->authenticate($inactiveUser)
            ->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    public function test_user_without_permission_cannot_access_package_services(): void
    {
        $employee = $this->createUserWithRole('EMPLOYEE');
        $package = $this->createPackage();

        $this->authenticate($employee)
            ->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(403);
    }

    public function test_doctor_can_view_services_in_package_but_cannot_modify(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $package = $this->createPackage();
        $service = $this->createService();

        // Doctor has service_packages.view -> can list services
        $this->authenticate($doctor)
            ->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        // Doctor does not have service_packages.update or create -> cannot add service
        $this->authenticate($doctor)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 2,
            ])
            ->assertStatus(403);

        // Doctor cannot update
        $this->authenticate($doctor)
            ->putJson("/api/v1/service-packages/{$package->id}/services/{$service->id}", [
                'quantity' => 3,
            ])
            ->assertStatus(403);

        // Doctor cannot delete
        $this->authenticate($doctor)
            ->deleteJson("/api/v1/service-packages/{$package->id}/services/{$service->id}")
            ->assertStatus(403);
    }

    public function test_returns_404_when_package_does_not_exist(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $service = $this->createService();

        $this->authenticate($admin)
            ->getJson('/api/v1/service-packages/999999/services')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
            ]);

        $this->authenticate($admin)
            ->postJson('/api/v1/service-packages/999999/services', [
                'service_id' => $service->id,
                'quantity' => 1,
            ])
            ->assertStatus(404);

        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/999999/services/{$service->id}", [
                'quantity' => 2,
            ])
            ->assertStatus(404);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/999999/services/{$service->id}")
            ->assertStatus(404);
    }

    public function test_can_list_empty_package_services(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh sách dịch vụ trong gói thành công.',
                'data' => [],
                'meta' => [
                    'package_id' => $package->id,
                    'total_services' => 0,
                    'total_quantity' => 0,
                ],
            ]);

        $this->assertCount(0, $response->json('data'));
    }

    public function test_can_list_configured_services_in_package(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $s1 = $this->createService(['name' => 'Khám tổng quát', 'price' => 100000]);
        $s2 = $this->createService(['name' => 'Lấy cao răng', 'price' => 150000]);

        DB::table('package_services')->insert([
            ['package_id' => $package->id, 'service_id' => $s1->id, 'quantity' => 2, 'created_at' => now()],
            ['package_id' => $package->id, 'service_id' => $s2->id, 'quantity' => 5, 'created_at' => now()],
        ]);

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'meta' => [
                    'package_id' => $package->id,
                    'total_services' => 2,
                    'total_quantity' => 7,
                ],
            ]);

        $data = $response->json('data');
        $this->assertCount(2, $data);
        $this->assertEquals($s1->id, $data[0]['service_id']);
        $this->assertEquals(2, $data[0]['quantity']);
        $this->assertEquals('Khám tổng quát', $data[0]['service_name']);
        $this->assertEquals($s2->id, $data[1]['service_id']);
        $this->assertEquals(5, $data[1]['quantity']);
        $this->assertEquals('Lấy cao răng', $data[1]['service_name']);
    }

    public function test_can_add_single_service_to_package_with_quantity(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        $response = $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 3,
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Thêm dịch vụ vào gói thành công.',
                'data' => [
                    'package_id' => $package->id,
                    'service_id' => $service->id,
                    'quantity' => 3,
                ],
            ]);

        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 3,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'add_package_service',
            'table_name' => 'package_services',
            'record_id' => (string) $package->id,
        ]);
    }

    public function test_defaults_quantity_to_1_when_quantity_omitted_on_create(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        $response = $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'package_id' => $package->id,
                    'service_id' => $service->id,
                    'quantity' => 1,
                ],
            ]);

        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 1,
        ]);
    }

    public function test_cannot_add_duplicate_service_to_package_returns_conflict_409(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        // Attach first time
        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 2,
            'created_at' => now(),
        ]);

        // Attempt duplicate attach
        $response = $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 4,
            ]);

        $this->assertTrue(
            in_array($response->status(), [409, 422], true),
            'Response status must be 409 Conflict or 422 Unprocessable Entity for duplicates.'
        );

        $response->assertJson([
            'success' => false,
        ]);

        // Verify database still only has 1 record with original quantity 2
        $count = DB::table('package_services')
            ->where('package_id', $package->id)
            ->where('service_id', $service->id)
            ->count();
        $this->assertEquals(1, $count);

        $record = DB::table('package_services')
            ->where('package_id', $package->id)
            ->where('service_id', $service->id)
            ->first();
        $this->assertEquals(2, $record->quantity);
    }

    public function test_validates_quantity_must_be_at_least_1_on_create(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        // Quantity 0
        $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 0,
            ])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        // Quantity negative
        $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => -5,
            ])
            ->assertStatus(422);

        // Quantity non-integer string
        $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 'invalid',
            ])
            ->assertStatus(422);
    }

    public function test_validates_service_id_must_exist(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();

        $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => 999999,
                'quantity' => 1,
            ])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_can_update_service_quantity_via_nested_route(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 2,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$package->id}/services/{$service->id}", [
                'quantity' => 8,
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật số lượng dịch vụ trong gói thành công.',
                'data' => [
                    'package_id' => $package->id,
                    'service_id' => $service->id,
                    'quantity' => 8,
                ],
            ]);

        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 8,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'update_package_service_quantity',
            'table_name' => 'package_services',
            'record_id' => (string) $package->id,
        ]);
    }

    public function test_can_update_service_quantity_via_body_service_id(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 2,
            'created_at' => now(),
        ]);

        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 12,
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'package_id' => $package->id,
                    'service_id' => $service->id,
                    'quantity' => 12,
                ],
            ]);

        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 12,
        ]);
    }

    public function test_validates_quantity_must_be_at_least_1_on_update(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 3,
            'created_at' => now(),
        ]);

        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$package->id}/services/{$service->id}", [
                'quantity' => 0,
            ])
            ->assertStatus(422)
            ->assertJson(['success' => false]);

        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$package->id}/services/{$service->id}", [
                'quantity' => -2,
            ])
            ->assertStatus(422);

        // Database value should remain unchanged at 3
        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 3,
        ]);
    }

    public function test_returns_404_when_updating_non_existent_service_in_package(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $otherService = $this->createService();

        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$package->id}/services/{$otherService->id}", [
                'quantity' => 5,
            ])
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy dịch vụ này trong gói để cập nhật.',
            ]);
    }

    public function test_can_delete_service_from_package_via_nested_route(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 4,
            'created_at' => now(),
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$package->id}/services/{$service->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa dịch vụ khỏi gói thành công.',
                'data' => [
                    'package_id' => $package->id,
                    'service_id' => $service->id,
                ],
            ]);

        $this->assertDatabaseMissing('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'remove_package_service',
            'table_name' => 'package_services',
            'record_id' => (string) $package->id,
        ]);
    }

    public function test_can_delete_service_from_package_via_request_body(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $service = $this->createService();

        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 4,
            'created_at' => now(),
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'package_id' => $package->id,
                    'service_id' => $service->id,
                ],
            ]);

        $this->assertDatabaseMissing('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
        ]);
    }

    public function test_returns_404_when_deleting_service_not_in_package(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $otherService = $this->createService();

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$package->id}/services/{$otherService->id}")
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy dịch vụ này trong gói để xóa.',
            ]);
    }

    public function test_can_batch_add_services_to_package(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $s1 = $this->createService();
        $s2 = $this->createService();

        $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'services' => [
                    ['service_id' => $s1->id, 'quantity' => 2],
                    ['service_id' => $s2->id, 'quantity' => 4],
                ],
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Thêm danh sách dịch vụ vào gói thành công.',
            ]);

        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $s1->id,
            'quantity' => 2,
        ]);
        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $s2->id,
            'quantity' => 4,
        ]);
    }

    public function test_batch_add_prevents_duplicates_with_409_and_rolls_back(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $s1 = $this->createService();
        $s2 = $this->createService();

        // Attach s1 first
        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $s1->id,
            'quantity' => 1,
            'created_at' => now(),
        ]);

        // Attempt batch with s1 (duplicate) and s2 (new)
        $response = $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'services' => [
                    ['service_id' => $s1->id, 'quantity' => 2],
                    ['service_id' => $s2->id, 'quantity' => 3],
                ],
            ]);

        $this->assertTrue(
            in_array($response->status(), [409, 422], true),
            'Response status must be 409 or 422 on duplicate batch item.'
        );

        // s2 should not be inserted due to transaction rollback
        $this->assertDatabaseMissing('package_services', [
            'package_id' => $package->id,
            'service_id' => $s2->id,
        ]);
    }

    public function test_can_batch_sync_services_in_package(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage();
        $s1 = $this->createService();
        $s2 = $this->createService();

        // Pre-attach s1
        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $s1->id,
            'quantity' => 2,
            'created_at' => now(),
        ]);

        // Sync with s2 only
        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$package->id}/services", [
                'services' => [
                    ['service_id' => $s2->id, 'quantity' => 5],
                ],
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Đồng bộ danh sách dịch vụ trong gói thành công.',
            ]);

        // s1 was replaced, s2 is present
        $this->assertDatabaseMissing('package_services', [
            'package_id' => $package->id,
            'service_id' => $s1->id,
        ]);
        $this->assertDatabaseHas('package_services', [
            'package_id' => $package->id,
            'service_id' => $s2->id,
            'quantity' => 5,
        ]);
    }

    public function test_package_can_be_resolved_by_package_code_in_url(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $package = $this->createPackage(['package_code' => 'PKG998877']);
        $service = $this->createService();

        DB::table('package_services')->insert([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 3,
            'created_at' => now(),
        ]);

        $this->authenticate($admin)
            ->getJson("/api/v1/service-packages/{$package->package_code}/services")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'meta' => [
                    'package_code' => 'PKG998877',
                    'total_services' => 1,
                    'total_quantity' => 3,
                ],
            ]);
    }

    public function test_manager_with_permissions_can_perform_full_crud_flow(): void
    {
        $manager = $this->createUserWithRole('MANAGER');
        $package = $this->createPackage();
        $service = $this->createService();

        // 1. Add service
        $this->authenticate($manager)
            ->postJson("/api/v1/service-packages/{$package->id}/services", [
                'service_id' => $service->id,
                'quantity' => 2,
            ])
            ->assertStatus(201);

        // 2. List services
        $this->authenticate($manager)
            ->getJson("/api/v1/service-packages/{$package->id}/services")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'meta' => [
                    'total_services' => 1,
                    'total_quantity' => 2,
                ],
            ]);

        // 3. Update quantity
        $this->authenticate($manager)
            ->putJson("/api/v1/service-packages/{$package->id}/services/{$service->id}", [
                'quantity' => 6,
            ])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'quantity' => 6,
                ],
            ]);

        // 4. Delete service
        $this->authenticate($manager)
            ->deleteJson("/api/v1/service-packages/{$package->id}/services/{$service->id}")
            ->assertStatus(200);

        // Verify empty
        $this->assertDatabaseMissing('package_services', [
            'package_id' => $package->id,
            'service_id' => $service->id,
        ]);
    }
}
