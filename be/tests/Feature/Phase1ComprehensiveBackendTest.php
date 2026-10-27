<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\PackageService;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use App\Models\Visit;
use App\Services\VisitService;
use Database\Seeders\RolePermissionSeeder;
use Exception;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Phase1ComprehensiveBackendTest extends TestCase
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
            'password_hash' => Hash::make('Secret@123'),
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
            'username' => 'test_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => Hash::make('Secret@123'),
            'status' => $status,
        ]);

        $role = Role::create([
            'name' => 'ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Custom role',
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
     * Helper to authenticate user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    // =========================================================================
    // SCENARIO 01: Auth - Login Successful With Valid Credentials
    // =========================================================================
    public function test_scenario_01_auth_login_successful_with_valid_credentials(): void
    {
        $employee = Employee::create([
            'employee_code' => 'NV100001',
            'full_name' => 'Nguyen Van Bac Si',
            'phone' => '0911000001',
            'email' => 'bacsi1@clinic.local',
            'status' => 'ACTIVE',
        ]);

        User::create([
            'employee_id' => $employee->id,
            'username' => 'doctor_login',
            'email' => 'bacsi1@clinic.local',
            'password_hash' => Hash::make('StrongPass@123'),
            'status' => 'ACTIVE',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'doctor_login',
            'password' => 'StrongPass@123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'token',
                    'token_type',
                    'user' => [
                        'id',
                        'username',
                        'email',
                        'status',
                    ],
                ],
            ]);
    }

    // =========================================================================
    // SCENARIO 02: Auth - Login Fails With Invalid Password
    // =========================================================================
    public function test_scenario_02_auth_login_fails_with_invalid_credentials(): void
    {
        $employee = Employee::create([
            'employee_code' => 'NV100002',
            'full_name' => 'Tran Van Test',
            'phone' => '0911000002',
            'email' => 'invalid_cred@clinic.local',
            'status' => 'ACTIVE',
        ]);

        User::create([
            'employee_id' => $employee->id,
            'username' => 'user_invalid_pass',
            'email' => 'invalid_cred@clinic.local',
            'password_hash' => Hash::make('CorrectPassword@123'),
            'status' => 'ACTIVE',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'user_invalid_pass',
            'password' => 'WrongPassword@999',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('success', false);
    }

    // =========================================================================
    // SCENARIO 03: Auth - Login Blocked For Inactive Account
    // =========================================================================
    public function test_scenario_03_auth_login_blocked_for_inactive_user(): void
    {
        $employee = Employee::create([
            'employee_code' => 'NV100003',
            'full_name' => 'Inactive User Test',
            'phone' => '0911000003',
            'email' => 'inactive@clinic.local',
            'status' => 'INACTIVE',
        ]);

        User::create([
            'employee_id' => $employee->id,
            'username' => 'inactive_user_acc',
            'email' => 'inactive@clinic.local',
            'password_hash' => Hash::make('Secret@123'),
            'status' => 'INACTIVE',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'inactive_user_acc',
            'password' => 'Secret@123',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    // =========================================================================
    // SCENARIO 04: Auth - Current User Profile & Token Revocation on Logout
    // =========================================================================
    public function test_scenario_04_auth_me_and_logout_revokes_token(): void
    {
        $user = $this->createUserWithRole('DOCTOR');
        $token = $user->createToken('session-token')->plainTextToken;

        // Fetch /me
        $meResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me');

        $meResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.username', $user->username);

        // Perform logout
        $logoutResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        // Subsequent /me request with same token must be rejected
        $postLogoutResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me');

        $postLogoutResponse->assertStatus(401);
    }

    // =========================================================================
    // SCENARIO 05: RBAC - User Without Permission Receives 403 Forbidden
    // =========================================================================
    public function test_scenario_05_rbac_user_without_permission_receives_403_forbidden(): void
    {
        $viewer = $this->createUserWithRole('VIEWER');

        $response = $this->authenticate($viewer)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'NV999999',
                'full_name' => 'Test Unauthorized',
                'phone' => '0999999999',
                'email' => 'unauth@clinic.local',
                'status' => 'ACTIVE',
            ]);

        $response->assertStatus(403);
    }

    // =========================================================================
    // SCENARIO 06: RBAC - User With Permission Can Access Protected Endpoint
    // =========================================================================
    public function test_scenario_06_rbac_user_with_permission_can_access_protected_endpoint(): void
    {
        $user = $this->createUserWithPermissions(['employees.view']);

        $response = $this->authenticate($user)
            ->getJson('/api/v1/employees');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    // =========================================================================
    // SCENARIO 07: Employees - CRUD & Uniqueness Validation
    // =========================================================================
    public function test_scenario_07_employees_crud_and_uniqueness_validation(): void
    {
        $admin = $this->createUserWithPermissions(['employees.view', 'employees.create']);

        // First employee
        $createResponse = $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'NV700001',
                'full_name' => 'Nhan Vien Mau',
                'phone' => '0977000001',
                'email' => 'nv.mau@clinic.local',
                'status' => 'ACTIVE',
            ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.employee_code', 'NV700001');

        // Duplicate employee_code rejected
        $dupResponse = $this->authenticate($admin)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'NV700001',
                'full_name' => 'Nhan Vien Trung Ma',
                'phone' => '0977000002',
                'email' => 'nv.trung@clinic.local',
                'status' => 'ACTIVE',
            ]);

        $dupResponse->assertStatus(422)
            ->assertJsonValidationErrors(['employee_code']);
    }

    // =========================================================================
    // SCENARIO 08: Users - CRUD, Relation to Employee & Password Hashing
    // =========================================================================
    public function test_scenario_08_users_crud_and_status_enforcement(): void
    {
        $admin = $this->createUserWithPermissions(['users.view', 'users.create', 'users.update']);

        $employee = Employee::create([
            'employee_code' => 'NV800001',
            'full_name' => 'Nhan Vien Co Tai Khoan',
            'phone' => '0988000001',
            'email' => 'acc.nv@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/users', [
                'employee_id' => $employee->id,
                'username' => 'nv_acc_test',
                'email' => 'acc.nv@clinic.local',
                'password' => 'SecurePass@123',
                'password_confirmation' => 'SecurePass@123',
                'status' => 'ACTIVE',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.username', 'nv_acc_test');

        $user = User::where('username', 'nv_acc_test')->first();
        $this->assertNotNull($user);
        $this->assertTrue(Hash::check('SecurePass@123', $user->password_hash));
    }

    // =========================================================================
    // SCENARIO 09: Patients - CRUD & Auto-Generated Patient Code
    // =========================================================================
    public function test_scenario_09_patients_crud_and_patient_code_generation(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/patients', [
                'full_name' => 'Vo Van Benh Nhan',
                'phone' => '0912999888',
                'gender' => 'MALE',
                'date_of_birth' => '1992-05-10',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $patientCode = $response->json('data.patient_code');
        $this->assertNotEmpty($patientCode);
        $this->assertStringStartsWith('BN', $patientCode);
        $this->assertDatabaseHas('patients', [
            'patient_code' => $patientCode,
            'full_name' => 'Vo Van Benh Nhan',
        ]);
    }

    // =========================================================================
    // SCENARIO 10: Services - CRUD & Price Validation
    // =========================================================================
    public function test_scenario_10_services_crud_and_positive_price_validation(): void
    {
        $admin = $this->createUserWithPermissions(['services.view', 'services.create']);

        // Valid service creation
        $validResponse = $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'service_code' => 'DV-TEST-01',
                'name' => 'Sieu Am Bung',
                'price' => 350000.00,
                'duration_minutes' => 20,
                'status' => 'ACTIVE',
            ]);

        $validResponse->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.service_code', 'DV-TEST-01');

        // Negative price rejected
        $negativeResponse = $this->authenticate($admin)
            ->postJson('/api/v1/services', [
                'service_code' => 'DV-TEST-02',
                'name' => 'Sieu Am Gia Am',
                'price' => -50000.00,
                'duration_minutes' => 20,
                'status' => 'ACTIVE',
            ]);

        $negativeResponse->assertStatus(422)
            ->assertJsonValidationErrors(['price']);
    }

    // =========================================================================
    // SCENARIO 11: Service Packages - CRUD With Package Services Pivot
    // =========================================================================
    public function test_scenario_11_packages_crud_with_package_services_pivot(): void
    {
        $admin = $this->createUserWithPermissions([
            'service_packages.view',
            'service_packages.create',
            'service_packages.update',
        ]);

        $service1 = Service::create([
            'service_code' => 'DV-PK-1',
            'name' => 'X-Quang Nguc',
            'price' => 150000.00,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        $packageResponse = $this->authenticate($admin)
            ->postJson('/api/v1/service-packages', [
                'package_code' => 'GOI-TEST-01',
                'name' => 'Goi Kham Tim Mach',
                'price' => 1200000.00,
                'total_sessions' => 4,
                'validity_days' => 90,
                'status' => 'ACTIVE',
            ]);

        $packageResponse->assertStatus(201);
        $packageId = $packageResponse->json('data.id');

        // Attach service to package via composition endpoint
        $attachResponse = $this->authenticate($admin)
            ->postJson("/api/v1/service-packages/{$packageId}/services", [
                'service_id' => $service1->id,
                'quantity' => 4,
            ]);

        $attachResponse->assertStatus(201);
        $this->assertDatabaseHas('package_services', [
            'package_id' => $packageId,
            'service_id' => $service1->id,
            'quantity' => 4,
        ]);
    }

    // =========================================================================
    // SCENARIO 12: Patient Packages - Assignment & Initialization Invariants
    // =========================================================================
    public function test_scenario_12_patient_packages_assignment_and_initialization(): void
    {
        $admin = $this->createUserWithPermissions([
            'patient_packages.view',
            'patient_packages.assign',
            'patients.update',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN120001',
            'full_name' => 'Nguyen Package Test',
            'phone' => '0912120001',
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI-12001',
            'name' => 'Goi 10 Buoi Cham Soc',
            'price' => 2000000.00,
            'total_sessions' => 10,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->postJson("/api/v1/patients/{$patient->id}/packages", [
                'package_id' => $package->id,
                'purchase_date' => now()->toDateString(),
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_sessions', 10)
            ->assertJsonPath('data.used_sessions', 0)
            ->assertJsonPath('data.remaining_sessions', 10)
            ->assertJsonPath('data.status', 'ACTIVE');
    }

    // =========================================================================
    // SCENARIO 13: Appointments - Overlap Prevention For Doctor
    // =========================================================================
    public function test_scenario_13_appointments_overlap_prevention_for_doctor(): void
    {
        $admin = $this->createUserWithPermissions(['appointments.view', 'appointments.create']);

        $patient1 = Patient::create([
            'patient_code' => 'BN130001',
            'full_name' => 'Benh Nhan 13 A',
            'phone' => '0913000001',
            'status' => 'ACTIVE',
        ]);

        $patient2 = Patient::create([
            'patient_code' => 'BN130002',
            'full_name' => 'Benh Nhan 13 B',
            'phone' => '0913000002',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS130001',
            'full_name' => 'Bac Si Overlap Test',
            'phone' => '0913999999',
            'email' => 'doctor13@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-13001',
            'name' => 'Kham Overlap',
            'price' => 100000.00,
            'duration_minutes' => 60,
            'status' => 'ACTIVE',
        ]);

        // Appointment 1: 09:00 - 10:00 on 2026-11-20
        $firstResponse = $this->authenticate($admin)
            ->postJson('/api/v1/appointments', [
                'patient_id' => $patient1->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'appointment_date' => '2026-11-20',
                'start_time' => '09:00',
                'end_time' => '10:00',
                'status' => 'CONFIRMED',
            ]);

        $firstResponse->assertStatus(201);

        // Appointment 2: Overlapping 09:30 - 10:30 with same doctor on same date
        $overlapResponse = $this->authenticate($admin)
            ->postJson('/api/v1/appointments', [
                'patient_id' => $patient2->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'appointment_date' => '2026-11-20',
                'start_time' => '09:30',
                'end_time' => '10:30',
                'status' => 'PENDING',
            ]);

        $this->assertTrue(in_array($overlapResponse->status(), [409, 422], true));
        $overlapResponse->assertJsonPath('success', false);
    }

    // =========================================================================
    // SCENARIO 14: Appointments - Lifecycle Status Transitions
    // =========================================================================
    public function test_scenario_14_appointments_lifecycle_status_transitions(): void
    {
        $admin = $this->createUserWithPermissions([
            'appointments.view',
            'appointments.create',
            'appointments.update',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN140001',
            'full_name' => 'BN Lifecycle',
            'phone' => '0914000001',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS140001',
            'full_name' => 'BS Lifecycle',
            'phone' => '0914000002',
            'email' => 'doc14@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-14001',
            'name' => 'Kham Lifecycle',
            'price' => 100000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $apt = Appointment::create([
            'appointment_code' => 'APT140001',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-22',
            'start_time' => '14:00:00',
            'end_time' => '14:30:00',
            'status' => 'PENDING',
        ]);

        // Transition: PENDING -> CONFIRMED
        $res1 = $this->authenticate($admin)
            ->patchJson("/api/v1/appointments/{$apt->id}/status", [
                'status' => 'CONFIRMED',
            ]);
        $res1->assertStatus(200)->assertJsonPath('data.status', 'CONFIRMED');

        // Transition: CONFIRMED -> COMPLETED
        $res2 = $this->authenticate($admin)
            ->patchJson("/api/v1/appointments/{$apt->id}/status", [
                'status' => 'COMPLETED',
            ]);
        $res2->assertStatus(200)->assertJsonPath('data.status', 'COMPLETED');

        // Verification in database
        $this->assertDatabaseHas('appointments', [
            'id' => $apt->id,
            'status' => 'COMPLETED',
        ]);
    }

    // =========================================================================
    // SCENARIO 15: Visits - Pricing Calculation Formula
    // =========================================================================
    public function test_scenario_15_visits_pricing_calculation_formula(): void
    {
        $user = $this->createUserWithPermissions(['visits.view', 'visits.create']);

        $patient = Patient::create([
            'patient_code' => 'BN150001',
            'full_name' => 'BN Formula Test',
            'phone' => '0915000001',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS150001',
            'full_name' => 'BS Formula Test',
            'phone' => '0915000002',
            'email' => 'doc15@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-15001',
            'name' => 'Dich Vu Tinh Tien',
            'price' => 150000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        // quantity = 3, unit_price = 150000 => subtotal = 450000, discount = 50000 => total = 400000
        $response = $this->authenticate($user)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => '2026-11-25 09:00:00',
                'quantity' => 3,
                'unit_price' => 150000.00,
                'discount_amount' => 50000.00,
                'status' => 'SCHEDULED',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quantity', 3)
            ->assertJsonPath('data.unit_price', 150000)
            ->assertJsonPath('data.discount_amount', 50000)
            ->assertJsonPath('data.total_amount', 400000);
    }

    // =========================================================================
    // SCENARIO 16: Visits - Discount Amount Validation
    // =========================================================================
    public function test_scenario_16_visits_discount_amount_validation(): void
    {
        $user = $this->createUserWithPermissions(['visits.view', 'visits.create']);

        $patient = Patient::create([
            'patient_code' => 'BN160001',
            'full_name' => 'BN Discount Test',
            'phone' => '0916000001',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS160001',
            'full_name' => 'BS Discount Test',
            'phone' => '0916000002',
            'email' => 'doc16@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-16001',
            'name' => 'Dich Vu Discount',
            'price' => 100000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        // Discount exceeds subtotal (discount 250,000 > subtotal 200,000)
        $response = $this->authenticate($user)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => '2026-11-25 10:00:00',
                'quantity' => 2,
                'unit_price' => 100000.00,
                'discount_amount' => 250000.00,
                'status' => 'SCHEDULED',
            ]);

        $response->assertStatus(422);
    }

    // =========================================================================
    // SCENARIO 17: Visits - Updates Patient Visit Dates
    // =========================================================================
    public function test_scenario_17_visits_updates_patient_first_and_last_visit_dates(): void
    {
        $user = $this->createUserWithPermissions(['visits.view', 'visits.create']);

        $patient = Patient::create([
            'patient_code' => 'BN170001',
            'full_name' => 'BN Visit Dates',
            'phone' => '0917000001',
            'first_visit_date' => null,
            'last_visit_date' => null,
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS170001',
            'full_name' => 'BS Visit Dates',
            'phone' => '0917000002',
            'email' => 'doc17@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-17001',
            'name' => 'Dich Vu Visit Dates',
            'price' => 100000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        // First visit
        $this->authenticate($user)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => '2026-11-01 08:00:00',
                'quantity' => 1,
                'unit_price' => 100000.00,
                'discount_amount' => 0.00,
                'status' => 'SCHEDULED',
            ])->assertStatus(201);

        // Second visit later
        $this->authenticate($user)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => '2026-11-15 10:00:00',
                'quantity' => 1,
                'unit_price' => 100000.00,
                'discount_amount' => 0.00,
                'status' => 'SCHEDULED',
            ])->assertStatus(201);

        $patient->refresh();
        $this->assertSame('2026-11-01', $patient->first_visit_date?->toDateString());
        $this->assertSame('2026-11-15', $patient->last_visit_date?->toDateString());
    }

    // =========================================================================
    // SCENARIO 18: Visits - Package Session Deduction & Invariant Preservation
    // =========================================================================
    public function test_scenario_18_visit_package_session_deduction_and_invariant(): void
    {
        $user = $this->createUserWithPermissions(['visits.view', 'visits.create']);

        $patient = Patient::create([
            'patient_code' => 'BN180001',
            'full_name' => 'BN Package Deduction',
            'phone' => '0918000001',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS180001',
            'full_name' => 'BS Package Deduction',
            'phone' => '0918000002',
            'email' => 'doc18@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-18001',
            'name' => 'Dich Vu Trong Goi',
            'price' => 100000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI-18001',
            'name' => 'Goi 5 Buoi',
            'price' => 450000.00,
            'total_sessions' => 5,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        PackageService::create([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 5,
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'price' => 450000.00,
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(30)->toDateString(),
            'status' => 'ACTIVE',
        ]);

        // Create visit consuming 2 sessions from package
        $response = $this->authenticate($user)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'patient_package_id' => $patientPackage->id,
                'visit_date' => now()->toDateString().' 09:00:00',
                'quantity' => 2,
                'unit_price' => 100000.00,
                'discount_amount' => 0.00,
                'status' => 'SCHEDULED',
            ]);

        $response->assertStatus(201);

        $patientPackage->refresh();
        $this->assertSame(2, $patientPackage->used_sessions);
        $this->assertSame(3, $patientPackage->remaining_sessions);
        $this->assertSame(
            $patientPackage->total_sessions,
            $patientPackage->used_sessions + $patientPackage->remaining_sessions
        );
    }

    // =========================================================================
    // SCENARIO 19: Medical Records - Privacy & Role Protection (RBAC Masking)
    // =========================================================================
    public function test_scenario_19_medical_records_privacy_and_role_protection(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $patient = Patient::create([
            'patient_code' => 'BN190001',
            'full_name' => 'BN Medical Privacy',
            'phone' => '0919000001',
            'status' => 'ACTIVE',
        ]);

        $doctorEmployee = Employee::create([
            'employee_code' => 'BS190001',
            'full_name' => 'BS Kha Lam Sang',
            'phone' => '0919000002',
            'email' => 'doc19@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-19001',
            'name' => 'Kham Tai Mui Hong',
            'price' => 150000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'VIS190001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'visit_date' => now()->toDateTimeString(),
            'status' => 'IN_PROGRESS',
            'payment_status' => 'UNPAID',
            'quantity' => 1,
            'unit_price' => 150000.00,
            'discount_amount' => 0.00,
            'total_amount' => 150000.00,
        ]);

        // Doctor creates medical record
        $docCreateResponse = $this->authenticate($doctor)
            ->postJson("/api/v1/visits/{$visit->id}/medical-record", [
                'diagnosis' => 'Viem amydal man tinh',
                'medical_history' => 'Tien su di ung phan hoa',
                'treatment' => 'Khang sinh va theo doi 7 ngay',
            ]);

        $docCreateResponse->assertStatus(201)
            ->assertJsonPath('data.diagnosis', 'Viem amydal man tinh');

        // Receptionist accessing medical record directly is blocked with 403
        $recRecordResponse = $this->authenticate($receptionist)
            ->getJson("/api/v1/visits/{$visit->id}/medical-record");

        $recRecordResponse->assertStatus(403);

        // Receptionist viewing visit details has medical_record field masked/null
        $recVisitResponse = $this->authenticate($receptionist)
            ->getJson("/api/v1/visits/{$visit->id}");

        $recVisitResponse->assertStatus(200)
            ->assertJsonPath('data.medical_record', null);

        // Doctor viewing visit details receives complete medical_record data
        $docVisitResponse = $this->authenticate($doctor)
            ->getJson("/api/v1/visits/{$visit->id}");

        $docVisitResponse->assertStatus(200)
            ->assertJsonPath('data.medical_record.diagnosis', 'Viem amydal man tinh');
    }

    // =========================================================================
    // SCENARIO 20: Transaction Rollback - Preserves Database Consistency
    // =========================================================================
    public function test_scenario_20_transaction_rollback_guarantees_database_integrity(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN200001',
            'full_name' => 'BN Rollback Test',
            'phone' => '0920000001',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-20001',
            'name' => 'Dich Vu Atomic',
            'price' => 200000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI-20001',
            'name' => 'Goi Atomic Test',
            'price' => 600000.00,
            'total_sessions' => 3,
            'validity_days' => 30,
            'status' => 'ACTIVE',
        ]);

        PackageService::create([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 3,
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'price' => 600000.00,
            'total_sessions' => 3,
            'used_sessions' => 0,
            'remaining_sessions' => 3,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(30)->toDateString(),
            'status' => 'ACTIVE',
        ]);

        $visitService = app(VisitService::class);
        $initialVisitsCount = Visit::count();
        $initialAuditCount = AuditLog::count();

        // Simulate multi-step atomic failure
        try {
            DB::transaction(function () use ($visitService, $patientPackage, $patient, $service) {
                // Step 1: Deduct session
                $visitService->deductPackageSessions(
                    packageId: $patientPackage->id,
                    patientId: $patient->id,
                    serviceId: $service->id,
                    quantity: 1,
                    visitDate: now()->toDateString()
                );

                // Step 2: Severe unexpected crash before completing visit
                throw new Exception('Fatal crash mid-transaction');
            });
        } catch (Exception $e) {
            $this->assertSame('Fatal crash mid-transaction', $e->getMessage());
        }

        // Verify all changes were completely rolled back
        $fresh = $patientPackage->fresh();
        $this->assertSame(3, $fresh->remaining_sessions);
        $this->assertSame(0, $fresh->used_sessions);
        $this->assertSame('ACTIVE', $fresh->status);
        $this->assertSame($initialVisitsCount, Visit::count());
        $this->assertSame($initialAuditCount, AuditLog::count());
    }
}
