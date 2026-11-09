<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\MedicalRecord;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MedicalRecordApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create a user with a specific standard role.
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
            'name' => 'ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Custom test role',
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
     * Helper to create a test doctor employee.
     */
    protected function createDoctor(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác Sĩ Test',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'DOCTOR',
            'department' => 'Khám bệnh',
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
            'name' => 'Khám Tai Mũi Họng',
            'description' => 'Dịch vụ khám chuyên khoa',
            'price' => 250000.00,
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
        $doctor = $attributes['employee'] ?? $this->createDoctor();
        $service = $attributes['service'] ?? $this->createService();

        unset($attributes['patient'], $attributes['employee'], $attributes['service']);

        return Visit::create(array_merge([
            'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-05 09:00:00',
            'quantity' => 1,
            'unit_price' => 250000.00,
            'discount_amount' => 0.0,
            'total_amount' => 250000.00,
            'payment_status' => 'UNPAID',
            'status' => 'IN_PROGRESS',
        ], $attributes));
    }

    // ==========================================
    // 1. CREATE MEDICAL RECORD TESTS
    // ==========================================

    public function test_doctor_can_create_medical_record_for_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $doctorEmployee = $doctorUser->employee;
        $visit = $this->createVisit(['employee' => $doctorEmployee]);

        $payload = [
            'medical_history' => 'Tiền sử dị ứng penicillin nhẹ.',
            'diagnosis' => 'Viêm họng cấp tính do vi khuẩn',
            'indication' => 'Nội soi tai mũi họng',
            'result' => 'Họng đỏ xung huyết, amidan sưng nhẹ',
            'treatment' => 'Cefixime 200mg x 2 lần/ngày, Paracetamol 500mg khi sốt',
            'follow_up_date' => '2026-11-12',
        ];

        $response = $this->postJson("/api/v1/visits/{$visit->id}/medical-record", $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Tạo hồ sơ bệnh án thành công.')
            ->assertJsonPath('data.visit_id', $visit->id)
            ->assertJsonPath('data.doctor_id', $doctorEmployee->id)
            ->assertJsonPath('data.diagnosis', 'Viêm họng cấp tính do vi khuẩn')
            ->assertJsonPath('data.treatment', 'Cefixime 200mg x 2 lần/ngày, Paracetamol 500mg khi sốt')
            ->assertJsonPath('data.follow_up_date', '2026-11-12');

        $this->assertDatabaseHas('medical_records', [
            'visit_id' => $visit->id,
            'diagnosis' => 'Viêm họng cấp tính do vi khuẩn',
        ]);

        $recordId = $response->json('data.id');

        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $doctorUser->id,
            'module' => 'medical_records',
            'action' => 'create',
            'table_name' => 'medical_records',
            'record_id' => (string) $recordId,
        ]);
    }

    public function test_cannot_create_duplicate_medical_record_for_same_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit();

        // 1st creation
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Chẩn đoán lần 1',
        ]);

        // Attempt 2nd creation
        $response = $this->postJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Chẩn đoán lần 2',
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Lượt khám này đã có hồ sơ bệnh án.');

        $this->assertSame(1, MedicalRecord::where('visit_id', $visit->id)->count());
    }

    public function test_cannot_create_medical_record_without_required_diagnosis(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit();

        $response = $this->postJson("/api/v1/visits/{$visit->id}/medical-record", [
            'medical_history' => 'Không có',
            'diagnosis' => '',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['diagnosis']);
    }

    public function test_cannot_create_medical_record_for_non_existent_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $response = $this->postJson('/api/v1/visits/999999/medical-record', [
            'diagnosis' => 'Bệnh thông thường',
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Không tìm thấy thông tin lượt khám.');
    }

    public function test_cannot_create_medical_record_for_cancelled_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit(['status' => Visit::STATUS_CANCELLED]);

        $response = $this->postJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Bệnh cúm',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Không thể tạo hồ sơ bệnh án cho lượt khám đã hủy.');
    }

    // ==========================================
    // 2. VIEW MEDICAL RECORD TESTS
    // ==========================================

    public function test_doctor_can_view_medical_record_for_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit();
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Viêm xoang sàng',
            'treatment' => 'Xịt mũi Steroid',
            'follow_up_date' => '2026-11-20',
        ]);

        $response = $this->getJson("/api/v1/visits/{$visit->id}/medical-record");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.diagnosis', 'Viêm xoang sàng')
            ->assertJsonPath('data.treatment', 'Xịt mũi Steroid')
            ->assertJsonPath('data.follow_up_date', '2026-11-20');
    }

    public function test_returns_404_when_viewing_medical_record_for_visit_without_record(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit();

        $response = $this->getJson("/api/v1/visits/{$visit->id}/medical-record");

        $response->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Lượt khám này chưa có hồ sơ bệnh án.');
    }

    // ==========================================
    // 3. UPDATE MEDICAL RECORD TESTS
    // ==========================================

    public function test_doctor_can_update_medical_record_for_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit();
        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Chẩn đoán ban đầu',
            'treatment' => 'Phác đồ 1',
        ]);

        $updatePayload = [
            'diagnosis' => 'Chẩn đoán điều chỉnh sau hội chẩn',
            'treatment' => 'Phác đồ phối hợp kháng sinh',
            'result' => 'Bệnh nhân đáp ứng tốt',
        ];

        $response = $this->putJson("/api/v1/visits/{$visit->id}/medical-record", $updatePayload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Cập nhật hồ sơ bệnh án thành công.')
            ->assertJsonPath('data.diagnosis', 'Chẩn đoán điều chỉnh sau hội chẩn')
            ->assertJsonPath('data.treatment', 'Phác đồ phối hợp kháng sinh');

        $this->assertDatabaseHas('medical_records', [
            'id' => $record->id,
            'diagnosis' => 'Chẩn đoán điều chỉnh sau hội chẩn',
        ]);

        // Verify audit log has old and new values
        $auditLog = AuditLog::where('module', 'medical_records')
            ->where('action', 'update')
            ->where('record_id', (string) $record->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($auditLog);
        $this->assertEquals('Chẩn đoán ban đầu', $auditLog->old_values['diagnosis']);
        $this->assertEquals('Chẩn đoán điều chỉnh sau hội chẩn', $auditLog->new_values['diagnosis']);
    }

    public function test_cannot_update_medical_record_for_visit_without_record(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctorUser);

        $visit = $this->createVisit();

        $response = $this->putJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Chẩn đoán mới',
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Lượt khám này chưa có hồ sơ bệnh án để cập nhật.');
    }

    // ==========================================
    // 4. RBAC & CLINICAL PRIVACY PROTECTION TESTS
    // ==========================================

    public function test_receptionist_is_forbidden_from_medical_record_endpoints(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        $visit = $this->createVisit();
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Hồ sơ bí mật',
        ]);

        // GET endpoint
        $this->getJson("/api/v1/visits/{$visit->id}/medical-record")
            ->assertStatus(403)
            ->assertJsonPath('success', false);

        // POST endpoint
        $this->postJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Không được phép',
        ])->assertStatus(403)
            ->assertJsonPath('success', false);

        // PUT endpoint
        $this->putJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Không được phép',
        ])->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_cashier_is_forbidden_from_medical_record_endpoints(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $visit = $this->createVisit();
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Hồ sơ y tế nội bộ',
        ]);

        // GET endpoint
        $this->getJson("/api/v1/visits/{$visit->id}/medical-record")
            ->assertStatus(403)
            ->assertJsonPath('success', false);

        // POST endpoint
        $this->postJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Không được phép',
        ])->assertStatus(403)
            ->assertJsonPath('success', false);

        // PUT endpoint
        $this->putJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Không được phép',
        ])->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_receptionist_and_cashier_do_not_receive_diagnosis_treatment_via_visit_api(): void
    {
        $visit = $this->createVisit();
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Bệnh nhạy cảm bảo mật cao',
            'treatment' => 'Phác đồ điều trị chuyên biệt',
        ]);

        // 1. Receptionist tests visit show API
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $resReceptionist = $this->authenticate($receptionist)->getJson("/api/v1/visits/{$visit->id}");
        $resReceptionist->assertStatus(200);

        // Receptionist cannot see medical_record data
        $this->assertNull($resReceptionist->json('data.medical_record'));
        $resReceptionist->assertJsonMissing(['diagnosis' => 'Bệnh nhạy cảm bảo mật cao']);
        $resReceptionist->assertJsonMissing(['treatment' => 'Phác đồ điều trị chuyên biệt']);

        // 2. Cashier tests visit show API
        $cashier = $this->createUserWithRole('CASHIER');
        $resCashier = $this->authenticate($cashier)->getJson("/api/v1/visits/{$visit->id}");
        $resCashier->assertStatus(200);

        // Cashier cannot see medical_record data
        $this->assertNull($resCashier->json('data.medical_record'));
        $resCashier->assertJsonMissing(['diagnosis' => 'Bệnh nhạy cảm bảo mật cao']);
        $resCashier->assertJsonMissing(['treatment' => 'Phác đồ điều trị chuyên biệt']);
    }

    public function test_doctor_and_admin_receive_medical_record_data_via_visit_api(): void
    {
        $visit = $this->createVisit();
        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Viêm phổi cộng đồng',
            'treatment' => 'Levofloxacin 500mg',
        ]);

        // 1. Doctor tests visit show API
        $doctor = $this->createUserWithRole('DOCTOR');
        $resDoctor = $this->authenticate($doctor)->getJson("/api/v1/visits/{$visit->id}");
        $resDoctor->assertStatus(200)
            ->assertJsonPath('data.medical_record.diagnosis', 'Viêm phổi cộng đồng')
            ->assertJsonPath('data.medical_record.treatment', 'Levofloxacin 500mg');

        // 2. Admin tests visit show API
        $admin = $this->createUserWithRole('ADMIN');
        $resAdmin = $this->authenticate($admin)->getJson("/api/v1/visits/{$visit->id}");
        $resAdmin->assertStatus(200)
            ->assertJsonPath('data.medical_record.diagnosis', 'Viêm phổi cộng đồng')
            ->assertJsonPath('data.medical_record.treatment', 'Levofloxacin 500mg');
    }

    public function test_can_access_medical_record_by_direct_id_endpoints(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctor);

        $visit = $this->createVisit();
        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $visit->employee_id,
            'diagnosis' => 'Viêm dạ dày',
            'treatment' => 'Omeprazole 20mg',
        ]);

        // GET direct
        $this->getJson("/api/v1/medical-records/{$record->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.diagnosis', 'Viêm dạ dày');

        // PUT direct
        $this->putJson("/api/v1/medical-records/{$record->id}", [
            'treatment' => 'Esomeprazole 40mg',
        ])->assertStatus(200)
            ->assertJsonPath('data.treatment', 'Esomeprazole 40mg');
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $visit = $this->createVisit();

        $this->getJson("/api/v1/visits/{$visit->id}/medical-record")
            ->assertStatus(401);

        $this->postJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Viêm phế quản',
        ])->assertStatus(401);

        $this->putJson("/api/v1/visits/{$visit->id}/medical-record", [
            'diagnosis' => 'Viêm phế quản',
        ])->assertStatus(401);
    }
}
