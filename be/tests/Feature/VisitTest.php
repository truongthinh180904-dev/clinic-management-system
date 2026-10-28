<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisitTest extends TestCase
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
     * Authenticate a user via Sanctum token.
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
            'full_name' => 'Nguyễn Văn Test',
            'date_of_birth' => '1992-05-15',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'address' => '123 Đường Y Tế, Quận 1, TP.HCM',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test doctor employee.
     */
    protected function createDoctor(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'BS. Trần Văn Khám',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Bác sĩ chuyên khoa',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test clinical service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'SRV-'.fake()->unique()->numerify('#####'),
            'name' => 'Khám Nội Tổng Quát',
            'description' => 'Khám lâm sàng ban đầu',
            'price' => 200000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Test unauthenticated access to visits API is blocked.
     */
    public function test_unauthenticated_user_cannot_access_visits(): void
    {
        $response = $this->getJson('/api/v1/visits');
        $response->assertStatus(401);

        $responsePost = $this->postJson('/api/v1/visits', []);
        $responsePost->assertStatus(401);
    }

    /**
     * Test receptionist can list visits with search and filters.
     */
    public function test_receptionist_can_list_visits_with_filters(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        $patient = $this->createPatient(['full_name' => 'Bệnh Nhân Tìm Kiếm']);
        $doctor = $this->createDoctor();
        $service = $this->createService();

        Visit::create([
            'visit_code' => 'VIS100001',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->toDateString(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'status' => Visit::STATUS_SCHEDULED,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
        ]);

        $response = $this->getJson('/api/v1/visits?search=Tìm Kiếm');
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'visit_code', 'patient', 'employee', 'service', 'status'],
                ],
                'meta',
            ]);

        $this->assertCount(1, $response->json('data'));
    }

    /**
     * Test fast check-in for an existing patient at reception desk.
     */
    public function test_receptionist_can_fast_check_in_existing_patient_with_queue_order(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        $patient = $this->createPatient([
            'phone' => '0987654321',
            'full_name' => 'Lê Văn Khám Nhanh',
        ]);
        $doctor = $this->createDoctor();
        $service = $this->createService([
            'price' => 250000,
        ]);

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->format('Y-m-d H:i:s'),
            'quantity' => 1,
            'unit_price' => 250000,
            'discount_amount' => 0,
            'status' => 'SCHEDULED',
            'notes' => '[Tiếp đón quầy lễ tân - STT: #01] Khám tai mũi họng',
        ];

        $response = $this->postJson('/api/v1/visits', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.employee_id', $doctor->id)
            ->assertJsonPath('data.service_id', $service->id)
            ->assertJsonPath('data.status', 'SCHEDULED')
            ->assertJsonPath('data.total_amount', 250000);

        $this->assertDatabaseHas('visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'status' => 'SCHEDULED',
        ]);

        // Verify patient visit date is updated
        $patient->refresh();
        $this->assertNotNull($patient->last_visit_date);
    }

    /**
     * Test duplicate warnings detection during receptionist registration/check-in.
     */
    public function test_receptionist_detects_duplicate_patient_warnings_by_phone_or_name(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        // Pre-existing patient
        $this->createPatient([
            'phone' => '0912345678',
            'full_name' => 'Nguyễn Thị Trùng Lặp',
            'date_of_birth' => '1995-10-20',
        ]);

        // Receptionist checks duplicate before registering new patient
        $checkPayload = [
            'phone' => '0912345678',
            'full_name' => 'Nguyễn Thị Trùng Lặp',
            'date_of_birth' => '1995-10-20',
        ];

        $response = $this->postJson('/api/v1/patients/check-duplicates', $checkPayload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.has_duplicates', true);

        $warnings = $response->json('data.duplicate_warnings');
        $this->assertNotEmpty($warnings);

        $phoneWarning = collect($warnings)->firstWhere('type', 'phone');
        $this->assertNotNull($phoneWarning);
        $this->assertStringContainsString('0912345678', $phoneWarning['message']);
    }

    /**
     * Test receptionist can register a new patient and check-in to create visit.
     */
    public function test_receptionist_can_fast_register_new_patient_and_immediately_check_in(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        $doctor = $this->createDoctor();
        $service = $this->createService(['price' => 150000]);

        // 1. Create patient at reception desk
        $newPatientPayload = [
            'full_name' => 'Phạm Văn Mới',
            'phone' => '0933221100',
            'gender' => 'MALE',
            'date_of_birth' => '1988-12-01',
            'address' => 'Số 5 Lê Lợi, TP.HCM',
            'status' => 'ACTIVE',
        ];

        $patientRes = $this->postJson('/api/v1/patients', $newPatientPayload);
        $patientRes->assertStatus(201)
            ->assertJsonPath('success', true);

        $newPatientId = $patientRes->json('data.id');
        $this->assertNotNull($newPatientId);

        // 2. 1-Click Check-in into clinic queue
        $visitPayload = [
            'patient_id' => $newPatientId,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->format('Y-m-d H:i:s'),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'status' => 'WAITING', // Tests WAITING status handling
            'notes' => '[Tiếp đón quầy lễ tân - STT: #02] Bệnh nhân mới đến quầy',
        ];

        $visitRes = $this->postJson('/api/v1/visits', $visitPayload);
        $visitRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient_id', $newPatientId)
            ->assertJsonPath('data.status', 'SCHEDULED'); // Normalized to database schema

        $this->assertDatabaseHas('visits', [
            'patient_id' => $newPatientId,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
        ]);
    }

    /**
     * Test receptionist can update visit status and cancel visit.
     */
    public function test_receptionist_can_update_visit_status_and_cancel(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();

        $visit = Visit::create([
            'visit_code' => 'VIS100002',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->toDateString(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'status' => Visit::STATUS_SCHEDULED,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
        ]);

        // Update status to IN_PROGRESS
        $updateStatusRes = $this->patchJson("/api/v1/visits/{$visit->id}/status", [
            'status' => 'IN_PROGRESS',
            'notes' => 'Bác sĩ bắt đầu khám lâm sàng',
        ]);
        $updateStatusRes->assertStatus(200)
            ->assertJsonPath('data.status', 'IN_PROGRESS');

        // Cancel visit
        $cancelRes = $this->postJson("/api/v1/visits/{$visit->id}/cancel", [
            'reason' => 'Bệnh nhân xin dời sang ngày mai',
        ]);
        $cancelRes->assertStatus(200)
            ->assertJsonPath('data.status', 'CANCELLED');
    }
}
