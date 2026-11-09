<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PatientFileDownloadTest extends TestCase
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

    public function test_authenticated_doctor_can_preview_clinical_file_inline(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord, $path, $content] = $this->createPatientWithFile(
            $doctor,
            'Ket_Qua_CT.pdf',
            'application/pdf',
            '%PDF-1.4 test stream content'
        );

        $response = $this->authenticate($doctor)
            ->get("/api/v1/patient-files/{$fileRecord->id}/preview");

        $response->assertStatus(200);
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringContainsString('inline', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('Ket_Qua_CT.pdf', (string) $response->headers->get('content-disposition'));
        $this->assertSame($content, $response->streamedContent());
    }

    public function test_authenticated_doctor_can_download_clinical_file_as_attachment(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord, $path, $content] = $this->createPatientWithFile(
            $doctor,
            'Don_Thuoc_Ngoai.pdf',
            'application/pdf',
            '%PDF-1.4 prescription attachment'
        );

        $response = $this->authenticate($doctor)
            ->get("/api/v1/patient-files/{$fileRecord->id}/download");

        $response->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('Don_Thuoc_Ngoai.pdf', (string) $response->headers->get('content-disposition'));
        $this->assertSame($content, $response->streamedContent());
    }

    public function test_authenticated_user_can_preview_file_via_query_token(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $token = $doctor->createToken('browser-token')->plainTextToken;

        [$patient, $fileRecord, $path, $content] = $this->createPatientWithFile(
            $doctor,
            'Sieu_Am_Tim.png',
            'image/png',
            'raw-png-data'
        );

        $response = $this->get("/api/v1/patient-files/{$fileRecord->id}/preview?token={$token}");

        $response->assertStatus(200);
        $this->assertSame('image/png', $response->headers->get('content-type'));
        $this->assertStringContainsString('inline', (string) $response->headers->get('content-disposition'));
        $this->assertSame($content, $response->streamedContent());
    }

    public function test_authenticated_user_can_download_file_via_query_token(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $token = $doctor->createToken('browser-download-token')->plainTextToken;

        [$patient, $fileRecord, $path, $content] = $this->createPatientWithFile(
            $doctor,
            'Ket_Qua_MRI.pdf',
            'application/pdf',
            'mri-binary-content'
        );

        $response = $this->get("/api/v1/patient-files/{$fileRecord->id}/download?token={$token}");

        $response->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
        $this->assertSame($content, $response->streamedContent());
    }

    public function test_unauthenticated_request_is_rejected_with_401(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord] = $this->createPatientWithFile($doctor);

        $this->getJson("/api/v1/patient-files/{$fileRecord->id}/preview")
            ->assertStatus(401);

        $this->getJson("/api/v1/patient-files/{$fileRecord->id}/download")
            ->assertStatus(401);

        $this->deleteJson("/api/v1/patient-files/{$fileRecord->id}")
            ->assertStatus(401);
    }

    public function test_user_without_patient_files_view_permission_is_forbidden_with_403(): void
    {
        // CASHIER has 'patients.view' and 'visits.view', but NOT 'patient_files.view'
        $cashier = $this->createUserWithRole('CASHIER');
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord] = $this->createPatientWithFile($doctor);

        $this->authenticate($cashier)
            ->getJson("/api/v1/patient-files/{$fileRecord->id}/preview")
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);

        $this->authenticate($cashier)
            ->getJson("/api/v1/patient-files/{$fileRecord->id}/download")
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);

        $this->authenticate($cashier)
            ->deleteJson("/api/v1/patient-files/{$fileRecord->id}")
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Bạn không có quyền thực hiện thao tác này.',
            ]);
    }

    public function test_receptionist_can_preview_and_download_but_cannot_delete(): void
    {
        // RECEPTIONIST has 'patient_files.view' but NOT 'patient_files.delete'
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord, $path, $content] = $this->createPatientWithFile($doctor);

        // Preview allowed
        $this->authenticate($receptionist)
            ->get("/api/v1/patient-files/{$fileRecord->id}/preview")
            ->assertStatus(200);

        // Download allowed
        $this->authenticate($receptionist)
            ->get("/api/v1/patient-files/{$fileRecord->id}/download")
            ->assertStatus(200);

        // Delete rejected with 403
        $this->authenticate($receptionist)
            ->deleteJson("/api/v1/patient-files/{$fileRecord->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('patient_files', [
            'id' => $fileRecord->id,
        ]);
    }

    public function test_preview_and_download_return_404_when_file_record_not_found(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $this->authenticate($doctor)
            ->getJson('/api/v1/patient-files/999999/preview')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ]);

        $this->authenticate($doctor)
            ->getJson('/api/v1/patient-files/999999/download')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ]);
    }

    public function test_preview_and_download_return_404_when_physical_file_is_missing_on_disk(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Ghost File Patient',
            'status' => 'ACTIVE',
        ]);

        $fileRecord = PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Missing_Physical_File.pdf',
            'storage_path' => "patient_files/{$patient->id}/missing_file.pdf",
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        // Physical file does not exist on disk
        $this->authenticate($doctor)
            ->getJson("/api/v1/patient-files/{$fileRecord->id}/preview")
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Tệp tin không tồn tại trên hệ thống lưu trữ.',
            ]);

        $this->authenticate($doctor)
            ->getJson("/api/v1/patient-files/{$fileRecord->id}/download")
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Tệp tin không tồn tại trên hệ thống lưu trữ.',
            ]);
    }

    public function test_doctor_can_delete_patient_file_with_audit_trail_and_storage_removal(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        [$patient, $fileRecord, $path] = $this->createPatientWithFile(
            $doctor,
            'X_Ray_Delete_Target.jpg',
            'image/jpeg',
            'jpeg-content-to-be-deleted'
        );

        Storage::disk('local')->assertExists($path);

        $response = $this->authenticate($doctor)
            ->deleteJson("/api/v1/patient-files/{$fileRecord->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa tệp đính kèm y tế thành công.',
            ]);

        // Verify DB deletion
        $this->assertDatabaseMissing('patient_files', [
            'id' => $fileRecord->id,
        ]);

        // Verify physical storage deletion
        Storage::disk('local')->assertMissing($path);

        // Verify audit log record
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'patient_files',
            'action' => 'delete',
            'table_name' => 'patient_files',
            'record_id' => (string) $fileRecord->id,
            'user_id' => $doctor->id,
        ]);
    }

    public function test_delete_returns_404_when_file_not_found(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $this->authenticate($doctor)
            ->deleteJson('/api/v1/patient-files/999999')
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy tệp đính kèm.',
            ]);
    }
}
