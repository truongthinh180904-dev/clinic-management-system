<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\MedicalRecord;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use App\Services\VisitService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisitApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
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
     * Helper to authenticate user via Sanctum token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh Nhân Test',
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test employee (doctor).
     */
    protected function createEmployee(array $attributes = []): Employee
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
     * Helper to create a test service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'SRV-'.fake()->unique()->numerify('#####'),
            'name' => 'Khám Nội Tổng Quát',
            'description' => 'Dịch vụ khám lâm sàng',
            'price' => 200000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test visit.
     */
    protected function createVisit(array $attributes = []): Visit
    {
        $patient = $attributes['patient'] ?? $this->createPatient();
        $employee = $attributes['employee'] ?? $this->createEmployee();
        $service = $attributes['service'] ?? $this->createService();

        unset($attributes['patient'], $attributes['employee'], $attributes['service']);

        $quantity = $attributes['quantity'] ?? 1;
        $unitPrice = $attributes['unit_price'] ?? (float) $service->price;
        $discountAmount = $attributes['discount_amount'] ?? 0.0;
        $totalAmount = max(0.0, ($quantity * $unitPrice) - $discountAmount);

        return Visit::create(array_merge([
            'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-05 09:00:00',
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'discount_amount' => $discountAmount,
            'total_amount' => $totalAmount,
            'payment_status' => 'UNPAID',
            'status' => 'SCHEDULED',
            'notes' => 'Lượt khám mẫu',
        ], $attributes));
    }

    // ==========================================
    // 1. AUTHENTICATION & AUTHORIZATION TESTS
    // ==========================================

    public function test_cannot_access_visits_without_authentication(): void
    {
        $this->getJson('/api/v1/visits')->assertStatus(401);
        $this->postJson('/api/v1/visits', [])->assertStatus(401);
        $this->getJson('/api/v1/visits/1')->assertStatus(401);
        $this->putJson('/api/v1/visits/1', [])->assertStatus(401);
        $this->patchJson('/api/v1/visits/1/status', [])->assertStatus(401);
        $this->postJson('/api/v1/visits/1/cancel')->assertStatus(401);
        $this->deleteJson('/api/v1/visits/1')->assertStatus(401);
    }

    public function test_cannot_access_visits_without_appropriate_permissions(): void
    {
        $userWithoutPerms = $this->createUserWithPermissions([]);
        $this->authenticate($userWithoutPerms);

        $this->getJson('/api/v1/visits')->assertStatus(403);
        $this->postJson('/api/v1/visits', [])->assertStatus(403);
        $this->getJson('/api/v1/visits/1')->assertStatus(403);
        $this->putJson('/api/v1/visits/1', [])->assertStatus(403);
        $this->patchJson('/api/v1/visits/1/status', [])->assertStatus(403);
        $this->postJson('/api/v1/visits/1/cancel')->assertStatus(403);
        $this->deleteJson('/api/v1/visits/1')->assertStatus(403);
    }

    // ==========================================
    // 2. LIST & FILTER TESTS
    // ==========================================

    public function test_can_list_visits_with_filters_and_pagination(): void
    {
        $user = $this->createUserWithPermissions(['visits.view']);
        $this->authenticate($user);

        $patientA = $this->createPatient(['full_name' => 'Nguyễn Văn A', 'patient_code' => 'BN000001']);
        $patientB = $this->createPatient(['full_name' => 'Trần Thị B', 'patient_code' => 'BN000002']);

        $employee1 = $this->createEmployee();
        $employee2 = $this->createEmployee();

        $service1 = $this->createService(['name' => 'Khám Da Liễu']);
        $service2 = $this->createService(['name' => 'Khám Mắt']);

        $visit1 = $this->createVisit([
            'patient' => $patientA,
            'employee' => $employee1,
            'service' => $service1,
            'visit_date' => '2026-11-01 09:00:00',
            'status' => 'SCHEDULED',
            'payment_status' => 'UNPAID',
        ]);

        $visit2 = $this->createVisit([
            'patient' => $patientB,
            'employee' => $employee2,
            'service' => $service2,
            'visit_date' => '2026-11-02 10:00:00',
            'status' => 'COMPLETED',
            'payment_status' => 'PAID',
        ]);

        // Basic listing
        $response = $this->getJson('/api/v1/visits');
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'visit_code',
                        'patient_id',
                        'employee_id',
                        'service_id',
                        'visit_date',
                        'quantity',
                        'unit_price',
                        'discount_amount',
                        'total_amount',
                        'payment_status',
                        'status',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'per_page',
                    'total',
                ],
            ]);

        // Filter by patient_id
        $this->getJson("/api/v1/visits?patient_id={$patientA->id}")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visit1->id);

        // Filter by status
        $this->getJson('/api/v1/visits?status=COMPLETED')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visit2->id);

        // Search by patient name
        $this->getJson('/api/v1/visits?search=Nguyễn+Văn+A')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visit1->id);

        // Filter by date range
        $this->getJson('/api/v1/visits?from_date=2026-11-02&to_date=2026-11-03')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visit2->id);
    }

    // ==========================================
    // 3. CREATE VISIT & FORMULA TESTS
    // ==========================================

    public function test_can_create_visit_successfully_and_recalculates_patient_dates(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.view']);
        $this->authenticate($user);

        $patient = $this->createPatient([
            'first_visit_date' => null,
            'last_visit_date' => null,
        ]);
        $employee = $this->createEmployee();
        $service = $this->createService(['price' => 250000.00]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-05 14:00:00',
            'quantity' => 2,
            'unit_price' => 250000.00,
            'discount_amount' => 50000.00,
            'status' => 'SCHEDULED',
            'payment_status' => 'UNPAID',
            'notes' => 'Khám tổng quát định kỳ',
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.employee_id', $employee->id)
            ->assertJsonPath('data.quantity', 2)
            ->assertJsonPath('data.unit_price', 250000)
            ->assertJsonPath('data.discount_amount', 50000)
            ->assertJsonPath('data.total_amount', 450000) // 2 * 250,000 - 50,000 = 450,000
            ->assertJsonPath('data.status', 'SCHEDULED');

        // Check generated visit_code
        $visitCode = $response->json('data.visit_code');
        $this->assertNotEmpty($visitCode);
        $this->assertStringStartsWith('VIS', $visitCode);

        // Check database
        $this->assertDatabaseHas('visits', [
            'id' => $response->json('data.id'),
            'patient_id' => $patient->id,
            'total_amount' => 450000.00,
            'created_by' => $user->id,
        ]);

        // Check patient dates updated
        $patient->refresh();
        $this->assertEquals('2026-11-05', $patient->first_visit_date?->format('Y-m-d'));
        $this->assertEquals('2026-11-05', $patient->last_visit_date?->format('Y-m-d'));

        // Check audit log
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'module' => 'visits',
            'action' => 'create',
            'record_id' => (string) $response->json('data.id'),
        ]);
    }

    public function test_creates_visit_with_default_service_price_when_unit_price_omitted(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $employee = $this->createEmployee();
        $service = $this->createService(['price' => 300000.00]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-06 10:00:00',
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quantity', 1)
            ->assertJsonPath('data.unit_price', 300000)
            ->assertJsonPath('data.discount_amount', 0)
            ->assertJsonPath('data.total_amount', 300000);
    }

    public function test_rejects_visit_when_discount_amount_exceeds_total(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $employee = $this->createEmployee();
        $service = $this->createService(['price' => 200000.00]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-07 08:30:00',
            'quantity' => 1,
            'unit_price' => 200000.00,
            'discount_amount' => 250000.00, // Exceeds 200,000!
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['discount_amount'])
            ->assertJsonPath('errors.discount_amount.0', 'Số tiền giảm giá không được vượt quá tổng thành tiền của dịch vụ.');
    }

    public function test_rejects_negative_discount_or_zero_quantity(): void
    {
        $user = $this->createUserWithPermissions(['visits.create']);
        $this->authenticate($user);

        $patient = $this->createPatient();
        $employee = $this->createEmployee();
        $service = $this->createService(['price' => 200000.00]);

        // Negative discount
        $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-07 08:30:00',
            'discount_amount' => -10000,
        ])->assertStatus(422)->assertJsonValidationErrors(['discount_amount']);

        // Zero quantity
        $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-07 08:30:00',
            'quantity' => 0,
        ])->assertStatus(422)->assertJsonValidationErrors(['quantity']);
    }

    // ==========================================
    // 4. SHOW VISIT DETAILS
    // ==========================================

    public function test_can_show_visit_details(): void
    {
        $user = $this->createUserWithPermissions(['visits.view']);
        $this->authenticate($user);

        $visit = $this->createVisit();

        $response = $this->getJson("/api/v1/visits/{$visit->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $visit->id)
            ->assertJsonPath('data.visit_code', $visit->visit_code)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id',
                    'visit_code',
                    'patient',
                    'employee',
                    'service',
                ],
            ]);

        // Not found
        $this->getJson('/api/v1/visits/9999999')->assertStatus(404);
    }

    // ==========================================
    // 5. UPDATE VISIT & LIFECYCLE TESTS
    // ==========================================

    public function test_can_update_visit_and_recalculates_total_amount(): void
    {
        $user = $this->createUserWithPermissions(['visits.update', 'visits.view']);
        $this->authenticate($user);

        $visit = $this->createVisit([
            'quantity' => 1,
            'unit_price' => 200000.00,
            'discount_amount' => 0.0,
            'total_amount' => 200000.00,
        ]);

        $response = $this->putJson("/api/v1/visits/{$visit->id}", [
            'quantity' => 3,
            'discount_amount' => 50000.00,
            'notes' => 'Cập nhật thêm liệu trình',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quantity', 3)
            ->assertJsonPath('data.unit_price', 200000)
            ->assertJsonPath('data.discount_amount', 50000)
            ->assertJsonPath('data.total_amount', 550000); // 3 * 200,000 - 50,000 = 550,000

        $visit->refresh();
        $this->assertEquals(550000.00, (float) $visit->total_amount);
        $this->assertEquals('Cập nhật thêm liệu trình', $visit->notes);
    }

    public function test_can_transition_visit_lifecycle_status(): void
    {
        $user = $this->createUserWithPermissions(['visits.update', 'visits.cancel']);
        $this->authenticate($user);

        $visit = $this->createVisit(['status' => 'SCHEDULED']);

        // Transition to IN_PROGRESS
        $this->patchJson("/api/v1/visits/{$visit->id}/status", [
            'status' => 'IN_PROGRESS',
        ])->assertStatus(200)->assertJsonPath('data.status', 'IN_PROGRESS');

        // Transition to COMPLETED
        $this->patchJson("/api/v1/visits/{$visit->id}/status", [
            'status' => 'COMPLETED',
        ])->assertStatus(200)->assertJsonPath('data.status', 'COMPLETED');

        // Cancel via cancel endpoint
        $this->postJson("/api/v1/visits/{$visit->id}/cancel", [
            'reason' => 'Bệnh nhân có việc khẩn cấp',
        ])->assertStatus(200)
            ->assertJsonPath('data.status', 'CANCELLED');

        $visit->refresh();
        $this->assertEquals('CANCELLED', $visit->status);
        $this->assertStringContainsString('Bệnh nhân có việc khẩn cấp', (string) $visit->notes);
    }

    public function test_updates_patient_first_and_last_visit_dates_consistently(): void
    {
        $user = $this->createUserWithPermissions(['visits.create', 'visits.update', 'visits.cancel']);
        $this->authenticate($user);

        $patient = $this->createPatient();

        // 1. First visit on 2026-11-10
        $visit1 = $this->createVisit([
            'patient' => $patient,
            'visit_date' => '2026-11-10 09:00:00',
            'status' => 'SCHEDULED',
        ]);
        (new VisitService)->updatePatientVisitDates($patient->id);
        $patient->refresh();
        $this->assertEquals('2026-11-10', $patient->first_visit_date?->format('Y-m-d'));
        $this->assertEquals('2026-11-10', $patient->last_visit_date?->format('Y-m-d'));

        // 2. Second visit on 2026-11-20
        $visit2 = $this->createVisit([
            'patient' => $patient,
            'visit_date' => '2026-11-20 10:00:00',
            'status' => 'SCHEDULED',
        ]);
        (new VisitService)->updatePatientVisitDates($patient->id);
        $patient->refresh();
        $this->assertEquals('2026-11-10', $patient->first_visit_date?->format('Y-m-d'));
        $this->assertEquals('2026-11-20', $patient->last_visit_date?->format('Y-m-d'));

        // 3. Third visit earlier on 2026-11-01
        $visit3 = $this->createVisit([
            'patient' => $patient,
            'visit_date' => '2026-11-01 08:00:00',
            'status' => 'SCHEDULED',
        ]);
        (new VisitService)->updatePatientVisitDates($patient->id);
        $patient->refresh();
        $this->assertEquals('2026-11-01', $patient->first_visit_date?->format('Y-m-d'));
        $this->assertEquals('2026-11-20', $patient->last_visit_date?->format('Y-m-d'));

        // 4. Cancel third visit (2026-11-01) -> first_visit_date rolls back to 2026-11-10
        $this->postJson("/api/v1/visits/{$visit3->id}/cancel", ['reason' => 'Hủy khám'])
            ->assertStatus(200);

        $patient->refresh();
        $this->assertEquals('2026-11-10', $patient->first_visit_date?->format('Y-m-d'));
        $this->assertEquals('2026-11-20', $patient->last_visit_date?->format('Y-m-d'));
    }

    // ==========================================
    // 6. DELETE VISIT TESTS
    // ==========================================

    public function test_can_delete_visit_without_medical_record_or_invoices(): void
    {
        $user = $this->createUserWithPermissions(['visits.cancel', 'visits.update']);
        $this->authenticate($user);

        $visit = $this->createVisit();

        $response = $this->deleteJson("/api/v1/visits/{$visit->id}");
        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('visits', ['id' => $visit->id]);
    }

    public function test_cannot_delete_visit_with_medical_record(): void
    {
        $user = $this->createUserWithPermissions(['visits.cancel', 'visits.update']);
        $this->authenticate($user);

        $visit = $this->createVisit();

        // Attach medical record
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Viêm xoang cấp',
        ]);

        $response = $this->deleteJson("/api/v1/visits/{$visit->id}");
        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Không thể xóa lượt khám đã có hồ sơ bệnh án.');

        $this->assertDatabaseHas('visits', ['id' => $visit->id]);
    }
}
