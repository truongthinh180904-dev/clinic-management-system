<?php

namespace Tests\Feature;

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
use InvalidArgumentException;
use Tests\TestCase;

class TransactionRollbackTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create a user with permissions.
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
            'username' => 'test_user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => $status,
        ]);

        $role = Role::create([
            'name' => 'ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Test role',
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
     * Helper to authenticate user with token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    public function test_visit_creation_rolls_back_package_deduction_on_subsequent_failure(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN000001',
            'full_name' => 'Nguyen Van A',
            'phone' => '0912345678',
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV001',
            'name' => 'Kham Tong Quat',
            'price' => 200000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI001',
            'name' => 'Goi Cham Soc',
            'price' => 1000000.00,
            'total_sessions' => 5,
            'validity_days' => 180,
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
            'price' => 1000000.00,
            'total_sessions' => 5,
            'used_sessions' => 0,
            'remaining_sessions' => 5,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addMonths(6)->toDateString(),
            'status' => 'ACTIVE',
        ]);

        $visitService = app(VisitService::class);
        $initialRemaining = $patientPackage->remaining_sessions;
        $initialUsed = $patientPackage->used_sessions;

        // Simulate multi-step atomic operation where step 1 deducts sessions and step 2 fails
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

                // Step 2: Simulated unexpected failure during visit persistence
                throw new Exception('Simulated database error during visit finalization');
            });
        } catch (Exception $e) {
            $this->assertSame('Simulated database error during visit finalization', $e->getMessage());
        }

        // Verify database state was fully rolled back
        $freshPackage = $patientPackage->fresh();
        $this->assertSame($initialRemaining, $freshPackage->remaining_sessions);
        $this->assertSame($initialUsed, $freshPackage->used_sessions);
        $this->assertSame(0, Visit::count());
        $this->assertSame(0, AuditLog::where('action', 'deduct_package_session')->count());
    }

    public function test_medical_record_creation_rolls_back_when_database_error_occurs(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN000002',
            'full_name' => 'Tran Thi B',
            'phone' => '0987654321',
            'gender' => 'FEMALE',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'NV000002',
            'full_name' => 'Bac Si Test',
            'phone' => '0909123456',
            'email' => 'doctor@clinic.local',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV002',
            'name' => 'Kham Tai Mui Hong',
            'price' => 150000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'VIS000001',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->toDateString(),
            'status' => 'IN_PROGRESS',
            'payment_status' => 'UNPAID',
            'quantity' => 1,
            'unit_price' => 150000.00,
            'discount_amount' => 0.00,
            'total_amount' => 150000.00,
        ]);

        $initialAuditCount = AuditLog::count();

        try {
            DB::transaction(function () use ($visit, $doctor) {
                // Create medical record
                DB::table('medical_records')->insert([
                    'visit_id' => $visit->id,
                    'doctor_id' => $doctor->id,
                    'diagnosis' => 'Viem hong cap',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // Create audit log
                AuditLog::create([
                    'module' => 'medical_records',
                    'action' => 'create',
                    'table_name' => 'medical_records',
                    'record_id' => (string) $visit->id,
                    'created_at' => now(),
                ]);

                // Force exception before commit
                throw new Exception('Database constraint violation simulated');
            });
        } catch (Exception $e) {
            $this->assertSame('Database constraint violation simulated', $e->getMessage());
        }

        $this->assertDatabaseMissing('medical_records', ['visit_id' => $visit->id]);
        $this->assertSame($initialAuditCount, AuditLog::count());
    }

    public function test_package_deduction_fails_atomically_when_sessions_exceeded(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN000003',
            'full_name' => 'Le Van C',
            'phone' => '0933112233',
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV003',
            'name' => 'Nha Khoa',
            'price' => 300000.00,
            'duration_minutes' => 45,
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI003',
            'name' => 'Goi Rang Ham Mat',
            'price' => 600000.00,
            'total_sessions' => 2,
            'validity_days' => 30,
            'status' => 'ACTIVE',
        ]);

        PackageService::create([
            'package_id' => $package->id,
            'service_id' => $service->id,
            'quantity' => 2,
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'price' => 600000.00,
            'total_sessions' => 2,
            'used_sessions' => 1,
            'remaining_sessions' => 1,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addMonths(1)->toDateString(),
            'status' => 'ACTIVE',
        ]);

        $visitService = app(VisitService::class);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Gói dịch vụ không đủ số buổi còn lại (còn 1 buổi, yêu cầu 2 buổi).');

        try {
            DB::transaction(function () use ($visitService, $patientPackage, $patient, $service) {
                $visitService->deductPackageSessions(
                    packageId: $patientPackage->id,
                    patientId: $patient->id,
                    serviceId: $service->id,
                    quantity: 2, // Exceeds remaining 1 session
                    visitDate: now()->toDateString()
                );
            });
        } finally {
            $fresh = $patientPackage->fresh();
            $this->assertSame(1, $fresh->remaining_sessions);
            $this->assertSame(1, $fresh->used_sessions);
            $this->assertSame('ACTIVE', $fresh->status);
        }
    }
}
