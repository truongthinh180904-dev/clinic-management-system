<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\ServicePackage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientPackageApiTest extends TestCase
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
     * Helper to authenticate user via Sanctum token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a sample patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Văn Test',
            'date_of_birth' => '1990-05-15',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'address' => '123 Đường Test, Quận 1',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a sample service package.
     */
    protected function createServicePackage(array $attributes = []): ServicePackage
    {
        return ServicePackage::create(array_merge([
            'package_code' => 'PKG-'.fake()->unique()->numerify('#####'),
            'name' => 'Gói Chăm Sóc Da Liệu Trình 10 Buổi',
            'description' => 'Liệu trình chăm sóc và phục hồi da cao cấp',
            'price' => 2500000.00,
            'total_sessions' => 10,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    public function test_authenticated_user_with_permission_can_assign_package_to_patient(): void
    {
        $user = $this->createUserWithPermissions(['patient_packages.assign', 'patient_packages.view']);
        $patient = $this->createPatient(['status' => 'ACTIVE']);
        $package = $this->createServicePackage([
            'price' => 3000000.00,
            'total_sessions' => 8,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $package->id,
            'purchase_date' => '2026-03-01',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Cấp gói dịch vụ cho bệnh nhân thành công.',
            ])
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.package_id', $package->id)
            ->assertJsonPath('data.total_sessions', 8)
            ->assertJsonPath('data.used_sessions', 0)
            ->assertJsonPath('data.remaining_sessions', 8)
            ->assertJsonPath('data.price', 3000000)
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.purchase_date', '2026-03-01')
            ->assertJsonPath('data.expiry_date', '2026-05-30'); // 2026-03-01 + 90 days = 2026-05-30

        $this->assertDatabaseHas('patient_packages', [
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'total_sessions' => 8,
            'used_sessions' => 0,
            'remaining_sessions' => 8,
            'status' => 'ACTIVE',
        ]);
    }

    public function test_assign_package_automatically_computes_expiry_date_from_validity_days_when_purchase_date_defaults(): void
    {
        $user = $this->createUserWithRole('RECEPTIONIST');
        $patient = $this->createPatient();
        $package = $this->createServicePackage(['validity_days' => 60]);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(201);
        $today = now()->toDateString();
        $expectedExpiry = now()->addDays(60)->toDateString();

        $response->assertJsonPath('data.purchase_date', $today)
            ->assertJsonPath('data.expiry_date', $expectedExpiry);
    }

    public function test_assign_package_enforces_invariants_used_sessions_zero_and_remaining_equal_total(): void
    {
        $user = $this->createUserWithRole('MANAGER');
        $patient = $this->createPatient();
        $package = $this->createServicePackage([
            'total_sessions' => 15,
        ]);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(201);

        $patientPackage = PatientPackage::where('patient_id', $patient->id)->firstOrFail();
        $this->assertSame(15, $patientPackage->total_sessions);
        $this->assertSame(0, $patientPackage->used_sessions);
        $this->assertSame(15, $patientPackage->remaining_sessions);
        $this->assertSame($patientPackage->total_sessions, $patientPackage->used_sessions + $patientPackage->remaining_sessions);
    }

    public function test_price_at_assignment_time_is_immutable_when_catalog_price_changes(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();
        $package = $this->createServicePackage([
            'price' => 1200000.00,
        ]);

        // 1. Assign package at price 1,200,000
        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $package->id,
        ]);
        $response->assertStatus(201);
        $assignedId = $response->json('data.id');

        $assignedRecord = PatientPackage::findOrFail($assignedId);
        $this->assertEquals(1200000.00, (float) $assignedRecord->price);

        // 2. Change package price in catalog to 2,000,000
        $package->price = 2000000.00;
        $package->save();

        // 3. Assigned patient package must retain the original locked price of 1,200,000
        $assignedRecord->refresh();
        $this->assertEquals(1200000.00, (float) $assignedRecord->price);

        // Also check via GET /api/v1/patient-packages/{id}
        $detailResponse = $this->authenticate($user)->getJson("/api/v1/patient-packages/{$assignedId}");
        $detailResponse->assertStatus(200)
            ->assertJsonPath('data.price', 1200000);
    }

    public function test_cannot_assign_package_to_inactive_patient(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $inactivePatient = $this->createPatient(['status' => 'INACTIVE']);
        $package = $this->createServicePackage(['status' => 'ACTIVE']);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$inactivePatient->id}/packages", [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_cannot_assign_package_to_locked_patient(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $lockedPatient = $this->createPatient(['status' => 'LOCKED']);
        $package = $this->createServicePackage(['status' => 'ACTIVE']);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$lockedPatient->id}/packages", [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_cannot_assign_inactive_or_locked_package(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient(['status' => 'ACTIVE']);
        $inactivePackage = $this->createServicePackage(['status' => 'INACTIVE']);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $inactivePackage->id,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_cannot_assign_non_existent_package_to_patient(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient(['status' => 'ACTIVE']);

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => 999999,
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['package_id']]);
    }

    public function test_cannot_assign_package_to_non_existent_patient(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $package = $this->createServicePackage(['status' => 'ACTIVE']);

        $response = $this->authenticate($user)->postJson('/api/v1/patients/999999/packages', [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin bệnh nhân.',
            ]);
    }

    public function test_audit_log_is_recorded_when_package_is_assigned(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();
        $package = $this->createServicePackage();

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(201);
        $assignedId = $response->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'module' => 'service_packages',
            'action' => 'assign_package',
            'table_name' => 'patient_packages',
            'record_id' => (string) $assignedId,
        ]);
    }

    public function test_can_get_packages_assigned_to_patient_with_status_filter(): void
    {
        $user = $this->createUserWithRole('RECEPTIONIST');
        $patient = $this->createPatient();
        $packageA = $this->createServicePackage(['name' => 'Gói Trị Liệu 1']);
        $packageB = $this->createServicePackage(['name' => 'Gói Phục Hồi 2']);

        // Create 2 packages for this patient: one ACTIVE, one COMPLETED
        PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $packageA->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'total_sessions' => 5,
            'used_sessions' => 1,
            'remaining_sessions' => 4,
            'price' => 1000000.00,
            'status' => 'ACTIVE',
        ]);

        PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $packageB->id,
            'purchase_date' => now()->subDays(100)->toDateString(),
            'expiry_date' => now()->subDays(10)->toDateString(),
            'total_sessions' => 5,
            'used_sessions' => 5,
            'remaining_sessions' => 0,
            'price' => 1000000.00,
            'status' => 'COMPLETED',
        ]);

        // Get all packages for patient
        $responseAll = $this->authenticate($user)->getJson("/api/v1/patients/{$patient->id}/packages");
        $responseAll->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(2, 'data');

        // Filter by ACTIVE
        $responseActive = $this->authenticate($user)->getJson("/api/v1/patients/{$patient->id}/packages?status=ACTIVE");
        $responseActive->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'ACTIVE');

        // Filter by COMPLETED
        $responseCompleted = $this->authenticate($user)->getJson("/api/v1/patients/{$patient->id}/packages?status=COMPLETED");
        $responseCompleted->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'COMPLETED');
    }

    public function test_can_get_single_patient_package_detail_by_id(): void
    {
        $user = $this->createUserWithRole('DOCTOR');
        $patient = $this->createPatient();
        $package = $this->createServicePackage(['name' => 'Gói Chăm Sóc Độc Quyền']);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => '2026-01-10',
            'expiry_date' => '2026-07-10',
            'total_sessions' => 12,
            'used_sessions' => 3,
            'remaining_sessions' => 9,
            'price' => 4500000.00,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($user)->getJson("/api/v1/patient-packages/{$patientPackage->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $patientPackage->id,
                    'patient_id' => $patient->id,
                    'package_id' => $package->id,
                    'total_sessions' => 12,
                    'used_sessions' => 3,
                    'remaining_sessions' => 9,
                    'status' => 'ACTIVE',
                ],
            ])
            ->assertJsonPath('data.patient.id', $patient->id)
            ->assertJsonPath('data.package.name', 'Gói Chăm Sóc Độc Quyền');
    }

    public function test_get_non_existent_patient_package_returns_404(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $response = $this->authenticate($user)->getJson('/api/v1/patient-packages/999999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin gói dịch vụ của bệnh nhân.',
            ]);
    }

    public function test_can_update_patient_package_status_and_audit_log_recorded(): void
    {
        $user = $this->createUserWithRole('MANAGER');
        $patient = $this->createPatient();
        $package = $this->createServicePackage();

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'total_sessions' => 10,
            'used_sessions' => 0,
            'remaining_sessions' => 10,
            'price' => 2000000.00,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($user)->patchJson("/api/v1/patient-packages/{$patientPackage->id}/status", [
            'status' => 'CANCELLED',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật trạng thái gói dịch vụ của bệnh nhân thành công.',
                'data' => [
                    'id' => $patientPackage->id,
                    'status' => 'CANCELLED',
                ],
            ]);

        $this->assertDatabaseHas('patient_packages', [
            'id' => $patientPackage->id,
            'status' => 'CANCELLED',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'module' => 'service_packages',
            'action' => 'update_patient_package_status',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $patient = $this->createPatient();
        $response = $this->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => 1,
        ]);

        $response->assertStatus(401);
    }

    public function test_user_without_permission_cannot_assign_package(): void
    {
        $user = $this->createUserWithRole('VIEWER');
        $patient = $this->createPatient();
        $package = $this->createServicePackage();

        $response = $this->authenticate($user)->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $package->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_general_patient_packages_index_supports_search_and_pagination(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $patientA = $this->createPatient(['full_name' => 'Nguyễn Minh Anh']);
        $patientB = $this->createPatient(['full_name' => 'Trần Văn Bảo']);
        $package = $this->createServicePackage(['name' => 'Gói Trị Liệu Chuyên Sâu']);

        PatientPackage::create([
            'patient_id' => $patientA->id,
            'package_id' => $package->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'total_sessions' => 6,
            'used_sessions' => 0,
            'remaining_sessions' => 6,
            'price' => 1500000.00,
            'status' => 'ACTIVE',
        ]);

        PatientPackage::create([
            'patient_id' => $patientB->id,
            'package_id' => $package->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'total_sessions' => 6,
            'used_sessions' => 0,
            'remaining_sessions' => 6,
            'price' => 1500000.00,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($user)->getJson('/api/v1/patient-packages?search=Minh Anh');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.patient.full_name', 'Nguyễn Minh Anh');
    }
}
