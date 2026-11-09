<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\MedicalRecord;
use App\Models\Patient;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientTest extends TestCase
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

        return $this->withToken($token);
    }

    public function test_doctor_can_get_patient_clinical_timeline_with_medical_records(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000088',
            'full_name' => 'Nguyen Van Timeline',
            'gender' => 'MALE',
            'phone' => '0988776655',
            'status' => 'ACTIVE',
        ]);

        $doctorEmployee = Employee::create([
            'employee_code' => 'NV-DOC-01',
            'full_name' => 'BS Nguyen Van Duc',
            'phone' => '0911223344',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-TIMELINE-01',
            'name' => 'Kham Tai Mui Hong',
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB-20261028-0001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'visit_date' => now()->subDay(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'status' => Visit::STATUS_COMPLETED,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'created_by' => $doctorUser->id,
        ]);

        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctorEmployee->id,
            'medical_history' => 'Tien su viem xoang man tinh, di ung Penicillin',
            'diagnosis' => 'J01.0 - Viem xoang ham cap',
            'indication' => 'Noi soi tai mui hong',
            'result' => 'Niem mac sung huyet',
            'treatment' => 'Augmentin 1g x 2 lan/ngay',
            'follow_up_date' => now()->addDays(7)->format('Y-m-d'),
        ]);

        $response = $this->authenticate($doctorUser)
            ->getJson("/api/v1/patients/{$patient->id}/timeline")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy trục thời gian lịch sử khám bệnh nhân thành công.',
            ])
            ->assertJsonStructure([
                'data' => [
                    'patient' => ['id', 'patient_code', 'full_name'],
                    'timeline' => [
                        '*' => [
                            'id',
                            'visit_code',
                            'visit_date',
                            'status',
                            'payment_status',
                            'total_amount',
                            'doctor' => ['id', 'employee_code', 'full_name'],
                            'service' => ['id', 'service_code', 'name'],
                            'medical_record' => [
                                'id',
                                'diagnosis',
                                'medical_history',
                                'treatment',
                                'follow_up_date',
                            ],
                        ],
                    ],
                    'total_visits',
                ],
            ]);

        $this->assertSame(1, $response->json('data.total_visits'));
        $this->assertSame('KB-20261028-0001', $response->json('data.timeline.0.visit_code'));
        $this->assertSame('J01.0 - Viem xoang ham cap', $response->json('data.timeline.0.medical_record.diagnosis'));
    }

    public function test_receptionist_gets_timeline_without_sensitive_medical_records(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $patient = Patient::create([
            'patient_code' => 'BN000089',
            'full_name' => 'Tran Thi Privacy',
            'gender' => 'FEMALE',
            'phone' => '0988776699',
            'status' => 'ACTIVE',
        ]);

        $doctorEmployee = Employee::create([
            'employee_code' => 'NV-DOC-02',
            'full_name' => 'BS Tran Van Tam',
            'phone' => '0911223388',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-TIMELINE-02',
            'name' => 'Kham Tong Quat',
            'price' => 300000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB-20261028-0002',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'status' => Visit::STATUS_COMPLETED,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'created_by' => $receptionist->id,
        ]);

        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctorEmployee->id,
            'medical_history' => 'Bao mat thong tin y te',
            'diagnosis' => 'Chan doan bao mat',
        ]);

        $response = $this->authenticate($receptionist)
            ->getJson("/api/v1/patients/{$patient->id}/timeline")
            ->assertStatus(200);

        $this->assertSame(1, $response->json('data.total_visits'));
        $this->assertSame('KB-20261028-0002', $response->json('data.timeline.0.visit_code'));
        // Sensitive medical record must be NULL for receptionist (no medical_records.view)
        $this->assertNull($response->json('data.timeline.0.medical_record'));
    }

    public function test_patient_timeline_returns_404_when_patient_not_found(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $this->authenticate($doctor)
            ->getJson('/api/v1/patients/999999/timeline')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ bệnh nhân yêu cầu.',
            ]);
    }

    public function test_patient_timeline_requires_authentication(): void
    {
        $this->getJson('/api/v1/patients/1/timeline')
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_patient_timeline_forbidden_for_user_without_permission(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');

        $patient = Patient::create([
            'patient_code' => 'BN000099',
            'full_name' => 'Forbidden Viewer Test',
            'phone' => '0933221100',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($viewer)
            ->getJson("/api/v1/patients/{$patient->id}/timeline")
            ->assertStatus(403);
    }

    public function test_patient_timeline_orders_visits_chronologically_descending(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000090',
            'full_name' => 'Le Van MultiVisit',
            'gender' => 'MALE',
            'phone' => '0977112233',
            'status' => 'ACTIVE',
        ]);

        $doctorEmployee = Employee::create([
            'employee_code' => 'NV-DOC-03',
            'full_name' => 'BS Le Hoang',
            'phone' => '0933445566',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-TIMELINE-03',
            'name' => 'Kham Noi',
            'price' => 150000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        // Older visit
        Visit::create([
            'visit_code' => 'KB-20261001-0001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'visit_date' => now()->subDays(10),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'status' => Visit::STATUS_COMPLETED,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'created_by' => $doctor->id,
        ]);

        // Newer visit
        Visit::create([
            'visit_code' => 'KB-20261020-0002',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'visit_date' => now()->subDays(1),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'status' => Visit::STATUS_COMPLETED,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'created_by' => $doctor->id,
        ]);

        $response = $this->authenticate($doctor)
            ->getJson("/api/v1/patients/{$patient->id}/timeline")
            ->assertStatus(200);

        $this->assertSame(2, $response->json('data.total_visits'));
        $this->assertSame('KB-20261020-0002', $response->json('data.timeline.0.visit_code'));
        $this->assertSame('KB-20261001-0001', $response->json('data.timeline.1.visit_code'));
    }

    public function test_show_patient_details(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $patient = Patient::create([
            'patient_code' => 'BN000030',
            'full_name' => 'Bui Thi Giang',
            'phone' => '0945678901',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($receptionist)
            ->getJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $patient->id,
                    'patient_code' => 'BN000030',
                    'full_name' => 'Bui Thi Giang',
                ],
            ]);

        $this->authenticate($receptionist)
            ->getJson('/api/v1/patients/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_create_patient_with_auto_generated_code(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', [
                'full_name' => 'Vuong Quoc Binh',
                'phone' => '0909888777',
                'gender' => 'MALE',
                'date_of_birth' => '1990-08-20',
                'address' => '123 Nguyen Trai, Q5, TP HCM',
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo hồ sơ bệnh nhân mới thành công.',
            ]);

        $patientCode = $response->json('data.patient_code');
        $this->assertNotEmpty($patientCode);
        $this->assertStringStartsWith('BN', $patientCode);

        $this->assertDatabaseHas('patients', [
            'full_name' => 'Vuong Quoc Binh',
            'phone' => '0909888777',
            'gender' => 'MALE',
        ]);
    }

    public function test_update_patient_status(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $patient = Patient::create([
            'patient_code' => 'BN000050',
            'full_name' => 'Status Test Patient',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->patchJson("/api/v1/patients/{$patient->id}/status", [
                'status' => 'LOCKED',
                'notes' => 'Tài khoản có dấu hiệu vi phạm',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'LOCKED',
                ],
            ]);

        $this->assertSame('LOCKED', $patient->fresh()->status);
        $this->assertStringContainsString('Tài khoản có dấu hiệu vi phạm', (string) $patient->fresh()->notes);
    }
}
