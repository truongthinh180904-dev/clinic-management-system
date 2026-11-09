<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\PackageService;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use App\Models\Visit;
use App\Services\VisitService;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class VisitPackageUsageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create a test user with specific permissions.
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
            'username' => 'test_user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => $status,
        ]);

        $role = Role::create([
            'name' => 'ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Test role',
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
     * Helper to authenticate user with token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Văn Test',
            'date_of_birth' => '1992-05-10',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create an employee (doctor).
     */
    protected function createDoctor(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác Sĩ Test',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'DOCTOR',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'SRV-'.fake()->unique()->numerify('#####'),
            'name' => 'Chăm sóc da Laser Fractional',
            'description' => 'Dịch vụ liệu trình da',
            'price' => 500000.00,
            'duration_minutes' => 45,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a service package with associated services.
     *
     * @param  list<Service>  $services
     */
    protected function createPackageWithServices(array $services = [], array $packageAttributes = []): ServicePackage
    {
        $package = ServicePackage::create(array_merge([
            'package_code' => 'PKG-'.fake()->unique()->numerify('#####'),
            'name' => 'Gói Trị Liệu 5 Buổi',
            'description' => 'Liệu trình trọn gói',
            'price' => 2000000.00,
            'total_sessions' => 5,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ], $packageAttributes));

        foreach ($services as $service) {
            PackageService::create([
                'package_id' => $package->id,
                'service_id' => $service->id,
                'quantity' => 1,
                'created_at' => now(),
            ]);
        }

        return $package;
    }

    /**
     * Helper to assign package to a patient.
     */
    protected function assignPackageToPatient(
        Patient $patient,
        ServicePackage $package,
        array $attributes = []
    ): PatientPackage {
        $totalSessions = $attributes['total_sessions'] ?? $package->total_sessions;
        $usedSessions = $attributes['used_sessions'] ?? 0;
        $remainingSessions = $attributes['remaining_sessions'] ?? ($totalSessions - $usedSessions);

        return PatientPackage::create(array_merge([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays($package->validity_days)->toDateString(),
            'total_sessions' => $totalSessions,
            'used_sessions' => $usedSessions,
            'remaining_sessions' => $remainingSessions,
            'price' => $package->price,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    // ==========================================
    // 1. DEDUCTION ON VISIT CREATION & INVARIANT
    // ==========================================

    public function test_can_create_visit_using_patient_package_and_deducts_session_maintaining_invariant(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
            'unit_price' => 500000.00,
            'discount_amount' => 0.0,
            'status' => 'SCHEDULED',
            'payment_status' => 'PAID',
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient_package_id', $patientPackage->id);

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(4, $patientPackage->remaining_sessions);
        $this->assertEquals('ACTIVE', $patientPackage->status);

        // Acceptance Criterion 1: Invariant used_sessions + remaining_sessions == total_sessions
        $this->assertEquals(
            $patientPackage->total_sessions,
            $patientPackage->used_sessions + $patientPackage->remaining_sessions
        );

        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'visits',
            'action' => 'deduct_package_session',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
        ]);
    }

    public function test_can_deduct_multiple_sessions_for_higher_visit_quantity(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 6]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 6,
            'used_sessions' => 0,
            'remaining_sessions' => 6,
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 3,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(201);

        $patientPackage->refresh();
        $this->assertEquals(3, $patientPackage->used_sessions);
        $this->assertEquals(3, $patientPackage->remaining_sessions);
        $this->assertEquals($patientPackage->total_sessions, $patientPackage->used_sessions + $patientPackage->remaining_sessions);
    }

    public function test_automatically_transitions_package_to_completed_when_remaining_sessions_reaches_zero(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 3]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 3,
            'used_sessions' => 2,
            'remaining_sessions' => 1,
            'status' => 'ACTIVE',
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(201);

        $patientPackage->refresh();
        $this->assertEquals(3, $patientPackage->used_sessions);
        $this->assertEquals(0, $patientPackage->remaining_sessions);

        // Acceptance Criterion 3: Automatically transitions to COMPLETED when remaining_sessions == 0
        $this->assertEquals('COMPLETED', $patientPackage->status);
        $this->assertEquals($patientPackage->total_sessions, $patientPackage->used_sessions + $patientPackage->remaining_sessions);
    }

    // ==========================================
    // 2. REJECTION ON INVALID PACKAGE USE (422)
    // ==========================================

    public function test_rejects_visit_when_remaining_sessions_less_than_visit_quantity(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 4,
            'remaining_sessions' => 1,
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 2, // Only 1 left!
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertStringContainsString('không đủ số buổi', $response->json('message'));

        $patientPackage->refresh();
        $this->assertEquals(4, $patientPackage->used_sessions);
        $this->assertEquals(1, $patientPackage->remaining_sessions);
    }

    public function test_rejects_visit_when_package_has_zero_remaining_sessions(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 3]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 3,
            'used_sessions' => 3,
            'remaining_sessions' => 0,
            'status' => 'COMPLETED',
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->remaining_sessions);
    }

    public function test_rejects_visit_when_package_has_expired(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'expiry_date' => Carbon::now()->subDays(5)->toDateString(),
            'status' => 'ACTIVE',
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->toDateTimeString(),
            'quantity' => 1,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertStringContainsString('hết hạn', $response->json('message'));
    }

    public function test_rejects_visit_when_package_belongs_to_different_patient(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patientA = $this->createPatient(['full_name' => 'Bệnh Nhân A']);
        $patientB = $this->createPatient(['full_name' => 'Bệnh Nhân B']);
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service]);

        // Package belongs to patient A
        $patientPackage = $this->assignPackageToPatient($patientA, $package);

        // Attempt to create visit for patient B using patient A's package
        $payload = [
            'patient_id' => $patientB->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertStringContainsString('không thuộc về bệnh nhân', $response->json('message'));
    }

    public function test_rejects_visit_when_service_is_not_part_of_the_package(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $serviceInPackage = $this->createService(['name' => 'Chăm sóc da Laser']);
        $serviceNotInPackage = $this->createService(['name' => 'Xét nghiệm sinh hóa']);

        $package = $this->createPackageWithServices([$serviceInPackage]);
        $patientPackage = $this->assignPackageToPatient($patient, $package);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $serviceNotInPackage->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertStringContainsString('không nằm trong gói', $response->json('message'));
    }

    public function test_rejects_visit_when_package_status_is_inactive_or_cancelled(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'status' => 'CANCELLED',
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertStringContainsString('không ở trạng thái hoạt động', $response->json('message'));
    }

    // ==========================================
    // 3. IDEMPOTENCY / ANTI-DOUBLE DEDUCTION
    // ==========================================

    public function test_does_not_deduct_sessions_twice_when_transitioning_active_statuses(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        // Step 1: Create visit -> 1 session deducted
        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
            'status' => 'SCHEDULED',
        ]);
        $createRes->assertStatus(201);
        $visitId = $createRes->json('data.id');

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(4, $patientPackage->remaining_sessions);

        // Step 2: Transition SCHEDULED -> IN_PROGRESS
        $this->patchJson("/api/v1/visits/{$visitId}/status", [
            'status' => 'IN_PROGRESS',
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions, 'Session should NOT be deducted again when moving to IN_PROGRESS');
        $this->assertEquals(4, $patientPackage->remaining_sessions);

        // Step 3: Transition IN_PROGRESS -> COMPLETED
        $this->patchJson("/api/v1/visits/{$visitId}/status", [
            'status' => 'COMPLETED',
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions, 'Session should NOT be deducted again when moving to COMPLETED');
        $this->assertEquals(4, $patientPackage->remaining_sessions);

        // Step 4: Call COMPLETED again (repeated status update)
        $this->patchJson("/api/v1/visits/{$visitId}/status", [
            'status' => 'COMPLETED',
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions, 'Repeated call with same status must never deduct twice');
        $this->assertEquals(4, $patientPackage->remaining_sessions);
    }

    public function test_does_not_deduct_sessions_twice_on_general_visit_update(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(4, $patientPackage->remaining_sessions);

        // General update (notes and employee change)
        $doctor2 = $this->createDoctor();
        $this->putJson("/api/v1/visits/{$visitId}", [
            'employee_id' => $doctor2->id,
            'notes' => 'Cập nhật ghi chú và đổi bác sĩ',
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(4, $patientPackage->remaining_sessions);
    }

    // ==========================================
    // 4. REFUNDING SESSIONS ON CANCELLATION & DELETION
    // ==========================================

    public function test_refunds_package_sessions_when_visit_is_cancelled(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.cancel', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        // Create visit -> 1 session deducted
        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(4, $patientPackage->remaining_sessions);

        // Cancel the visit via cancel endpoint
        $response = $this->postJson("/api/v1/visits/{$visitId}/cancel", [
            'reason' => 'Bệnh nhân bận việc đột xuất',
        ]);
        $response->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions, 'Sessions must be refunded when visit cancelled');
        $this->assertEquals(5, $patientPackage->remaining_sessions);
        $this->assertEquals($patientPackage->total_sessions, $patientPackage->used_sessions + $patientPackage->remaining_sessions);

        // Check refund audit log
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'visits',
            'action' => 'refund_package_session',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
        ]);
    }

    public function test_refunds_package_sessions_when_status_updated_to_cancelled(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        // Update status to CANCELLED via status endpoint
        $this->patchJson("/api/v1/visits/{$visitId}/status", [
            'status' => 'CANCELLED',
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions);
        $this->assertEquals(5, $patientPackage->remaining_sessions);
    }

    public function test_does_not_refund_twice_when_visit_is_already_cancelled(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.cancel', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        // Cancel first time -> refunded
        $this->postJson("/api/v1/visits/{$visitId}/cancel", ['reason' => 'Lần 1'])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions);
        $this->assertEquals(5, $patientPackage->remaining_sessions);

        // Cancel second time -> must NOT refund again!
        $this->postJson("/api/v1/visits/{$visitId}/cancel", ['reason' => 'Lần 2'])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions);
        $this->assertEquals(5, $patientPackage->remaining_sessions);
    }

    public function test_restores_package_status_to_active_when_completed_package_session_is_refunded(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.cancel', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 1]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 1,
            'used_sessions' => 0,
            'remaining_sessions' => 1,
            'status' => 'ACTIVE',
        ]);

        // Creating visit exhausts the package: remaining = 0, status = COMPLETED
        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        $patientPackage->refresh();
        $this->assertEquals('COMPLETED', $patientPackage->status);
        $this->assertEquals(0, $patientPackage->remaining_sessions);

        // Cancel visit -> status must revert to ACTIVE because remaining > 0
        $this->postJson("/api/v1/visits/{$visitId}/cancel", ['reason' => 'Hoàn buổi'])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals('ACTIVE', $patientPackage->status);
        $this->assertEquals(1, $patientPackage->remaining_sessions);
        $this->assertEquals(0, $patientPackage->used_sessions);
    }

    public function test_adjusts_package_sessions_when_visit_quantity_changes(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 10]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 10,
            'used_sessions' => 0,
            'remaining_sessions' => 10,
        ]);

        // Step 1: Create visit with qty = 1 -> remaining 9, used 1
        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(9, $patientPackage->remaining_sessions);

        // Step 2: Increase qty to 4 -> diff +3 deducted -> remaining 6, used 4
        $this->putJson("/api/v1/visits/{$visitId}", [
            'quantity' => 4,
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(4, $patientPackage->used_sessions);
        $this->assertEquals(6, $patientPackage->remaining_sessions);
        $this->assertEquals(10, $patientPackage->used_sessions + $patientPackage->remaining_sessions);

        // Step 3: Decrease qty to 2 -> diff -2 refunded -> remaining 8, used 2
        $this->putJson("/api/v1/visits/{$visitId}", [
            'quantity' => 2,
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(2, $patientPackage->used_sessions);
        $this->assertEquals(8, $patientPackage->remaining_sessions);
        $this->assertEquals(10, $patientPackage->used_sessions + $patientPackage->remaining_sessions);
    }

    public function test_refunds_sessions_when_visit_is_deleted(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.cancel', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 2,
        ]);
        $visitId = $createRes->json('data.id');

        $patientPackage->refresh();
        $this->assertEquals(2, $patientPackage->used_sessions);
        $this->assertEquals(3, $patientPackage->remaining_sessions);

        // Delete visit -> sessions refunded
        $this->deleteJson("/api/v1/visits/{$visitId}")->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions);
        $this->assertEquals(5, $patientPackage->remaining_sessions);
    }

    public function test_re_deducts_sessions_when_un_cancelling_a_visit(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.cancel', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();
        $package = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
        ]);

        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ]);
        $visitId = $createRes->json('data.id');

        // Cancel -> refunded
        $this->postJson("/api/v1/visits/{$visitId}/cancel")->assertStatus(200);
        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions);

        // Re-activate by setting status back to SCHEDULED -> re-deducted
        $this->patchJson("/api/v1/visits/{$visitId}/status", [
            'status' => 'SCHEDULED',
        ])->assertStatus(200);

        $patientPackage->refresh();
        $this->assertEquals(1, $patientPackage->used_sessions);
        $this->assertEquals(4, $patientPackage->remaining_sessions);
    }

    public function test_refunds_old_package_and_deducts_new_package_when_switching_packages(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.update', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();

        $packageA = $this->createPackageWithServices([$service], ['total_sessions' => 5]);
        $patientPackageA = $this->assignPackageToPatient($patient, $packageA);

        $packageB = $this->createPackageWithServices([$service], ['total_sessions' => 10]);
        $patientPackageB = $this->assignPackageToPatient($patient, $packageB);

        // Step 1: Create visit with package A
        $createRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackageA->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 2,
        ]);
        $visitId = $createRes->json('data.id');

        $patientPackageA->refresh();
        $this->assertEquals(2, $patientPackageA->used_sessions);
        $this->assertEquals(3, $patientPackageA->remaining_sessions);

        // Step 2: Switch visit to package B
        $this->putJson("/api/v1/visits/{$visitId}", [
            'patient_package_id' => $patientPackageB->id,
            'quantity' => 2,
        ])->assertStatus(200);

        $patientPackageA->refresh();
        $patientPackageB->refresh();

        // Package A refunded
        $this->assertEquals(0, $patientPackageA->used_sessions);
        $this->assertEquals(5, $patientPackageA->remaining_sessions);

        // Package B deducted
        $this->assertEquals(2, $patientPackageB->used_sessions);
        $this->assertEquals(8, $patientPackageB->remaining_sessions);
    }

    public function test_transaction_rolls_back_if_package_deduction_fails(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $serviceNotInPackage = $this->createService();

        $package = $this->createPackageWithServices([], ['total_sessions' => 5]);
        $patientPackage = $this->assignPackageToPatient($patient, $package);

        $initialVisitsCount = Visit::count();

        // Service is not in package -> deduction will fail
        $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $serviceNotInPackage->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDay()->toDateTimeString(),
            'quantity' => 1,
        ])->assertStatus(422);

        // Assert database rolled back completely
        $this->assertEquals($initialVisitsCount, Visit::count());
        $patientPackage->refresh();
        $this->assertEquals(0, $patientPackage->used_sessions);
        $this->assertEquals(5, $patientPackage->remaining_sessions);
    }

    public function test_direct_service_deduct_and_refund_methods(): void
    {
        $service = new VisitService;

        $patient = $this->createPatient();
        $clinicService = $this->createService();
        $package = $this->createPackageWithServices([$clinicService], ['total_sessions' => 4]);
        $patientPackage = $this->assignPackageToPatient($patient, $package, [
            'total_sessions' => 4,
            'used_sessions' => 0,
            'remaining_sessions' => 4,
        ]);

        // Direct deduction
        $deducted = $service->deductPackageSessions(
            $patientPackage->id,
            $patient->id,
            $clinicService->id,
            2,
            now()->toDateString()
        );

        $this->assertEquals(2, $deducted->used_sessions);
        $this->assertEquals(2, $deducted->remaining_sessions);

        // Direct refund
        $refunded = $service->refundPackageSessions($patientPackage->id, 1);
        $this->assertEquals(1, $refunded->used_sessions);
        $this->assertEquals(3, $refunded->remaining_sessions);

        // Exception when invalid quantity
        $this->expectException(InvalidArgumentException::class);
        $service->deductPackageSessions(
            $patientPackage->id,
            $patient->id,
            $clinicService->id,
            0,
            now()->toDateString()
        );
    }
}
