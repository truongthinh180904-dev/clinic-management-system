<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\Role;
use App\Models\User;
use App\Services\DataMaskingService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
        RateLimiter::clear('ratelimit_user|127.0.0.1');
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
            'username' => 'rl_user_'.fake()->unique()->lexify('??????'),
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
     * Test rate limiting on Auth Login endpoint (maximum 5 requests per minute).
     */
    public function test_login_rate_limiting_enforces_max_5_requests_per_minute(): void
    {
        $user = $this->createUserWithRole('DOCTOR');
        $username = $user->username;

        // First 5 attempts (invalid password) -> 401 Unauthorized
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/auth/login', [
                'username' => $username,
                'password' => 'WrongPassword@123',
            ]);
            $response->assertStatus(401);
        }

        // 6th attempt -> 429 Too Many Requests
        $rateLimitedResponse = $this->postJson('/api/v1/auth/login', [
            'username' => $username,
            'password' => 'Secret@123',
        ]);

        $rateLimitedResponse->assertStatus(429)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('quá nhiều yêu cầu đăng nhập', (string) $rateLimitedResponse->json('message'));
    }

    /**
     * Test rate limiting on Data Export endpoints (maximum 10 requests per minute).
     */
    public function test_export_rate_limiting_enforces_max_10_requests_per_minute(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Create sample data to export
        Patient::create([
            'patient_code' => 'BN000001',
            'full_name' => 'Nguyen Van Export',
            'phone' => '0912345456',
            'status' => 'ACTIVE',
        ]);

        // First 10 requests -> 200 OK
        for ($i = 0; $i < 10; $i++) {
            $response = $this->authenticate($admin)->getJson('/api/v1/exports/patients');
            $response->assertStatus(200);
        }

        // 11th request -> 429 Too Many Requests
        $limitedResponse = $this->authenticate($admin)->getJson('/api/v1/exports/patients');
        $limitedResponse->assertStatus(429)
            ->assertJson([
                'success' => false,
            ]);

        $message = (string) $limitedResponse->json('message');
        $this->assertTrue(
            str_contains($message, 'quá giới hạn tải xuất dữ liệu') || str_contains($message, 'quá nhiều yêu cầu')
        );
    }

    /**
     * Test rate limiting on File Upload endpoints (maximum 20 requests per minute).
     */
    public function test_upload_rate_limiting_enforces_max_20_requests_per_minute(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000002',
            'full_name' => 'Tran Thi Upload',
            'phone' => '0987654321',
            'status' => 'ACTIVE',
        ]);

        // First 20 upload requests -> 201 Created
        for ($i = 1; $i <= 20; $i++) {
            $file = UploadedFile::fake()->create("report_{$i}.pdf", 50, 'application/pdf');
            $response = $this->authenticate($doctor)
                ->postJson("/api/v1/patients/{$patient->id}/files", [
                    'file' => $file,
                    'file_name' => "Report {$i}.pdf",
                ]);
            $response->assertStatus(201);
        }

        // 21st upload request -> 429 Too Many Requests
        $overflowFile = UploadedFile::fake()->create('report_21.pdf', 50, 'application/pdf');
        $limitedResponse = $this->authenticate($doctor)
            ->postJson("/api/v1/patients/{$patient->id}/files", [
                'file' => $overflowFile,
                'file_name' => 'Report 21.pdf',
            ]);

        $limitedResponse->assertStatus(429)
            ->assertJson([
                'success' => false,
            ]);

        $message = (string) $limitedResponse->json('message');
        $this->assertTrue(
            str_contains($message, 'quá giới hạn tải lên') || str_contains($message, 'quá nhiều yêu cầu')
        );
    }

    /**
     * Test Data Masking helper methods directly.
     */
    public function test_data_masking_service_formatting(): void
    {
        // Phone masking
        $this->assertSame('0912***456', DataMaskingService::maskPhone('0912345456'));
        $this->assertSame('0901***567', DataMaskingService::maskPhone('0901234567'));
        $this->assertNull(DataMaskingService::maskPhone(null));
        $this->assertSame('', DataMaskingService::maskPhone(''));

        // Identity / CCCD masking
        $maskedCccd = DataMaskingService::maskIdentity('001200123456');
        $this->assertSame('0012*****456', $maskedCccd);
        $this->assertNull(DataMaskingService::maskIdentity(null));
    }

    /**
     * Test that non-admin roles (e.g. DOCTOR, NURSE, CASHIER) receive masked phone numbers.
     */
    public function test_data_masking_masks_phone_for_non_admin_roles(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        $patient = Patient::create([
            'patient_code' => 'BN000003',
            'full_name' => 'Le Van Masked',
            'phone' => '0912345456',
            'emergency_contact_phone' => '0987654321',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($doctor)
            ->getJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $patient->id,
                    'patient_code' => 'BN000003',
                    'phone' => '0912***456',
                    'emergency_contact_phone' => '0987***321',
                ],
            ]);

        $this->assertSame('0912***456', $response->json('data.phone'));
    }

    /**
     * Test that administrative roles (ADMIN, MANAGER) receive unmasked raw phone numbers.
     */
    public function test_data_masking_allows_unmasked_phone_for_admin_role(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $patient = Patient::create([
            'patient_code' => 'BN000004',
            'full_name' => 'Vo Van Admin',
            'phone' => '0912345456',
            'emergency_contact_phone' => '0987654321',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $patient->id,
                    'patient_code' => 'BN000004',
                    'phone' => '0912345456',
                    'emergency_contact_phone' => '0987654321',
                ],
            ]);

        $this->assertSame('0912345456', $response->json('data.phone'));
    }

    /**
     * Test that patient list endpoint masks phone numbers for non-admin viewers.
     */
    public function test_patient_list_endpoint_applies_masking_for_doctor(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');

        Patient::create([
            'patient_code' => 'BN000005',
            'full_name' => 'Bui Thi List',
            'phone' => '0912345456',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($doctor)
            ->getJson('/api/v1/patients')
            ->assertStatus(200);

        $patientData = collect($response->json('data'))->firstWhere('patient_code', 'BN000005');
        $this->assertNotNull($patientData);
        $this->assertSame('0912***456', $patientData['phone']);
    }
}
