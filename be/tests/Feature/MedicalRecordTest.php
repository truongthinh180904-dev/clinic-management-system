<?php

namespace Tests\Feature;

use App\Models\AuditLog;
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

class MedicalRecordTest extends TestCase
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

    /**
     * Helper to create a baseline visit.
     */
    protected function createTestVisit(string $status = Visit::STATUS_SCHEDULED): array
    {
        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh nhân Thử nghiệm',
            'gender' => 'FEMALE',
            'phone' => '0912345678',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác sĩ CK1 Nguyễn Văn A',
            'phone' => '0987654321',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám tổng quát Nội khoa',
            'price' => 250000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB'.fake()->unique()->numerify('########'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 250000,
            'discount_amount' => 0,
            'total_amount' => 250000,
            'status' => $status,
        ]);

        return [$patient, $doctor, $service, $visit];
    }

    public function test_doctor_can_create_medical_record_and_visit_status_becomes_completed(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, $doctor, , $visit] = $this->createTestVisit(Visit::STATUS_IN_PROGRESS);

        $payload = [
            'doctor_id' => $doctor->id,
            'medical_history' => 'Tiền sử viêm phế quản mạn tính, sốt nhẹ 38 độ C 2 ngày qua.',
            'diagnosis' => 'Viêm phế quản cấp thể nhẹ (J20)',
            'indication' => 'Chụp X-quang phổi thẳng, công thức máu tổng quát',
            'result' => 'Hình ảnh rốn phổi đậm, bạch cầu tăng nhẹ 11.2 G/L',
            'treatment' => 'Kháng sinh Augmentin 1g x 2 lần/ngày x 7 ngày, Paracetamol 500mg khi sốt',
            'follow_up_date' => now()->addDays(7)->format('Y-m-d'),
        ];

        $response = $this->authenticate($doctorUser)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.diagnosis', 'Viêm phế quản cấp thể nhẹ (J20)')
            ->assertJsonPath('data.treatment', $payload['treatment']);

        // Check that visit status was synchronized to COMPLETED
        $visit->refresh();
        $this->assertEquals(Visit::STATUS_COMPLETED, $visit->status);

        // Check database for record
        $this->assertDatabaseHas('medical_records', [
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Viêm phế quản cấp thể nhẹ (J20)',
        ]);

        // Check audit log
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'medical_records',
            'action' => 'create',
            'user_id' => $doctorUser->id,
        ]);
    }

    public function test_validation_error_when_creating_medical_record_without_diagnosis(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, , , $visit] = $this->createTestVisit();

        $response = $this->authenticate($doctorUser)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", [
                'medical_history' => 'Không có chẩn đoán',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['diagnosis']);
    }

    public function test_cannot_create_medical_record_for_cancelled_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, , , $visit] = $this->createTestVisit(Visit::STATUS_CANCELLED);

        $response = $this->authenticate($doctorUser)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", [
                'diagnosis' => 'Chẩn đoán trên lượt khám hủy',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_cannot_create_duplicate_medical_record_for_same_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, $doctor, , $visit] = $this->createTestVisit();

        MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Bệnh án đầu tiên',
        ]);

        $response = $this->authenticate($doctorUser)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", [
                'diagnosis' => 'Bệnh án thứ hai cố tình tạo trùng',
            ]);

        $response->assertStatus(409)
            ->assertJsonPath('success', false);
    }

    public function test_doctor_can_view_medical_record_for_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, $doctor, , $visit] = $this->createTestVisit(Visit::STATUS_COMPLETED);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->id,
            'medical_history' => 'Đau rát họng, ho khan',
            'diagnosis' => 'Viêm họng hạt cấp tính',
            'treatment' => 'Kháng sinh, xịt họng thảo dược',
            'follow_up_date' => now()->addDays(5)->format('Y-m-d'),
        ]);

        $response = $this->authenticate($doctorUser)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $record->id)
            ->assertJsonPath('data.diagnosis', 'Viêm họng hạt cấp tính');
    }

    public function test_doctor_can_update_medical_record_for_visit(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, $doctor, , $visit] = $this->createTestVisit(Visit::STATUS_COMPLETED);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Chẩn đoán ban đầu',
            'treatment' => 'Phác đồ 1',
        ]);

        $updatePayload = [
            'diagnosis' => 'Chẩn đoán điều chỉnh sau khi có kết quả xét nghiệm',
            'treatment' => 'Phác đồ 2 bổ sung kháng sinh phổ rộng',
        ];

        $response = $this->authenticate($doctorUser)
            ->putJson("/api/v1/visits/{$visit->id}/medical-record", $updatePayload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.diagnosis', $updatePayload['diagnosis'])
            ->assertJsonPath('data.treatment', $updatePayload['treatment']);

        $record->refresh();
        $this->assertEquals($updatePayload['diagnosis'], $record->diagnosis);

        // Check update audit log
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'medical_records',
            'action' => 'update',
            'record_id' => (string) $record->id,
        ]);
    }

    public function test_user_without_medical_record_permission_cannot_access(): void
    {
        $receptionistUser = $this->createUserWithRole('RECEPTIONIST');
        [, , , $visit] = $this->createTestVisit();

        // Attempting to post a medical record
        $response = $this->authenticate($receptionistUser)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", [
                'diagnosis' => 'Chẩn đoán trái phép',
            ]);

        $response->assertStatus(403);
    }

    public function test_doctor_can_view_medical_record_audit_history_with_edit_reason(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, $doctor, , $visit] = $this->createTestVisit(Visit::STATUS_IN_PROGRESS);

        // 1. Create medical record
        $createPayload = [
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Chẩn đoán ban đầu: Viêm họng cấp',
            'treatment' => 'Kháng sinh uống 5 ngày',
        ];

        $createRes = $this->authenticate($doctorUser)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", $createPayload);
        $createRes->assertStatus(201);

        // 2. Update medical record with explicit edit_reason
        $updatePayload = [
            'diagnosis' => 'Chẩn đoán sửa đổi: Viêm phế quản co thắt',
            'treatment' => 'Đổi phác đồ tiêm khí dung và theo dõi',
            'edit_reason' => 'Bệnh nhân tái sốt và có cơn khó thở, điều chỉnh phác đồ',
        ];

        $updateRes = $this->authenticate($doctorUser)
            ->putJson("/api/v1/visits/{$visit->id}/medical-record", $updatePayload);
        $updateRes->assertStatus(200);

        // 3. Fetch audit history
        $historyRes = $this->authenticate($doctorUser)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record/history");

        $historyRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.action', 'update')
            ->assertJsonPath('data.0.edit_reason', 'Bệnh nhân tái sốt và có cơn khó thở, điều chỉnh phác đồ')
            ->assertJsonPath('data.1.action', 'create');
    }

    public function test_unauthorized_user_cannot_update_or_view_medical_record_history(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        $receptionistUser = $this->createUserWithRole('RECEPTIONIST');
        [, $doctor, , $visit] = $this->createTestVisit(Visit::STATUS_COMPLETED);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Bệnh án bảo mật',
        ]);

        // Receptionist attempts update
        $updateRes = $this->authenticate($receptionistUser)
            ->putJson("/api/v1/visits/{$visit->id}/medical-record", [
                'diagnosis' => 'Sửa bất hợp pháp',
            ]);
        $updateRes->assertStatus(403);

        // Receptionist attempts viewing history
        $historyRes = $this->authenticate($receptionistUser)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record/history");
        $historyRes->assertStatus(403);
    }

    public function test_medical_record_history_returns_404_when_no_record_exists(): void
    {
        $doctorUser = $this->createUserWithRole('DOCTOR');
        [, , , $visit] = $this->createTestVisit(Visit::STATUS_SCHEDULED);

        $res = $this->authenticate($doctorUser)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record/history");

        $res->assertStatus(404)
            ->assertJsonPath('success', false);
    }
}
