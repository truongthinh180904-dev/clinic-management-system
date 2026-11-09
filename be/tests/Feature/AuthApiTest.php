<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('bs_hung|127.0.0.1');
        RateLimiter::clear('hung.tran@clinic.local|127.0.0.1');
    }

    /**
     * Helper to create standard doctor user with role, permissions, and employee record.
     */
    protected function createDoctorUser(string $status = 'ACTIVE'): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV20260001',
            'full_name' => 'BS. Trần Văn Hùng',
            'phone' => '0912345678',
            'email' => 'hung.tran@clinic.local',
            'date_of_birth' => '1985-06-15',
            'gender' => 'MALE',
            'position' => 'Bác sĩ trưởng khoa',
            'department' => 'Khoa Nội',
            'hire_date' => '2020-01-01',
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'DOCTOR',
            'description' => 'Bác sĩ điều trị',
        ]);

        $permission = Permission::create([
            'module' => 'medical_records',
            'action' => 'view',
            'permission_key' => 'medical_records.view',
            'description' => 'Xem bệnh án',
        ]);

        $role->permissions()->attach($permission->id, ['created_at' => now()]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'bs_hung',
            'email' => 'hung.tran@clinic.local',
            'password_hash' => Hash::make('Doctor@123456'),
            'status' => $status,
        ]);

        $user->roles()->attach($role->id, ['created_at' => now()]);

        return $user;
    }

    public function test_login_successful_with_active_user(): void
    {
        $user = $this->createDoctorUser('ACTIVE');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'Doctor@123456',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Đăng nhập thành công.',
                'data' => [
                    'token_type' => 'Bearer',
                    'user' => [
                        'username' => 'bs_hung',
                        'email' => 'hung.tran@clinic.local',
                        'status' => 'ACTIVE',
                        'employee' => [
                            'employee_code' => 'NV20260001',
                            'full_name' => 'BS. Trần Văn Hùng',
                        ],
                    ],
                ],
            ]);

        $token = $response->json('data.token');
        $this->assertNotEmpty($token);

        $userData = $response->json('data.user');
        $this->assertArrayNotHasKey('password_hash', $userData);
        $this->assertStringNotContainsString('password_hash', (string) $response->getContent());

        $this->assertSame('DOCTOR', $response->json('data.user.roles.0.name'));
        $this->assertContains('medical_records.view', $response->json('data.user.permissions'));

        $this->assertNotNull($user->fresh()->last_login_at);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'module' => 'auth',
            'action' => 'login',
            'table_name' => 'users',
            'record_id' => $user->id,
        ]);
    }

    public function test_login_successful_using_email(): void
    {
        $this->createDoctorUser('ACTIVE');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'hung.tran@clinic.local',
            'password' => 'Doctor@123456',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Đăng nhập thành công.',
            ]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $this->createDoctorUser('ACTIVE');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'WrongPassword',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Tên đăng nhập hoặc mật khẩu không chính xác.',
                'errors' => null,
            ]);
    }

    public function test_login_fails_with_non_existent_username(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'nonexistent_user',
            'password' => 'SomePassword@123',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Tên đăng nhập hoặc mật khẩu không chính xác.',
                'errors' => null,
            ]);
    }

    public function test_login_fails_validation_when_fields_are_missing(): void
    {
        $response = $this->postJson('/api/v1/auth/login', []);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.',
            ])
            ->assertJsonValidationErrors(['username', 'password']);
    }

    public function test_login_rejected_for_inactive_user(): void
    {
        $this->createDoctorUser('INACTIVE');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'Doctor@123456',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
                'errors' => null,
            ]);
    }

    public function test_login_rejected_for_locked_user(): void
    {
        $this->createDoctorUser('LOCKED');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'Doctor@123456',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
                'errors' => null,
            ]);
    }

    public function test_login_rate_limiting_triggers_after_repeated_failures(): void
    {
        $this->createDoctorUser('ACTIVE');

        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/auth/login', [
                'username' => 'bs_hung',
                'password' => 'WrongPassword',
            ]);
            $response->assertStatus(401);
        }

        $rateLimitedResponse = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'WrongPassword',
        ]);

        $rateLimitedResponse->assertStatus(429)
            ->assertJson([
                'success' => false,
                'errors' => null,
            ]);

        $this->assertStringContainsString('quá nhiều yêu cầu đăng nhập', (string) $rateLimitedResponse->json('message'));
    }

    public function test_me_endpoint_returns_profile_when_authenticated(): void
    {
        $user = $this->createDoctorUser('ACTIVE');

        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'Doctor@123456',
        ]);
        $token = $loginResponse->json('data.token');

        $meResponse = $this->withToken($token)->getJson('/api/v1/auth/me');

        $meResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy thông tin người dùng thành công.',
                'data' => [
                    'id' => $user->id,
                    'username' => 'bs_hung',
                    'email' => 'hung.tran@clinic.local',
                    'status' => 'ACTIVE',
                    'employee' => [
                        'employee_code' => 'NV20260001',
                        'full_name' => 'BS. Trần Văn Hùng',
                        'position' => 'Bác sĩ trưởng khoa',
                        'department' => 'Khoa Nội',
                    ],
                ],
            ]);

        $this->assertSame('DOCTOR', $meResponse->json('data.roles.0.name'));
        $this->assertContains('medical_records.view', $meResponse->json('data.permissions'));
        $this->assertArrayNotHasKey('password_hash', $meResponse->json('data'));
        $this->assertStringNotContainsString('password_hash', (string) $meResponse->getContent());
    }

    public function test_me_endpoint_unauthorized_without_token(): void
    {
        $response = $this->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
                'errors' => null,
            ]);
    }

    public function test_me_endpoint_unauthorized_with_invalid_token(): void
    {
        $response = $this->withToken('invalid_token_xyz')->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
                'errors' => null,
            ]);
    }

    public function test_me_endpoint_forbidden_when_user_becomes_inactive(): void
    {
        $user = $this->createDoctorUser('ACTIVE');

        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'Doctor@123456',
        ]);
        $token = $loginResponse->json('data.token');

        $user->update(['status' => 'INACTIVE']);

        $response = $this->withToken($token)->getJson('/api/v1/auth/me');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
                'errors' => null,
            ]);
    }

    public function test_logout_revokes_token_and_writes_audit_log(): void
    {
        $user = $this->createDoctorUser('ACTIVE');

        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'username' => 'bs_hung',
            'password' => 'Doctor@123456',
        ]);
        $token = $loginResponse->json('data.token');

        $logoutResponse = $this->withToken($token)->postJson('/api/v1/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Đăng xuất thành công.',
                'data' => null,
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'module' => 'auth',
            'action' => 'logout',
            'table_name' => 'users',
            'record_id' => $user->id,
        ]);

        $meAfterLogout = $this->withToken($token)->getJson('/api/v1/auth/me');

        $meAfterLogout->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
            ]);
    }

    public function test_logout_unauthorized_without_token(): void
    {
        $response = $this->postJson('/api/v1/auth/logout');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
                'errors' => null,
            ]);
    }
}
