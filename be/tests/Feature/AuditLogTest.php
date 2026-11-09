<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\MedicalRecord;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
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
     * Helper to create a patient and a stored file on disk.
     */
    protected function createPatientWithFile(User $uploader, string $fileName = 'Test_XRay.png', string $mimeType = 'image/png', string $content = 'fake-image-binary-stream'): array
    {
        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'status' => 'ACTIVE',
        ]);

        $path = "patient_files/{$patient->id}/{$fileName}";
        Storage::disk('local')->put($path, $content);

        $fileRecord = PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => $fileName,
            'storage_path' => $path,
            'mime_type' => $mimeType,
            'file_size' => strlen($content),
            'uploaded_by' => $uploader->id,
            'created_at' => now(),
        ]);

        return [$patient, $fileRecord, $path, $content];
    }

    /**
     * Test audit logs are append-only and cannot be updated.
     */
    public function test_audit_logs_are_append_only_and_cannot_be_updated(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $log = AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'users',
            'action' => 'create',
            'table_name' => 'users',
            'record_id' => '1',
            'old_values' => null,
            'new_values' => ['username' => 'test'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'created_at' => now(),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('append-only');

        $log->update(['action' => 'tampered_action']);
    }

    /**
     * Test audit logs are append-only and cannot be deleted.
     */
    public function test_audit_logs_are_append_only_and_cannot_be_deleted(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $log = AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'users',
            'action' => 'create',
            'table_name' => 'users',
            'record_id' => '1',
            'old_values' => null,
            'new_values' => ['username' => 'test'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'created_at' => now(),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('append-only');

        $log->delete();
    }

    /**
     * Test admin can view paginated audit logs.
     */
    public function test_admin_can_view_paginated_audit_logs(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'medical_records',
            'action' => 'view',
            'table_name' => 'medical_records',
            'record_id' => '10',
            'old_values' => null,
            'new_values' => ['note' => 'test entry'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)->getJson('/api/v1/audit-logs');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'user_id',
                        'module',
                        'action',
                        'table_name',
                        'record_id',
                        'ip_address',
                        'created_at',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'total',
                ],
            ]);

        $this->assertGreaterThanOrEqual(1, $response->json('meta.total'));
    }

    /**
     * Test unauthenticated user cannot view audit logs.
     */
    public function test_unauthenticated_user_cannot_view_audit_logs(): void
    {
        $response = $this->getJson('/api/v1/audit-logs');

        $response->assertStatus(401);
    }

    /**
     * Test non-admin user without permission cannot view audit logs.
     */
    public function test_unauthorized_user_cannot_view_audit_logs(): void
    {
        $nurse = $this->createUserWithRole('NURSE');

        $response = $this->authenticate($nurse)->getJson('/api/v1/audit-logs');

        $response->assertStatus(403);
    }

    /**
     * Test viewing single audit log detail.
     */
    public function test_admin_can_view_single_audit_log_detail(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $log = AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'patient_files',
            'action' => 'preview',
            'table_name' => 'patient_files',
            'record_id' => '42',
            'old_values' => null,
            'new_values' => ['file_name' => 'xray.png'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Mozilla/5.0',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)->getJson("/api/v1/audit-logs/{$log->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $log->id)
            ->assertJsonPath('data.module', 'patient_files')
            ->assertJsonPath('data.action', 'preview')
            ->assertJsonPath('data.record_id', '42');
    }

    /**
     * Test filtering audit logs by module and action.
     */
    public function test_filtering_audit_logs_by_module_and_action(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'invoices',
            'action' => 'export_csv',
            'table_name' => 'invoices',
            'record_id' => null,
            'created_at' => now(),
        ]);

        AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'medical_records',
            'action' => 'update',
            'table_name' => 'medical_records',
            'record_id' => '5',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->getJson('/api/v1/audit-logs?module=invoices&action=export_csv');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        foreach ($data as $item) {
            $this->assertSame('invoices', $item['module']);
            $this->assertSame('export_csv', $item['action']);
        }
    }

    /**
     * Test audit logs metadata endpoint returns distinct modules and actions.
     */
    public function test_audit_logs_metadata_endpoint(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'patient_files',
            'action' => 'download',
            'table_name' => 'patient_files',
            'record_id' => '1',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)->getJson('/api/v1/audit-logs/metadata');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'modules',
                    'actions',
                ],
            ]);

        $this->assertContains('patient_files', $response->json('data.modules'));
        $this->assertContains('download', $response->json('data.actions'));
    }

    /**
     * Test viewing and downloading clinical patient files automatically creates audit logs.
     */
    public function test_viewing_and_downloading_patient_files_automatically_creates_audit_logs(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord, $path, $content] = $this->createPatientWithFile(
            $doctor,
            'Sieu_Am_Tim.pdf',
            'application/pdf',
            '%PDF-1.4 test cardiac ultrasound'
        );

        $initialLogCount = AuditLog::where('module', 'patient_files')->count();

        // 1. Preview file
        $previewResponse = $this->authenticate($doctor)
            ->get("/api/v1/patient-files/{$fileRecord->id}/preview");
        $previewResponse->assertStatus(200);

        $previewLog = AuditLog::where('module', 'patient_files')
            ->where('action', 'preview')
            ->where('record_id', (string) $fileRecord->id)
            ->first();

        $this->assertNotNull($previewLog);
        $this->assertSame($doctor->id, $previewLog->user_id);

        // 2. Download file
        $downloadResponse = $this->authenticate($doctor)
            ->get("/api/v1/patient-files/{$fileRecord->id}/download");
        $downloadResponse->assertStatus(200);

        $downloadLog = AuditLog::where('module', 'patient_files')
            ->where('action', 'download')
            ->where('record_id', (string) $fileRecord->id)
            ->first();

        $this->assertNotNull($downloadLog);
        $this->assertSame($doctor->id, $downloadLog->user_id);
    }

    /**
     * Test viewing medical record automatically creates audit log.
     */
    public function test_viewing_medical_record_automatically_creates_audit_log(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'gender' => 'FEMALE',
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
            'patient_id' => $patient->id,
            'employee_id' => $doctor->employee_id,
            'service_id' => $service->id,
            'visit_code' => 'LK'.fake()->unique()->numerify('######'),
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 250000,
            'discount_amount' => 0,
            'total_amount' => 250000,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
            'status' => Visit::STATUS_COMPLETED,
        ]);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->employee_id,
            'diagnosis' => 'Viêm phế quản cấp',
            'treatment' => 'Kháng sinh, nghỉ ngơi 5 ngày',
        ]);

        $response = $this->authenticate($doctor)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record");

        $response->assertStatus(200);

        $viewLog = AuditLog::where('module', 'medical_records')
            ->where('action', 'view')
            ->where('record_id', (string) $record->id)
            ->first();

        $this->assertNotNull($viewLog);
        $this->assertSame($doctor->id, $viewLog->user_id);
    }

    /**
     * Test CSV export automatically creates audit log.
     */
    public function test_csv_export_automatically_creates_audit_log(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->get('/api/v1/exports/invoices');
        $response->assertStatus(200);

        $exportLog = AuditLog::where('module', 'invoices')
            ->where('action', 'export_csv')
            ->latest('id')
            ->first();

        $this->assertNotNull($exportLog);
        $this->assertSame($admin->id, $exportLog->user_id);
    }

    /**
     * Test updating medical record automatically creates audit log with old and new values.
     */
    public function test_updating_medical_record_automatically_creates_audit_log(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám tổng quát Tai Mũi Họng',
            'price' => 200000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'employee_id' => $doctor->employee_id,
            'service_id' => $service->id,
            'visit_code' => 'LK'.fake()->unique()->numerify('######'),
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'status' => Visit::STATUS_COMPLETED,
        ]);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->employee_id,
            'diagnosis' => 'Viêm họng cấp',
            'treatment' => 'Súc họng nước muối',
        ]);

        $response = $this->authenticate($doctor)
            ->putJson("/api/v1/visits/{$visit->id}/medical-record", [
                'diagnosis' => 'Viêm amidan cấp mủ',
                'treatment' => 'Kháng sinh Augmentin 1g x 7 ngày',
                'edit_reason' => 'Bệnh nhân tái khám có triệu chứng sốt cao và sưng amidan',
            ]);

        $response->assertStatus(200);

        $updateLog = AuditLog::where('module', 'medical_records')
            ->where('action', 'update')
            ->where('record_id', (string) $record->id)
            ->first();

        $this->assertNotNull($updateLog);
        $this->assertSame($doctor->id, $updateLog->user_id);
        $this->assertSame('Viêm họng cấp', $updateLog->old_values['diagnosis']);
        $this->assertSame('Viêm amidan cấp mủ', $updateLog->new_values['diagnosis']);
        $this->assertSame('Bệnh nhân tái khám có triệu chứng sốt cao và sưng amidan', $updateLog->new_values['edit_reason']);
    }

    /**
     * Test viewing medical record by direct ID automatically creates audit log.
     */
    public function test_viewing_medical_record_by_id_automatically_creates_audit_log(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'gender' => 'FEMALE',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám Da liễu',
            'price' => 300000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'employee_id' => $doctor->employee_id,
            'service_id' => $service->id,
            'visit_code' => 'LK'.fake()->unique()->numerify('######'),
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'status' => Visit::STATUS_COMPLETED,
        ]);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctor->employee_id,
            'diagnosis' => 'Viêm da tiếp xúc dị ứng',
            'treatment' => 'Bôi kem corticoid nhẹ',
        ]);

        $response = $this->authenticate($doctor)
            ->getJson("/api/v1/medical-records/{$record->id}");

        $response->assertStatus(200);

        $viewLog = AuditLog::where('module', 'medical_records')
            ->where('action', 'view')
            ->where('record_id', (string) $record->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($viewLog);
        $this->assertSame($doctor->id, $viewLog->user_id);
    }

    /**
     * Test updating user status automatically creates audit log.
     */
    public function test_updating_user_status_automatically_creates_audit_log(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetNurse = $this->createUserWithRole('NURSE', 'ACTIVE');

        $response = $this->authenticate($admin)
            ->patchJson("/api/v1/users/{$targetNurse->id}/status", [
                'status' => 'LOCKED',
            ]);

        $response->assertStatus(200);

        $statusLog = AuditLog::where('module', 'users')
            ->where('action', 'status_update')
            ->where('record_id', (string) $targetNurse->id)
            ->first();

        $this->assertNotNull($statusLog);
        $this->assertSame($admin->id, $statusLog->user_id);
        $this->assertSame('ACTIVE', $statusLog->old_values['status']);
        $this->assertSame('LOCKED', $statusLog->new_values['status']);
    }

    /**
     * Test updating user roles automatically creates audit log.
     */
    public function test_updating_user_roles_automatically_creates_audit_log(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('NURSE');

        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        $response = $this->authenticate($admin)
            ->putJson("/api/v1/rbac/users/{$targetUser->id}/roles", [
                'roles' => [$doctorRole->name],
            ]);

        $response->assertStatus(200);

        $rolesLog = AuditLog::where('module', 'auth')
            ->where('action', 'update_user_roles')
            ->where('record_id', (string) $targetUser->id)
            ->first();

        $this->assertNotNull($rolesLog);
        $this->assertSame($admin->id, $rolesLog->user_id);
        $this->assertContains($doctorRole->id, $rolesLog->new_values['role_ids']);
    }

    /**
     * Test export for patients, cashbook, and inventory creates audit logs.
     */
    public function test_exporting_all_modules_automatically_creates_audit_logs(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Export patients
        $responsePatients = $this->authenticate($admin)->get('/api/v1/exports/patients');
        $responsePatients->assertStatus(200);

        $patientLog = AuditLog::where('module', 'patients')
            ->where('action', 'export_csv')
            ->latest('id')
            ->first();
        $this->assertNotNull($patientLog);
        $this->assertSame($admin->id, $patientLog->user_id);

        // Export cashbook
        $responseCashbook = $this->authenticate($admin)->get('/api/v1/exports/cashbook');
        $responseCashbook->assertStatus(200);

        $cashLog = AuditLog::where('module', 'cashbook')
            ->where('action', 'export_csv')
            ->latest('id')
            ->first();
        $this->assertNotNull($cashLog);
        $this->assertSame($admin->id, $cashLog->user_id);

        // Export inventory
        $responseInventory = $this->authenticate($admin)->get('/api/v1/exports/inventory');
        $responseInventory->assertStatus(200);

        $invLog = AuditLog::where('module', 'inventory')
            ->where('action', 'export_csv')
            ->latest('id')
            ->first();
        $this->assertNotNull($invLog);
        $this->assertSame($admin->id, $invLog->user_id);
    }
}
