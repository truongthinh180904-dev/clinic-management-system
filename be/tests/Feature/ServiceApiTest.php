<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceApiTest extends TestCase
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
        $this->getJson('/api/v1/services')
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);

        $this->postJson('/api/v1/services', ['name' => 'Kham benh'])
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_inactive_user_is_forbidden_with_403(): void
    {
        $inactiveUser = $this->createUserWithRole('ADMIN', 'INACTIVE');

        $this->authenticate($inactiveUser)
            ->getJson('/api/v1/services')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_user_without_permission_cannot_access_service_endpoints(): void
    {
        // EMPLOYEE role has no services.view or services.create
        $employee = $this->createUserWithRole('EMPLOYEE');

        $this->authenticate($employee)
            ->getJson('/api/v1/services')
            ->assertStatus(403);

        $this->authenticate($employee)
            ->postJson('/api/v1/services', [
                'name' => 'Kham tong quat',
                'price' => 200000,
                'duration_minutes' => 30,
            ])
            ->assertStatus(403);
    }

    public function test_can_list_services_with_search_and_pagination(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $s1 = Service::create([
            'service_code' => 'DV000001',
            'name' => 'Kham tong quat chuyen sau',
            'description' => 'Goi kham suc khoe tong quat dinh ky',
            'price' => 350000,
            'duration_minutes' => 45,
            'status' => 'ACTIVE',
        ]);

        $s2 = Service::create([
            'service_code' => 'DV000002',
            'name' => 'Noi soi tai mui hong',
            'description' => 'Noi soi day mem khong dau',
            'price' => 250000,
            'duration_minutes' => 20,
            'status' => 'INACTIVE',
        ]);

        // 1. List all
        $response = $this->authenticate($manager)
            ->getJson('/api/v1/services')
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh mục dịch vụ thành công.',
            ])
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'service_code',
                        'name',
                        'description',
                        'price',
                        'duration_minutes',
                        'status',
                    ],
                ],
                'meta' => ['current_page', 'per_page', 'total'],
            ]);

        $this->assertCount(2, $response->json('data'));

        // 2. Search by name
        $searchResponse = $this->authenticate($manager)
            ->getJson('/api/v1/services?search=Noi+soi')
            ->assertStatus(200);

        $this->assertCount(1, $searchResponse->json('data'));
        $this->assertSame('DV000002', $searchResponse->json('data.0.service_code'));

        // 3. Search by service_code
        $codeResponse = $this->authenticate($manager)
            ->getJson('/api/v1/services?q=DV000001')
            ->assertStatus(200);

        $this->assertCount(1, $codeResponse->json('data'));
        $this->assertSame('DV000001', $codeResponse->json('data.0.service_code'));

        // 4. Filter by status
        $statusResponse = $this->authenticate($manager)
            ->getJson('/api/v1/services?status=INACTIVE')
            ->assertStatus(200);

        $this->assertCount(1, $statusResponse->json('data'));
        $this->assertSame('DV000002', $statusResponse->json('data.0.service_code'));
    }

    public function test_can_filter_services_by_price_range_and_sort(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');

        Service::create([
            'service_code' => 'DV000010',
            'name' => 'Dich vu A',
            'price' => 100000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        Service::create([
            'service_code' => 'DV000020',
            'name' => 'Dich vu B',
            'price' => 500000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        Service::create([
            'service_code' => 'DV000030',
            'name' => 'Dich vu C',
            'price' => 1000000,
            'duration_minutes' => 60,
            'status' => 'ACTIVE',
        ]);

        // Filter min_price & max_price
        $priceFiltered = $this->authenticate($viewer)
            ->getJson('/api/v1/services?min_price=200000&max_price=800000')
            ->assertStatus(200);

        $this->assertCount(1, $priceFiltered->json('data'));
        $this->assertSame('DV000020', $priceFiltered->json('data.0.service_code'));

        // Sort by price desc
        $sortedDesc = $this->authenticate($viewer)
            ->getJson('/api/v1/services?sort_by=price&order=desc')
            ->assertStatus(200);

        $this->assertSame('DV000030', $sortedDesc->json('data.0.service_code'));
        $this->assertSame('DV000010', $sortedDesc->json('data.2.service_code'));
    }

    public function test_manager_can_create_service_with_custom_code(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $payload = [
            'service_code' => 'DV-CUSTOM-99',
            'name' => 'Sieu am mau Doppler tim',
            'description' => 'Khao sat dong chay tim mau',
            'price' => 450000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ];

        $response = $this->authenticate($manager)
            ->postJson('/api/v1/services', $payload)
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo dịch vụ mới thành công.',
                'data' => [
                    'service_code' => 'DV-CUSTOM-99',
                    'name' => 'Sieu am mau Doppler tim',
                    'price' => 450000,
                    'duration_minutes' => 30,
                    'status' => 'ACTIVE',
                ],
            ]);

        $this->assertDatabaseHas('services', [
            'service_code' => 'DV-CUSTOM-99',
            'name' => 'Sieu am mau Doppler tim',
        ]);

        $createdServiceId = $response->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'services',
            'action' => 'create',
            'table_name' => 'services',
            'record_id' => (string) $createdServiceId,
        ]);
    }

    public function test_service_code_is_automatically_generated_if_omitted(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $payload = [
            'name' => 'Chup X-Quang nguc thang',
            'price' => 180000,
            'duration_minutes' => 15,
        ];

        $res1 = $this->authenticate($admin)
            ->postJson('/api/v1/services', $payload)
            ->assertStatus(201);

        $code1 = $res1->json('data.service_code');
        $this->assertMatchesRegularExpression('/^DV\d{6}$/', $code1);
        $this->assertSame('ACTIVE', $res1->json('data.status'));

        // Next creation gets incremented code
        $res2 = $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'name' => 'Chup X-Quang cot song',
                'price' => 200000,
                'duration_minutes' => 20,
            ])
            ->assertStatus(201);

        $code2 = $res2->json('data.service_code');
        $this->assertNotSame($code1, $code2);
    }

    public function test_create_service_validates_required_fields(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/services', [])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.',
            ])
            ->assertJsonValidationErrors(['name', 'price', 'duration_minutes']);
    }

    public function test_create_service_validates_price_cannot_be_negative(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Negative price rejected
        $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'name' => 'Test Service',
                'price' => -50000,
                'duration_minutes' => 30,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['price']);

        // Zero price is allowed (e.g. Free consultation)
        $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'name' => 'Tu van mien phi',
                'price' => 0,
                'duration_minutes' => 15,
            ])
            ->assertStatus(201)
            ->assertJson([
                'data' => [
                    'price' => 0,
                ],
            ]);
    }

    public function test_create_service_validates_duration_minutes_must_be_greater_than_zero(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Zero duration rejected
        $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'name' => 'Test Duration',
                'price' => 100000,
                'duration_minutes' => 0,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['duration_minutes']);

        // Negative duration rejected
        $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'name' => 'Test Duration Negative',
                'price' => 100000,
                'duration_minutes' => -5,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['duration_minutes']);
    }

    public function test_create_service_validates_unique_service_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        Service::create([
            'service_code' => 'DV000999',
            'name' => 'Dich vu hien tai',
            'price' => 100000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'service_code' => 'DV000999',
                'name' => 'Dich vu moi trung ma',
                'price' => 150000,
                'duration_minutes' => 20,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['service_code']);
    }

    public function test_create_service_validates_status_enum(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'name' => 'Dich vu test status',
                'price' => 100000,
                'duration_minutes' => 15,
                'status' => 'UNKNOWN_STATUS',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_can_show_service_detail_and_returns_404_if_not_found(): void
    {
        $user = $this->createUserWithRole('DOCTOR');

        $service = Service::create([
            'service_code' => 'DV000050',
            'name' => 'Dien tam do ECG',
            'description' => 'Do dien tim 12 chuyen dao',
            'price' => 120000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        // Success 200
        $this->authenticate($user)
            ->getJson("/api/v1/services/{$service->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy thông tin chi tiết dịch vụ thành công.',
                'data' => [
                    'id' => $service->id,
                    'service_code' => 'DV000050',
                    'name' => 'Dien tam do ECG',
                    'price' => 120000,
                    'duration_minutes' => 15,
                ],
            ]);

        // Not found 404
        $this->authenticate($user)
            ->getJson('/api/v1/services/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin dịch vụ.',
            ]);
    }

    public function test_can_update_service_successfully(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $service = Service::create([
            'service_code' => 'DV000077',
            'name' => 'Ten goc',
            'price' => 100000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        $updatePayload = [
            'service_code' => 'DV000077', // keeping own code
            'name' => 'Ten da duoc cap nhat',
            'price' => 150000,
            'duration_minutes' => 25,
            'status' => 'ACTIVE',
        ];

        $response = $this->authenticate($manager)
            ->putJson("/api/v1/services/{$service->id}", $updatePayload)
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật dịch vụ thành công.',
                'data' => [
                    'name' => 'Ten da duoc cap nhat',
                    'price' => 150000,
                    'duration_minutes' => 25,
                ],
            ]);

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
            'name' => 'Ten da duoc cap nhat',
            'price' => 150000,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'services',
            'action' => 'update',
            'table_name' => 'services',
            'record_id' => (string) $service->id,
        ]);
    }

    public function test_update_service_validates_duplicate_code_with_another_service(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        Service::create([
            'service_code' => 'DV000001',
            'name' => 'Dich vu 1',
            'price' => 100000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        $service2 = Service::create([
            'service_code' => 'DV000002',
            'name' => 'Dich vu 2',
            'price' => 200000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        // Try to update service2 code to DV000001
        $this->authenticate($manager)
            ->patchJson("/api/v1/services/{$service2->id}", [
                'service_code' => 'DV000001',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['service_code']);
    }

    public function test_can_update_service_status(): void
    {
        $manager = $this->createUserWithRole('MANAGER');

        $service = Service::create([
            'service_code' => 'DV000088',
            'name' => 'Dich vu doi status',
            'price' => 200000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($manager)
            ->patchJson("/api/v1/services/{$service->id}/status", [
                'status' => 'INACTIVE',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật trạng thái dịch vụ thành công.',
                'data' => [
                    'status' => 'INACTIVE',
                ],
            ]);

        $this->assertSame('INACTIVE', $service->fresh()->status);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'services',
            'action' => 'update_status',
            'table_name' => 'services',
            'record_id' => (string) $service->id,
        ]);
    }

    public function test_can_delete_service_without_historical_data(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $service = Service::create([
            'service_code' => 'DV-UNUSED-01',
            'name' => 'Dich vu chua tung su dung',
            'price' => 300000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/services/{$service->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa dịch vụ thành công.',
                'data' => null,
            ]);

        $this->assertDatabaseMissing('services', [
            'id' => $service->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'services',
            'action' => 'delete',
            'table_name' => 'services',
            'record_id' => (string) $service->id,
        ]);
    }

    public function test_cannot_delete_service_with_past_appointments(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $doctor = Employee::create([
            'employee_code' => 'NV999911',
            'full_name' => 'Doctor Appointment Test',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-WITH-APT',
            'name' => 'Dich vu da co lich hen',
            'price' => 250000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN000099',
            'full_name' => 'Bệnh nhân Test',
            'status' => 'ACTIVE',
        ]);

        Appointment::create([
            'appointment_code' => 'LH000099',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-10-30',
            'start_time' => '09:00:00',
            'end_time' => '09:30:00',
            'status' => 'CONFIRMED',
            'created_by' => $admin->id,
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/services/{$service->id}")
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
        ]);
    }

    public function test_cannot_delete_service_with_past_visits(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $doctor = Employee::create([
            'employee_code' => 'NV999912',
            'full_name' => 'Doctor Visit Test',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-WITH-VISIT',
            'name' => 'Dich vu da tung kham',
            'price' => 300000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN000098',
            'full_name' => 'Bệnh nhân Lượt Khám',
            'status' => 'ACTIVE',
        ]);

        Visit::create([
            'visit_code' => 'LK000099',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $admin->id,
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/services/{$service->id}")
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
        ]);
    }

    public function test_cannot_delete_service_bundled_in_packages(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $service = Service::create([
            'service_code' => 'DV-IN-PACKAGE',
            'name' => 'Dich vu trong goi',
            'price' => 200000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI000001',
            'name' => 'Goi kham suc khoe A',
            'price' => 1500000,
            'total_sessions' => 5,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $package->services()->attach($service->id, [
            'quantity' => 5,
            'created_at' => now(),
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/services/{$service->id}")
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
        ]);
    }

    public function test_delete_non_existent_service_returns_404(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $this->authenticate($admin)
            ->deleteJson('/api/v1/services/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy dịch vụ để xóa.',
            ]);
    }
}
