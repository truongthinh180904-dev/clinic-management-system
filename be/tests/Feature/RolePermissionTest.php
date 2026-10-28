<?php

namespace Tests\Feature;

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

class RolePermissionTest extends TestCase
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
     * Helper to create a sample patient, visit, and medical record.
     */
    protected function createVisitWithMedicalRecord(User $doctorUser): array
    {
        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh nhân Thử Nghiệm RBAC',
            'gender' => 'FEMALE',
            'phone' => '0912345678',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám chuyên khoa',
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB'.fake()->unique()->numerify('########'),
            'patient_id' => $patient->id,
            'employee_id' => $doctorUser->employee_id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'status' => Visit::STATUS_COMPLETED,
        ]);

        $record = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $doctorUser->employee_id,
            'diagnosis' => 'Viêm họng cấp tính',
            'treatment' => 'Kháng sinh amoxicillin 500mg',
        ]);

        return [$patient, $visit, $record];
    }

    /**
     * Helper to create a sample patient file.
     */
    protected function createPatientFile(Patient $patient, User $uploader, ?Visit $visit = null): PatientFile
    {
        $path = "patient_files/{$patient->id}/sample_file.pdf";
        Storage::disk('local')->put($path, 'sample file content');

        return PatientFile::create([
            'patient_id' => $patient->id,
            'visit_id' => $visit?->id,
            'file_name' => 'sample_file.pdf',
            'storage_path' => $path,
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'uploaded_by' => $uploader->id,
            'created_at' => now(),
        ]);
    }

    public function test_seeder_registers_sensitive_health_record_and_file_permissions(): void
    {
        $this->assertDatabaseHas('permissions', [
            'permission_key' => 'medical_records.history.view',
            'module' => 'medical_records',
        ]);

        $this->assertDatabaseHas('permissions', [
            'permission_key' => 'patient_files.view',
            'module' => 'patient_files',
        ]);

        $this->assertDatabaseHas('permissions', [
            'permission_key' => 'patient_files.upload',
            'module' => 'patient_files',
        ]);

        $this->assertDatabaseHas('permissions', [
            'permission_key' => 'patient_files.delete',
            'module' => 'patient_files',
        ]);

        $this->assertDatabaseHas('roles', [
            'name' => 'NURSE',
        ]);
    }

    public function test_admin_role_has_full_access_to_all_permissions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $this->assertTrue($admin->hasPermission('medical_records.history.view'));
        $this->assertTrue($admin->hasPermission('medical_records.view'));
        $this->assertTrue($admin->hasPermission('medical_records.create'));
        $this->assertTrue($admin->hasPermission('medical_records.update'));
        $this->assertTrue($admin->hasPermission('patient_files.view'));
        $this->assertTrue($admin->hasPermission('patient_files.upload'));
        $this->assertTrue($admin->hasPermission('patient_files.delete'));
        $this->assertTrue($admin->hasPermission('roles.manage'));
    }

    public function test_doctor_has_full_clinical_medical_and_patient_file_permissions(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $this->assertTrue($doctor->hasPermission('medical_records.view'));
        $this->assertTrue($doctor->hasPermission('medical_records.create'));
        $this->assertTrue($doctor->hasPermission('medical_records.update'));
        $this->assertTrue($doctor->hasPermission('medical_records.history.view'));
        $this->assertTrue($doctor->hasPermission('patient_files.view'));
        $this->assertTrue($doctor->hasPermission('patient_files.upload'));
        $this->assertTrue($doctor->hasPermission('patient_files.delete'));

        // Doctors do not have admin permissions
        $this->assertFalse($doctor->hasPermission('roles.manage'));
        $this->assertFalse($doctor->hasPermission('users.create'));
    }

    public function test_nurse_has_file_view_and_upload_but_no_delete_and_no_medical_records(): void
    {
        $nurse = $this->createUserWithRole('NURSE');

        // Allowed
        $this->assertTrue($nurse->hasPermission('patients.view'));
        $this->assertTrue($nurse->hasPermission('patient_files.view'));
        $this->assertTrue($nurse->hasPermission('patient_files.upload'));

        // Forbidden
        $this->assertFalse($nurse->hasPermission('patient_files.delete'));
        $this->assertFalse($nurse->hasPermission('medical_records.view'));
        $this->assertFalse($nurse->hasPermission('medical_records.create'));
        $this->assertFalse($nurse->hasPermission('medical_records.update'));
        $this->assertFalse($nurse->hasPermission('medical_records.history.view'));
    }

    public function test_receptionist_has_file_view_and_upload_but_no_delete_and_no_medical_records(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        // Allowed
        $this->assertTrue($receptionist->hasPermission('patients.view'));
        $this->assertTrue($receptionist->hasPermission('patient_files.view'));
        $this->assertTrue($receptionist->hasPermission('patient_files.upload'));

        // Forbidden
        $this->assertFalse($receptionist->hasPermission('patient_files.delete'));
        $this->assertFalse($receptionist->hasPermission('medical_records.view'));
        $this->assertFalse($receptionist->hasPermission('medical_records.create'));
        $this->assertFalse($receptionist->hasPermission('medical_records.update'));
        $this->assertFalse($receptionist->hasPermission('medical_records.history.view'));
    }

    public function test_cashier_and_accountant_are_completely_blocked_from_clinical_files_and_records(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $accountant = $this->createUserWithRole('ACCOUNTANT');

        foreach ([$cashier, $accountant] as $user) {
            $this->assertFalse($user->hasPermission('patient_files.view'));
            $this->assertFalse($user->hasPermission('patient_files.upload'));
            $this->assertFalse($user->hasPermission('patient_files.delete'));
            $this->assertFalse($user->hasPermission('medical_records.view'));
            $this->assertFalse($user->hasPermission('medical_records.create'));
            $this->assertFalse($user->hasPermission('medical_records.update'));
            $this->assertFalse($user->hasPermission('medical_records.history.view'));
        }
    }

    public function test_api_roles_and_permissions_endpoints(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Roles list
        $rolesRes = $this->authenticate($admin)
            ->getJson('/api/v1/roles')
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $rolesData = $rolesRes->json('data');
        $this->assertNotEmpty($rolesData);

        // Permissions catalog
        $permsRes = $this->authenticate($admin)
            ->getJson('/api/v1/permissions')
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $perms = collect($permsRes->json('data'));
        $this->assertTrue($perms->contains('permission_key', 'medical_records.history.view'));
        $this->assertTrue($perms->contains('permission_key', 'patient_files.view'));
        $this->assertTrue($perms->contains('permission_key', 'patient_files.upload'));
        $this->assertTrue($perms->contains('permission_key', 'patient_files.delete'));

        // Unauthorized user receives 403
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier)
            ->getJson('/api/v1/roles')
            ->assertStatus(403);
    }

    public function test_admin_can_update_role_permissions_with_audit_log(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $nurseRole = Role::where('name', 'NURSE')->firstOrFail();

        $response = $this->authenticate($admin)
            ->putJson("/api/v1/roles/{$nurseRole->id}/permissions", [
                'permission_keys' => ['patients.view', 'patient_files.view'],
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'auth',
            'action' => 'update_role_permissions',
            'record_id' => (string) $nurseRole->id,
        ]);
    }

    public function test_admin_can_update_user_roles_with_audit_log(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $targetUser = $this->createUserWithRole('NURSE');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        $response = $this->authenticate($admin)
            ->putJson("/api/v1/users/{$targetUser->id}/roles", [
                'role_names' => ['DOCTOR'],
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertTrue($targetUser->fresh()->hasRole('DOCTOR'));

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'auth',
            'action' => 'update_user_roles',
            'record_id' => (string) $targetUser->id,
        ]);
    }

    public function test_prevent_removing_admin_role_from_last_active_admin(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();

        // Attempt removing ADMIN role from the only active admin
        $response = $this->authenticate($admin)
            ->putJson("/api/v1/users/{$admin->id}/roles", [
                'roles' => [$doctorRole->id],
            ])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_doctor_can_access_medical_record_history_endpoint(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $visit, $record] = $this->createVisitWithMedicalRecord($doctor);

        $this->authenticate($doctor)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record/history")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->authenticate($doctor)
            ->getJson("/api/v1/medical-records/{$record->id}/history")
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_nurse_and_cashier_cannot_access_medical_record_history_endpoint(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $nurse = $this->createUserWithRole('NURSE');
        $cashier = $this->createUserWithRole('CASHIER');
        [$patient, $visit, $record] = $this->createVisitWithMedicalRecord($doctor);

        // Nurse receives 403 Forbidden
        $this->authenticate($nurse)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record/history")
            ->assertStatus(403);

        $this->authenticate($nurse)
            ->getJson("/api/v1/medical-records/{$record->id}/history")
            ->assertStatus(403);

        // Cashier receives 403 Forbidden
        $this->authenticate($cashier)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record/history")
            ->assertStatus(403);

        $this->authenticate($cashier)
            ->getJson("/api/v1/medical-records/{$record->id}/history")
            ->assertStatus(403);
    }

    public function test_nurse_can_access_patient_files_but_cannot_delete(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $nurse = $this->createUserWithRole('NURSE');
        [$patient, $visit] = $this->createVisitWithMedicalRecord($doctor);
        $file = $this->createPatientFile($patient, $doctor, $visit);

        // Nurse can list patient files
        $this->authenticate($nurse)
            ->getJson("/api/v1/patients/{$patient->id}/files")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        // Nurse can list visit files
        $this->authenticate($nurse)
            ->getJson("/api/v1/visits/{$visit->id}/files")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        // Nurse can preview file
        $this->authenticate($nurse)
            ->get("/api/v1/patient-files/{$file->id}/preview")
            ->assertStatus(200);

        // Nurse CANNOT delete file
        $this->authenticate($nurse)
            ->deleteJson("/api/v1/patient-files/{$file->id}")
            ->assertStatus(403);
    }

    public function test_cashier_is_completely_blocked_from_patient_files(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $cashier = $this->createUserWithRole('CASHIER');
        [$patient, $visit] = $this->createVisitWithMedicalRecord($doctor);
        $file = $this->createPatientFile($patient, $doctor, $visit);

        // Cashier cannot list patient files
        $this->authenticate($cashier)
            ->getJson("/api/v1/patients/{$patient->id}/files")
            ->assertStatus(403);

        // Cashier cannot list visit files
        $this->authenticate($cashier)
            ->getJson("/api/v1/visits/{$visit->id}/files")
            ->assertStatus(403);

        // Cashier cannot preview or download file
        $this->authenticate($cashier)
            ->getJson("/api/v1/patient-files/{$file->id}/preview")
            ->assertStatus(403);

        $this->authenticate($cashier)
            ->getJson("/api/v1/patient-files/{$file->id}/download")
            ->assertStatus(403);

        // Cashier cannot delete file
        $this->authenticate($cashier)
            ->deleteJson("/api/v1/patient-files/{$file->id}")
            ->assertStatus(403);
    }
}
