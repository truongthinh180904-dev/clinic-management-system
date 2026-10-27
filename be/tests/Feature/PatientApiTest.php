<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Services\PatientCodeGenerator;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientApiTest extends TestCase
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
        $this->getJson('/api/v1/patients')
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);

        $this->postJson('/api/v1/patients', ['full_name' => 'Nguyen Van A'])
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_inactive_user_is_forbidden_with_403(): void
    {
        $inactiveUser = $this->createUserWithRole('ADMIN', 'INACTIVE');

        $this->authenticate($inactiveUser)
            ->getJson('/api/v1/patients')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_user_without_permission_cannot_access_patient_endpoints(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');

        $this->authenticate($viewer)
            ->getJson('/api/v1/patients')
            ->assertStatus(403);

        $this->authenticate($viewer)
            ->postJson('/api/v1/patients', ['full_name' => 'Nguyen Van A'])
            ->assertStatus(403);
    }

    public function test_receptionist_can_list_patients_with_search_and_pagination(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $p1 = Patient::create([
            'patient_code' => 'BN000001',
            'full_name' => 'Nguyen Van An',
            'phone' => '0901111111',
            'email' => 'an@example.com',
            'status' => 'ACTIVE',
        ]);

        $p2 = Patient::create([
            'patient_code' => 'BN000002',
            'full_name' => 'Tran Thi Binh',
            'phone' => '0902222222',
            'email' => 'binh@example.com',
            'status' => 'INACTIVE',
        ]);

        // List all
        $response = $this->authenticate($receptionist)
            ->getJson('/api/v1/patients')
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh sách bệnh nhân thành công.',
            ])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'patient_code', 'full_name', 'phone', 'status'],
                ],
                'meta' => ['current_page', 'per_page', 'total'],
            ]);

        $this->assertCount(2, $response->json('data'));

        // Search by name
        $searchResponse = $this->authenticate($receptionist)
            ->getJson('/api/v1/patients?search=Binh')
            ->assertStatus(200);

        $this->assertCount(1, $searchResponse->json('data'));
        $this->assertSame('BN000002', $searchResponse->json('data.0.patient_code'));

        // Search by phone
        $phoneResponse = $this->authenticate($receptionist)
            ->getJson('/api/v1/patients?q=0901111111')
            ->assertStatus(200);

        $this->assertCount(1, $phoneResponse->json('data'));
        $this->assertSame('BN000001', $phoneResponse->json('data.0.patient_code'));

        // Filter by status
        $statusResponse = $this->authenticate($receptionist)
            ->getJson('/api/v1/patients?status=INACTIVE')
            ->assertStatus(200);

        $this->assertCount(1, $statusResponse->json('data'));
        $this->assertSame('BN000002', $statusResponse->json('data.0.patient_code'));
    }

    public function test_patient_code_generator_is_concurrency_safe_and_non_naive(): void
    {
        $generator = new PatientCodeGenerator;

        // Initially no BN codes
        $code1 = $generator->generate();
        $this->assertSame('BN000001', $code1);

        // Create a patient with BN000005 (simulating manual entry or gaps)
        Patient::create([
            'patient_code' => 'BN000005',
            'full_name' => 'Gap Test Patient',
            'status' => 'ACTIVE',
        ]);

        // Generator must look at max numeric code and generate BN000006, not count() + 1 (= 2)
        $codeNext = $generator->generate();
        $this->assertSame('BN000006', $codeNext);
    }

    public function test_receptionist_can_create_patient_with_auto_generated_code(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $payload = [
            'full_name' => 'Hoang Minh Chien',
            'phone' => '0938123456',
            'email' => 'chien@example.com',
            'gender' => 'MALE',
            'date_of_birth' => '1995-10-20',
            'address' => '123 Nguyen Trai, Q5, TPHCM',
            'emergency_contact_name' => 'Hoang Ba',
            'emergency_contact_phone' => '0938999999',
        ];

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', $payload)
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo hồ sơ bệnh nhân mới thành công.',
                'duplicate_warnings' => [],
            ])
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'patient_code',
                    'full_name',
                    'phone',
                    'email',
                    'date_of_birth',
                    'gender',
                    'status',
                    'created_at',
                ],
                'duplicate_warnings',
            ]);

        $createdCode = $response->json('data.patient_code');
        $this->assertMatchesRegularExpression('/^BN\d{6}$/', $createdCode);
        $this->assertSame('ACTIVE', $response->json('data.status'));

        $this->assertDatabaseHas('patients', [
            'id' => $response->json('data.id'),
            'patient_code' => $createdCode,
            'full_name' => 'Hoang Minh Chien',
            'phone' => '0938123456',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'patients',
            'action' => 'create',
            'record_id' => (string) $response->json('data.id'),
        ]);
    }

    public function test_create_patient_with_custom_code(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', [
                'patient_code' => 'BN-CUSTOM-99',
                'full_name' => 'Custom Code Patient',
            ])
            ->assertStatus(201);

        $this->assertSame('BN-CUSTOM-99', $response->json('data.patient_code'));

        // Second creation with the same custom code must fail validation with 422
        $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', [
                'patient_code' => 'BN-CUSTOM-99',
                'full_name' => 'Duplicate Custom Code',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['patient_code']);
    }

    public function test_duplicate_warnings_when_phone_already_exists_but_still_allows_creation(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $firstPatient = Patient::create([
            'patient_code' => 'BN000001',
            'full_name' => 'Nguyen Van Mot',
            'phone' => '0987654321',
            'status' => 'ACTIVE',
        ]);

        // Creating second patient with exact same phone number
        $secondPayload = [
            'full_name' => 'Nguyen Van Hai',
            'phone' => '0987654321', // Duplicate phone
            'gender' => 'MALE',
        ];

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', $secondPayload)
            ->assertStatus(201) // Creation must succeed! Phone is NOT strictly unique
            ->assertJson([
                'success' => true,
            ]);

        $warnings = $response->json('duplicate_warnings');
        $this->assertNotEmpty($warnings);
        $this->assertSame('phone', $warnings[0]['type']);
        $this->assertSame('0987654321', $warnings[0]['matched_patients'][0]['phone']);
        $this->assertSame($firstPatient->patient_code, $warnings[0]['matched_patients'][0]['patient_code']);

        // Both patients must exist in the database
        $this->assertDatabaseCount('patients', 2);
    }

    public function test_duplicate_warnings_when_fullname_and_dob_match(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $existing = Patient::create([
            'patient_code' => 'BN000010',
            'full_name' => 'Dang Thi Dung',
            'date_of_birth' => '1990-08-15',
            'phone' => '0912000001',
            'status' => 'ACTIVE',
        ]);

        // Creating patient with same full_name (different casing) and same DOB, but different phone
        $payload = [
            'full_name' => 'dang thi dung',
            'date_of_birth' => '1990-08-15',
            'phone' => '0912000002',
        ];

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', $payload)
            ->assertStatus(201);

        $warnings = $response->json('duplicate_warnings');
        $this->assertNotEmpty($warnings);
        $this->assertSame('name_and_dob', $warnings[0]['type']);
        $this->assertSame($existing->patient_code, $warnings[0]['matched_patients'][0]['patient_code']);
    }

    public function test_check_duplicates_endpoint_previews_warnings_without_creating_record(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        Patient::create([
            'patient_code' => 'BN000020',
            'full_name' => 'Phan Van Mau',
            'phone' => '0903334444',
            'date_of_birth' => '1985-03-10',
            'status' => 'ACTIVE',
        ]);

        $checkResponse = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients/check-duplicates', [
                'phone' => '0903334444',
                'full_name' => 'Phan Van Mau',
                'date_of_birth' => '1985-03-10',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'has_duplicates' => true,
                ],
            ]);

        $this->assertCount(2, $checkResponse->json('data.duplicate_warnings'));
        $this->assertDatabaseCount('patients', 1); // No new record inserted
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

    public function test_update_patient_with_duplicate_warning_and_audit_log(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $patientA = Patient::create([
            'patient_code' => 'BN000041',
            'full_name' => 'Patient A',
            'phone' => '0911111111',
            'status' => 'ACTIVE',
        ]);

        $patientB = Patient::create([
            'patient_code' => 'BN000042',
            'full_name' => 'Patient B',
            'phone' => '0922222222',
            'status' => 'ACTIVE',
        ]);

        // Update patient B's phone to patient A's phone
        $response = $this->authenticate($receptionist)
            ->putJson("/api/v1/patients/{$patientB->id}", [
                'full_name' => 'Patient B Updated',
                'phone' => '0911111111',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'full_name' => 'Patient B Updated',
                    'phone' => '0911111111',
                ],
            ]);

        $warnings = $response->json('duplicate_warnings');
        $this->assertNotEmpty($warnings);
        $this->assertSame('phone', $warnings[0]['type']);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'patients',
            'action' => 'update',
            'record_id' => (string) $patientB->id,
        ]);
    }

    public function test_update_patient_status(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $patient = Patient::create([
            'patient_code' => 'BN000050',
            'full_name' => 'Status Test Patient',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($receptionist)
            ->patchJson("/api/v1/patients/{$patient->id}/status", [
                'status' => 'LOCKED',
                'notes' => 'Tài khoản có dấu hiệu gian lận',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'LOCKED',
                ],
            ]);

        $this->assertSame('LOCKED', $patient->fresh()->status);
        $this->assertStringContainsString('Tài khoản có dấu hiệu gian lận', (string) $patient->fresh()->notes);

        // Invalid status
        $this->authenticate($receptionist)
            ->patchJson("/api/v1/patients/{$patient->id}/status", [
                'status' => 'UNKNOWN_STATUS',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_delete_patient_fails_when_associated_with_appointments(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $patient = Patient::create([
            'patient_code' => 'BN000060',
            'full_name' => 'Appointment Bound Patient',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'NV999901',
            'full_name' => 'Doctor 1',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-001',
            'name' => 'Kham benh',
            'price' => 150000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        Appointment::create([
            'appointment_code' => 'APT-001',
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
            ->deleteJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể xóa bệnh nhân đã có dữ liệu lịch hẹn, lượt khám, gói khám hoặc hóa đơn liên quan.',
            ]);

        $this->assertDatabaseHas('patients', ['id' => $patient->id]);
    }

    public function test_delete_patient_succeeds_when_no_associated_records(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $patient = Patient::create([
            'patient_code' => 'BN000070',
            'full_name' => 'Clean Patient To Delete',
            'status' => 'ACTIVE',
        ]);

        $this->authenticate($admin)
            ->deleteJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa hồ sơ bệnh nhân thành công.',
            ]);

        $this->assertDatabaseMissing('patients', ['id' => $patient->id]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'patients',
            'action' => 'delete',
            'record_id' => (string) $patient->id,
        ]);
    }

    public function test_patient_validation_fails_on_invalid_data(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        // Missing full_name, invalid email, future birth date
        $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', [
                'email' => 'not-an-email',
                'date_of_birth' => '2099-01-01',
                'gender' => 'INVALID_GENDER',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['full_name', 'email', 'date_of_birth', 'gender']);
    }
}
