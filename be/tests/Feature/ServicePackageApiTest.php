<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServicePackageApiTest extends TestCase
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

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $this->getJson('/api/v1/service-packages')
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);

        $this->postJson('/api/v1/service-packages', ['name' => 'Goi cham soc rang mieng'])
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_inactive_user_is_forbidden_with_403(): void
    {
        $inactiveUser = $this->createUserWithRole('ADMIN', 'INACTIVE');

        $this->authenticate($inactiveUser)
            ->getJson('/api/v1/service-packages')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_user_without_permission_cannot_access_service_package_endpoints(): void
    {
        $employee = $this->createUserWithRole('EMPLOYEE');

        $this->authenticate($employee)
            ->getJson('/api/v1/service-packages')
            ->assertStatus(403);

        $this->authenticate($employee)
            ->postJson('/api/v1/service-packages', [
                'name' => 'Goi Kham VIP',
                'price' => 1500000,
                'total_sessions' => 5,
                'validity_days' => 180,
            ])
            ->assertStatus(403);
    }

    public function test_can_list_service_packages_with_search_and_pagination(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $pkg1 = ServicePackage::create([
            'package_code' => 'PKG000001',
            'name' => 'Goi kham tong quat chuyen sau 5 buoi',
            'description' => 'Tam soat suc khoe dinh ky toan dien',
            'price' => 2500000,
            'total_sessions' => 5,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ]);

        $pkg2 = ServicePackage::create([
            'package_code' => 'PKG000002',
            'name' => 'Goi nha khoa tham my 3 buoi',
            'description' => 'Tay trang rang va ve sinh rang mieng',
            'price' => 1200000,
            'total_sessions' => 3,
            'validity_days' => 90,
            'status' => 'INACTIVE',
        ]);

        // Search by keyword in name
        $response = $this->authenticate($manager)
            ->getJson('/api/v1/service-packages?search=nha+khoa')
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh mục gói dịch vụ thành công.',
            ]);

        $this->assertCount(1, $response->json('data'));
        $this->assertSame($pkg2->id, $response->json('data.0.id'));

        // Search by code
        $resCode = $this->authenticate($manager)
            ->getJson('/api/v1/service-packages?search=PKG000001')
            ->assertStatus(200);

        $this->assertCount(1, $resCode->json('data'));
        $this->assertSame($pkg1->id, $resCode->json('data.0.id'));
    }

    public function test_can_filter_service_packages_by_status(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        ServicePackage::create([
            'package_code' => 'PKG000011',
            'name' => 'Goi A',
            'price' => 1000000,
            'total_sessions' => 3,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        ServicePackage::create([
            'package_code' => 'PKG000012',
            'name' => 'Goi B',
            'price' => 2000000,
            'total_sessions' => 5,
            'validity_days' => 120,
            'status' => 'INACTIVE',
        ]);

        $response = $this->authenticate($manager)
            ->getJson('/api/v1/service-packages?status=ACTIVE')
            ->assertStatus(200);

        $items = $response->json('data');
        $this->assertNotEmpty($items);
        foreach ($items as $item) {
            $this->assertSame('ACTIVE', $item['status']);
        }
    }

    public function test_can_filter_service_packages_by_price_and_sessions_range(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        ServicePackage::create([
            'package_code' => 'PKG000021',
            'name' => 'Goi re',
            'price' => 500000,
            'total_sessions' => 2,
            'validity_days' => 30,
            'status' => 'ACTIVE',
        ]);

        ServicePackage::create([
            'package_code' => 'PKG000022',
            'name' => 'Goi trung binh',
            'price' => 1500000,
            'total_sessions' => 5,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        ServicePackage::create([
            'package_code' => 'PKG000023',
            'name' => 'Goi cao cap',
            'price' => 5000000,
            'total_sessions' => 10,
            'validity_days' => 365,
            'status' => 'ACTIVE',
        ]);

        $res = $this->authenticate($manager)
            ->getJson('/api/v1/service-packages?min_price=1000000&max_price=3000000&min_sessions=3&max_sessions=6')
            ->assertStatus(200);

        $this->assertCount(1, $res->json('data'));
        $this->assertSame('PKG000022', $res->json('data.0.package_code'));
    }

    public function test_can_sort_service_packages(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        ServicePackage::create([
            'package_code' => 'PKG000031',
            'name' => 'Goi A Gia Thap',
            'price' => 300000,
            'total_sessions' => 2,
            'validity_days' => 30,
            'status' => 'ACTIVE',
        ]);

        ServicePackage::create([
            'package_code' => 'PKG000032',
            'name' => 'Goi B Gia Cao',
            'price' => 9000000,
            'total_sessions' => 20,
            'validity_days' => 365,
            'status' => 'ACTIVE',
        ]);

        $resAsc = $this->authenticate($manager)
            ->getJson('/api/v1/service-packages?sort_by=price&order=asc')
            ->assertStatus(200);

        $prices = array_column($resAsc->json('data'), 'price');
        $sortedPrices = $prices;
        sort($sortedPrices);
        $this->assertSame($sortedPrices, $prices);
    }

    public function test_can_create_service_package_with_auto_generated_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $payload = [
            'name' => 'Goi Phuc Hoi Chuc Nang 10 Buoi',
            'description' => 'Goi vat ly tri lieu va phuc hoi sau chan thuong',
            'price' => 3500000,
            'total_sessions' => 10,
            'validity_days' => 120,
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', $payload)
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo gói dịch vụ mới thành công.',
                'data' => [
                    'name' => 'Goi Phuc Hoi Chuc Nang 10 Buoi',
                    'price' => 3500000.0,
                    'total_sessions' => 10,
                    'validity_days' => 120,
                    'status' => 'ACTIVE',
                ],
            ]);

        $packageCode = $response->json('data.package_code');
        $this->assertNotEmpty($packageCode);
        $this->assertMatchesRegularExpression('/^PKG\d{6}$/', $packageCode);

        $this->assertDatabaseHas('service_packages', [
            'id' => $response->json('data.id'),
            'package_code' => $packageCode,
            'name' => 'Goi Phuc Hoi Chuc Nang 10 Buoi',
            'status' => 'ACTIVE',
        ]);
    }

    public function test_can_create_service_package_with_explicit_unique_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $payload = [
            'package_code' => 'PKG-VIP-999',
            'name' => 'Goi Tam Soat VIP Platinum',
            'description' => 'Goi cham soc toan dien nhat',
            'price' => 15000000,
            'total_sessions' => 12,
            'validity_days' => 365,
            'status' => 'ACTIVE',
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', $payload)
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'package_code' => 'PKG-VIP-999',
                    'name' => 'Goi Tam Soat VIP Platinum',
                    'price' => 15000000.0,
                    'total_sessions' => 12,
                    'validity_days' => 365,
                ],
            ]);

        $this->assertDatabaseHas('service_packages', [
            'package_code' => 'PKG-VIP-999',
        ]);
    }

    public function test_creation_fails_when_package_code_is_duplicated(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        ServicePackage::create([
            'package_code' => 'PKG-EXISTING',
            'name' => 'Goi hien co',
            'price' => 1000000,
            'total_sessions' => 5,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $payload = [
            'package_code' => 'PKG-EXISTING',
            'name' => 'Goi trung ma',
            'price' => 2000000,
            'total_sessions' => 6,
            'validity_days' => 100,
        ];

        $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['package_code'])
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_creation_fails_with_invalid_pricing_or_sessions_or_validity(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Negative price, 0 total_sessions, 0 validity_days
        $payload = [
            'name' => 'Goi Khong Hop Le',
            'price' => -50000,
            'total_sessions' => 0,
            'validity_days' => 0,
        ];

        $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['price', 'total_sessions', 'validity_days']);
    }

    public function test_creation_fails_when_name_is_missing(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $payload = [
            'price' => 1000000,
            'total_sessions' => 5,
            'validity_days' => 90,
        ];

        $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_can_view_service_package_details_including_counts(): void
    {
        $viewer = $this->createUserWithPermissions(['service_packages.view']);

        $package = ServicePackage::create([
            'package_code' => 'PKG000040',
            'name' => 'Goi Tam Soat Suc Khoe',
            'description' => 'Mo ta chi tiet goi tam soat',
            'price' => 2000000,
            'total_sessions' => 4,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV000099',
            'name' => 'Sieu am tong quat',
            'price' => 500000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $package->services()->attach($service->id, ['quantity' => 2, 'created_at' => now()]);

        $this->authenticate($viewer)
            ->getJson("/api/v1/service-packages/{$package->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $package->id,
                    'package_code' => 'PKG000040',
                    'name' => 'Goi Tam Soat Suc Khoe',
                    'price' => 2000000.0,
                    'total_sessions' => 4,
                    'validity_days' => 90,
                    'status' => 'ACTIVE',
                    'services_count' => 1,
                    'package_services_count' => 1,
                    'patient_packages_count' => 0,
                ],
            ]);
    }

    public function test_viewing_nonexistent_service_package_returns_404(): void
    {
        $viewer = $this->createUserWithPermissions(['service_packages.view']);

        $this->authenticate($viewer)
            ->getJson('/api/v1/service-packages/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ.',
            ]);
    }

    public function test_can_update_service_package_information(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $package = ServicePackage::create([
            'package_code' => 'PKG000050',
            'name' => 'Goi Chuan',
            'description' => 'Mo ta ban dau',
            'price' => 1000000,
            'total_sessions' => 3,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        $updateData = [
            'name' => 'Goi Chuan Nang Cap',
            'description' => 'Mo ta da cap nhat',
            'price' => 1200000,
            'total_sessions' => 4,
            'validity_days' => 90,
        ];

        $this->authenticate($manager)
            ->putJson("/api/v1/service-packages/{$package->id}", $updateData)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật gói dịch vụ thành công.',
                'data' => [
                    'name' => 'Goi Chuan Nang Cap',
                    'price' => 1200000.0,
                    'total_sessions' => 4,
                    'validity_days' => 90,
                ],
            ]);

        $this->assertDatabaseHas('service_packages', [
            'id' => $package->id,
            'name' => 'Goi Chuan Nang Cap',
            'price' => 1200000.00,
            'total_sessions' => 4,
            'validity_days' => 90,
        ]);
    }

    public function test_can_update_service_package_status(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $package = ServicePackage::create([
            'package_code' => 'PKG000060',
            'name' => 'Goi can khoa',
            'price' => 800000,
            'total_sessions' => 2,
            'validity_days' => 30,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($manager)
            ->patchJson("/api/v1/service-packages/{$package->id}/status", [
                'status' => 'INACTIVE',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật trạng thái gói dịch vụ thành công.',
                'data' => [
                    'status' => 'INACTIVE',
                ],
            ]);

        $this->assertDatabaseHas('service_packages', [
            'id' => $package->id,
            'status' => 'INACTIVE',
        ]);
    }

    public function test_update_status_fails_with_invalid_status(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $package = ServicePackage::create([
            'package_code' => 'PKG000061',
            'name' => 'Goi kiem tra status',
            'price' => 800000,
            'total_sessions' => 2,
            'validity_days' => 30,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($manager)
            ->patchJson("/api/v1/service-packages/{$package->id}/status", [
                'status' => 'UNKNOWN_STATUS',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_update_allows_keeping_same_package_code(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $package = ServicePackage::create([
            'package_code' => 'PKG-SAME-CODE',
            'name' => 'Goi giu nguyen ma',
            'price' => 1000000,
            'total_sessions' => 3,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($manager)
            ->putJson("/api/v1/service-packages/{$package->id}", [
                'package_code' => 'PKG-SAME-CODE',
                'name' => 'Goi doi ten nhung giu ma',
                'price' => 1100000,
                'total_sessions' => 3,
                'validity_days' => 60,
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'package_code' => 'PKG-SAME-CODE',
                    'name' => 'Goi doi ten nhung giu ma',
                ],
            ]);
    }

    public function test_update_fails_when_package_code_conflicts_with_another_package(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        ServicePackage::create([
            'package_code' => 'PKG-FIRST',
            'name' => 'Goi 1',
            'price' => 1000000,
            'total_sessions' => 3,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        $package2 = ServicePackage::create([
            'package_code' => 'PKG-SECOND',
            'name' => 'Goi 2',
            'price' => 2000000,
            'total_sessions' => 5,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($manager)
            ->putJson("/api/v1/service-packages/{$package2->id}", [
                'package_code' => 'PKG-FIRST',
                'name' => 'Goi 2 doi ma thanh Goi 1',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['package_code']);
    }

    /**
     * CRITICAL ACCEPTANCE CRITERIA:
     * Cập nhật giá gói danh mục không làm thay đổi trường price của các bản ghi patient_packages đã cấp trước đó.
     */
    public function test_updating_catalog_package_price_preserves_historical_price_in_patient_packages(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        // Step 1: Create catalog service package with original price 2,500,000 VND
        $package = ServicePackage::create([
            'package_code' => 'PKG-HIST-01',
            'name' => 'Goi Cham Soc Co Dinh Gia',
            'price' => 2500000,
            'total_sessions' => 10,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ]);

        // Step 2: Patient purchases the package at original price 2,500,000 VND
        $patient = Patient::create([
            'patient_code' => 'BN000099',
            'full_name' => 'Nguyen Van A',
            'phone' => '0987654321',
            'status' => 'ACTIVE',
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(180)->toDateString(),
            'total_sessions' => 10,
            'used_sessions' => 0,
            'remaining_sessions' => 10,
            'price' => 2500000.00,
            'status' => 'ACTIVE',
        ]);

        $this->assertEquals('2500000.00', (string) $patientPackage->fresh()->price);

        // Step 3: Admin/Manager updates catalog package price to 3,200,000 VND
        $this->authenticate($manager)
            ->putJson("/api/v1/service-packages/{$package->id}", [
                'name' => 'Goi Cham Soc Co Dinh Gia (Bang gia moi)',
                'price' => 3200000,
                'total_sessions' => 10,
                'validity_days' => 180,
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'price' => 3200000.0,
                ],
            ]);

        // Verify catalog service package was updated
        $this->assertEquals('3200000.00', (string) $package->fresh()->price);

        // Verify existing patient package still maintains its original historical price of 2,500,000 VND
        $freshPatientPackage = $patientPackage->fresh();
        $this->assertEquals('2500000.00', (string) $freshPatientPackage->price);
        $this->assertNotEquals($package->fresh()->price, $freshPatientPackage->price);
    }

    public function test_can_delete_unused_service_package(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $package = ServicePackage::create([
            'package_code' => 'PKG000070',
            'name' => 'Goi tam thoi de xoa',
            'price' => 500000,
            'total_sessions' => 1,
            'validity_days' => 15,
            'status' => 'INACTIVE',
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$package->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa gói dịch vụ thành công.',
                'data' => null,
            ]);

        $this->assertDatabaseMissing('service_packages', [
            'id' => $package->id,
        ]);
    }

    public function test_cannot_delete_service_package_assigned_to_patient(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $package = ServicePackage::create([
            'package_code' => 'PKG000080',
            'name' => 'Goi da ban cho benh nhan',
            'price' => 1500000,
            'total_sessions' => 5,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN000088',
            'full_name' => 'Tran Thi B',
            'phone' => '0912345678',
            'status' => 'ACTIVE',
        ]);

        PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
            'price' => 1500000,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$package->id}")
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể xóa gói dịch vụ đã có bệnh nhân mua hoặc đã cấu hình dịch vụ thành phần. Vui lòng chuyển trạng thái sang INACTIVE để ngừng áp dụng mà vẫn bảo toàn lịch sử.',
                'errors' => [
                    'patient_packages_count' => 1,
                ],
            ]);

        $this->assertDatabaseHas('service_packages', [
            'id' => $package->id,
        ]);
    }

    public function test_cannot_delete_service_package_having_configured_services(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $package = ServicePackage::create([
            'package_code' => 'PKG000085',
            'name' => 'Goi co dich vu con',
            'price' => 2000000,
            'total_sessions' => 4,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV000085',
            'name' => 'Dich vu thanh phan',
            'price' => 500000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $package->services()->attach($service->id, ['quantity' => 4, 'created_at' => now()]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$package->id}")
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể xóa gói dịch vụ đã có bệnh nhân mua hoặc đã cấu hình dịch vụ thành phần. Vui lòng chuyển trạng thái sang INACTIVE để ngừng áp dụng mà vẫn bảo toàn lịch sử.',
                'errors' => [
                    'package_services_count' => 1,
                ],
            ]);

        $this->assertDatabaseHas('service_packages', [
            'id' => $package->id,
        ]);
    }

    public function test_service_package_operations_generate_audit_logs(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // 1. Create operation creates audit log
        $res = $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', [
                'name' => 'Goi Kiem Toan',
                'price' => 1000000,
                'total_sessions' => 3,
                'validity_days' => 60,
            ])
            ->assertStatus(201);

        $packageId = (string) $res->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'create',
            'table_name' => 'service_packages',
            'record_id' => $packageId,
        ]);

        // 2. Update operation creates audit log
        $this->authenticate($admin)
            ->putJson("/api/v1/service-packages/{$packageId}", [
                'name' => 'Goi Kiem Toan Cap Nhat',
                'price' => 1200000,
                'total_sessions' => 4,
                'validity_days' => 90,
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'update',
            'table_name' => 'service_packages',
            'record_id' => $packageId,
        ]);

        // 3. Update status creates audit log
        $this->authenticate($admin)
            ->patchJson("/api/v1/service-packages/{$packageId}/status", [
                'status' => 'LOCKED',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'update_status',
            'table_name' => 'service_packages',
            'record_id' => $packageId,
        ]);

        // 4. Delete creates audit log
        $this->authenticate($admin)
            ->deleteJson("/api/v1/service-packages/{$packageId}")
            ->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'service_packages',
            'action' => 'delete',
            'table_name' => 'service_packages',
            'record_id' => $packageId,
        ]);
    }
}
