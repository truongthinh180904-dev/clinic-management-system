<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PatientFileTest extends TestCase
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
     * Helper to create a test service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'DV-'.fake()->unique()->numerify('######'),
            'name' => 'Dịch vụ khám',
            'price' => 150000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    public function test_doctor_can_upload_clinical_file_for_patient(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000101',
            'full_name' => 'Tran Thi Mai',
            'gender' => 'FEMALE',
            'phone' => '0912345678',
            'status' => 'ACTIVE',
        ]);

        $file = UploadedFile::fake()->create('ket_qua_xet_nghiem.pdf', 500, 'application/pdf');

        $response = $this->authenticate($doctor)
            ->postJson("/api/v1/patients/{$patient->id}/files", [
                'file' => $file,
                'file_name' => 'Ket Qua Xet Nghiem Mau.pdf',
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tải lên tài liệu y tế thành công.',
                'data' => [
                    'patient_id' => $patient->id,
                    'file_name' => 'Ket Qua Xet Nghiem Mau.pdf',
                    'mime_type' => 'application/pdf',
                ],
            ]);

        $storagePath = $response->json('data.storage_path');
        $this->assertNotEmpty($storagePath);
        $this->assertStringStartsWith("patient_files/{$patient->id}/", $storagePath);

        Storage::disk('local')->assertExists($storagePath);

        $this->assertDatabaseHas('patient_files', [
            'patient_id' => $patient->id,
            'file_name' => 'Ket Qua Xet Nghiem Mau.pdf',
            'mime_type' => 'application/pdf',
            'uploaded_by' => $doctor->id,
        ]);
    }

    public function test_doctor_can_upload_clinical_file_for_visit(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000102',
            'full_name' => 'Le Van Tam',
            'gender' => 'MALE',
            'phone' => '0988112233',
            'status' => 'ACTIVE',
        ]);

        $doctorEmployee = Employee::create([
            'employee_code' => 'NV-XRAY-01',
            'full_name' => 'BS Chuan Doan Hinh Anh',
            'phone' => '0933445566',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-XRAY-01',
            'name' => 'Chup X-quang Tim Phoi',
            'price' => 150000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB-20261028-0050',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'status' => Visit::STATUS_IN_PROGRESS,
        ]);

        $file = UploadedFile::fake()->image('xray_chest.png', 800, 600);

        $response = $this->authenticate($doctor)
            ->postJson("/api/v1/visits/{$visit->id}/files", [
                'file' => $file,
                'file_name' => 'Phim X-quang Nguc Thang.png',
            ])
            ->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tải lên tài liệu y tế thành công.',
                'data' => [
                    'patient_id' => $patient->id,
                    'visit_id' => $visit->id,
                    'file_name' => 'Phim X-quang Nguc Thang.png',
                    'mime_type' => 'image/png',
                ],
            ]);

        $storagePath = $response->json('data.storage_path');
        Storage::disk('local')->assertExists($storagePath);

        $this->assertDatabaseHas('patient_files', [
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'file_name' => 'Phim X-quang Nguc Thang.png',
            'mime_type' => 'image/png',
        ]);
    }

    public function test_upload_file_exceeding_10mb_fails_validation(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000103',
            'full_name' => 'Ngo Van Lon',
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);

        // 11 MB = 11 * 1024 KB = 11264 KB
        $largeFile = UploadedFile::fake()->create('heavy_scan.pdf', 11264, 'application/pdf');

        $this->authenticate($doctor)
            ->postJson("/api/v1/patients/{$patient->id}/files", [
                'file' => $largeFile,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        $this->assertDatabaseCount('patient_files', 0);
    }

    public function test_upload_invalid_mime_type_fails_validation(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000104',
            'full_name' => 'Doan Van Binh',
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);

        $scriptFile = UploadedFile::fake()->create('exploit.sh', 10, 'application/x-sh');

        $this->authenticate($doctor)
            ->postJson("/api/v1/patients/{$patient->id}/files", [
                'file' => $scriptFile,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        $this->assertDatabaseCount('patient_files', 0);
    }

    public function test_cannot_upload_file_to_cancelled_visit(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $service = $this->createService();

        $patient = Patient::create([
            'patient_code' => 'BN000105',
            'full_name' => 'Hoang Thi Huong',
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB-20261028-0051',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->employee_id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'status' => Visit::STATUS_CANCELLED,
        ]);

        $file = UploadedFile::fake()->create('report.pdf', 200, 'application/pdf');

        $this->authenticate($doctor)
            ->postJson("/api/v1/visits/{$visit->id}/files", [
                'file' => $file,
            ])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Không thể tải lên tệp đính kèm cho lượt khám đã hủy.',
            ]);

        $this->assertDatabaseCount('patient_files', 0);
    }

    public function test_upload_patient_file_with_mismatched_visit_id_fails(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $service = $this->createService();

        $patientA = Patient::create([
            'patient_code' => 'BN000106',
            'full_name' => 'Benh Nhan A',
            'status' => 'ACTIVE',
        ]);

        $patientB = Patient::create([
            'patient_code' => 'BN000107',
            'full_name' => 'Benh Nhan B',
            'status' => 'ACTIVE',
        ]);

        $visitB = Visit::create([
            'visit_code' => 'KB-20261028-0052',
            'patient_id' => $patientB->id,
            'employee_id' => $doctor->employee_id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'status' => Visit::STATUS_IN_PROGRESS,
        ]);

        $file = UploadedFile::fake()->create('report.pdf', 200, 'application/pdf');

        $this->authenticate($doctor)
            ->postJson("/api/v1/patients/{$patientA->id}/files", [
                'file' => $file,
                'visit_id' => $visitB->id,
            ])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Lượt khám không thuộc về bệnh nhân này.',
            ]);
    }

    public function test_can_list_files_for_patient(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000108',
            'full_name' => 'Vu Thi Tuyet',
            'status' => 'ACTIVE',
        ]);

        PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Don_thuoc_1.pdf',
            'storage_path' => "patient_files/{$patient->id}/file1.pdf",
            'mime_type' => 'application/pdf',
            'file_size' => 102400,
            'uploaded_by' => $doctor->id,
            'created_at' => now()->subDay(),
        ]);

        PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Ket_qua_MRI.pdf',
            'storage_path' => "patient_files/{$patient->id}/file2.pdf",
            'mime_type' => 'application/pdf',
            'file_size' => 204800,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($doctor)
            ->getJson("/api/v1/patients/{$patient->id}/files")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh sách tệp đính kèm thành công.',
            ]);

        $data = $response->json('data');
        $this->assertCount(2, $data);
    }

    public function test_can_list_files_for_visit(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $service = $this->createService();

        $patient = Patient::create([
            'patient_code' => 'BN000109',
            'full_name' => 'Phan Van Phuc',
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'KB-20261028-0053',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->employee_id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'status' => Visit::STATUS_COMPLETED,
        ]);

        PatientFile::create([
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'file_name' => 'Sieu_am_tim.png',
            'storage_path' => "patient_files/{$patient->id}/sieu_am.png",
            'mime_type' => 'image/png',
            'file_size' => 300000,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($doctor)
            ->getJson("/api/v1/visits/{$visit->id}/files")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Sieu_am_tim.png', $response->json('data.0.file_name'));
    }

    public function test_can_get_single_patient_file_details(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000110',
            'full_name' => 'Dang Thi Nga',
            'status' => 'ACTIVE',
        ]);

        $fileRecord = PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Dien_tam_do.pdf',
            'storage_path' => "patient_files/{$patient->id}/ecg.pdf",
            'mime_type' => 'application/pdf',
            'file_size' => 50000,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        $this->authenticate($doctor)
            ->getJson("/api/v1/patient-files/{$fileRecord->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $fileRecord->id,
                    'file_name' => 'Dien_tam_do.pdf',
                    'patient_id' => $patient->id,
                ],
            ]);
    }

    public function test_returns_404_when_patient_not_found(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $file = UploadedFile::fake()->create('report.pdf', 100, 'application/pdf');

        $this->authenticate($doctor)
            ->postJson('/api/v1/patients/999999/files', [
                'file' => $file,
            ])
            ->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin bệnh nhân.',
            ]);
    }

    public function test_unauthenticated_user_cannot_upload_patient_files(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN000111',
            'full_name' => 'No Auth Patient',
            'status' => 'ACTIVE',
        ]);

        $file = UploadedFile::fake()->create('file.pdf', 100, 'application/pdf');

        $this->postJson("/api/v1/patients/{$patient->id}/files", [
            'file' => $file,
        ])->assertStatus(401);
    }

    public function test_doctor_can_preview_clinical_file_inline(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000112',
            'full_name' => 'Tran Thi Preview',
            'status' => 'ACTIVE',
        ]);

        $path = "patient_files/{$patient->id}/preview_test.pdf";
        Storage::disk('local')->put($path, 'sample-pdf-content');

        $fileRecord = PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Preview_Test.pdf',
            'storage_path' => $path,
            'mime_type' => 'application/pdf',
            'file_size' => 18,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($doctor)
            ->get("/api/v1/patient-files/{$fileRecord->id}/preview")
            ->assertStatus(200);

        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringContainsString('inline', (string) $response->headers->get('content-disposition'));
    }

    public function test_doctor_can_download_clinical_file_attachment(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000113',
            'full_name' => 'Le Van Download',
            'status' => 'ACTIVE',
        ]);

        $path = "patient_files/{$patient->id}/download_test.pdf";
        Storage::disk('local')->put($path, 'sample-download-content');

        $fileRecord = PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Download_Test.pdf',
            'storage_path' => $path,
            'mime_type' => 'application/pdf',
            'file_size' => 23,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($doctor)
            ->get("/api/v1/patient-files/{$fileRecord->id}/download")
            ->assertStatus(200);

        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
    }

    public function test_doctor_can_delete_patient_file_with_audit_log(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000114',
            'full_name' => 'Pham Van Delete',
            'status' => 'ACTIVE',
        ]);

        $path = "patient_files/{$patient->id}/to_be_deleted.pdf";
        Storage::disk('local')->put($path, 'content-to-delete');

        $fileRecord = PatientFile::create([
            'patient_id' => $patient->id,
            'file_name' => 'Delete_Me.pdf',
            'storage_path' => $path,
            'mime_type' => 'application/pdf',
            'file_size' => 17,
            'uploaded_by' => $doctor->id,
            'created_at' => now(),
        ]);

        Storage::disk('local')->assertExists($path);

        $this->authenticate($doctor)
            ->deleteJson("/api/v1/patient-files/{$fileRecord->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa tệp đính kèm y tế thành công.',
            ]);

        $this->assertDatabaseMissing('patient_files', [
            'id' => $fileRecord->id,
        ]);

        Storage::disk('local')->assertMissing($path);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'patient_files',
            'action' => 'delete',
            'table_name' => 'patient_files',
            'record_id' => (string) $fileRecord->id,
            'user_id' => $doctor->id,
        ]);
    }
}
