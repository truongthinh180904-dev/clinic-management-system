<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\DataMaskingService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataMaskingTest extends TestCase
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
            'username' => 'mask_user_'.fake()->unique()->lexify('??????'),
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

    public function test_mask_phone_formats(): void
    {
        // 10 digits
        $this->assertSame('0912***456', DataMaskingService::maskPhone('0912345456'));
        $this->assertSame('0909***999', DataMaskingService::maskPhone('0909111999'));

        // Short phone
        $this->assertSame('****', DataMaskingService::maskPhone('1234'));

        // Null and empty
        $this->assertNull(DataMaskingService::maskPhone(null));
        $this->assertSame('', DataMaskingService::maskPhone(''));
    }

    public function test_mask_identity_formats(): void
    {
        // 12-digit CCCD
        $this->assertSame('0012*****456', DataMaskingService::maskIdentity('001200123456'));

        // 9-digit CMND
        $this->assertSame('025***123', DataMaskingService::maskIdentity('025456123'));

        // Null and empty
        $this->assertNull(DataMaskingService::maskIdentity(null));
        $this->assertSame('', DataMaskingService::maskIdentity(''));
    }

    public function test_receptionist_with_update_permission_bypasses_masking(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $patient = Patient::create([
            'patient_code' => 'BN000010',
            'full_name' => 'Tran Thi Receptionist View',
            'phone' => '0912345456',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($receptionist)
            ->getJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200);

        // Receptionist has patients.update -> can view full phone to assist patient at counter
        $this->assertSame('0912345456', $response->json('data.phone'));
    }

    public function test_cashier_receives_masked_phone(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');

        $patient = Patient::create([
            'patient_code' => 'BN000011',
            'full_name' => 'Nguyen Van Cashier View',
            'phone' => '0912345456',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($cashier)
            ->getJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200);

        // Cashier only has patients.view -> phone is masked
        $this->assertSame('0912***456', $response->json('data.phone'));
    }

    public function test_user_with_explicit_mask_bypass_permission_sees_unmasked(): void
    {
        $employee = Employee::create([
            'employee_code' => 'NV-CUSTOM-01',
            'full_name' => 'Custom Auditor',
            'phone' => '0911223344',
            'email' => 'auditor@example.com',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'auditor_user',
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'AUDITOR_ROLE',
            'description' => 'Auditor role',
        ]);

        $permView = Permission::where('permission_key', 'patients.view')->firstOrFail();
        $permBypass = Permission::where('permission_key', 'patients.mask_bypass')->firstOrFail();

        $role->permissions()->attach([$permView->id, $permBypass->id], ['created_at' => now()]);
        $user->roles()->attach($role->id, ['created_at' => now()]);

        $patient = Patient::create([
            'patient_code' => 'BN000012',
            'full_name' => 'Bypass Test Patient',
            'phone' => '0912345456',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($user)
            ->getJson("/api/v1/patients/{$patient->id}")
            ->assertStatus(200);

        $this->assertSame('0912345456', $response->json('data.phone'));
    }
}
