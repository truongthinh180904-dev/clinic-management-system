<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Invoice;
use App\Models\KpiTarget;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KpiTargetApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create an active user with specific role.
     */
    protected function createUserWithRole(string $roleName = 'ADMIN'): User
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
            'username' => 'kpi_user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::where('name', $roleName)->first();
        if ($role) {
            $user->roles()->attach($role->id, ['created_at' => now()]);
        }

        return $user;
    }

    /**
     * Helper to create a user with specific permissions.
     *
     * @param  list<string>  $permissionKeys
     */
    protected function createUserWithPermissions(array $permissionKeys): User
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
            'username' => 'kpi_perm_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'CUSTOM_KPI_ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Custom role for KPI testing',
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
     * Authenticate a user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a test doctor/employee.
     */
    protected function createDoctor(string $code = 'BS001', string $name = 'Bác Sĩ Nguyễn Văn A'): Employee
    {
        return Employee::create([
            'employee_code' => $code,
            'full_name' => $name,
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'department' => 'Khám tổng quát',
            'position' => 'Bác sĩ điều trị',
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(): Patient
    {
        return Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create a test service.
     */
    protected function createService(): Service
    {
        return Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('####'),
            'name' => 'Dịch vụ khám',
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);
    }

    public function test_unauthenticated_user_cannot_access_kpi_targets(): void
    {
        $this->getJson('/api/v1/kpi-targets')
            ->assertStatus(401);

        $this->postJson('/api/v1/kpi-targets', [])
            ->assertStatus(401);
    }

    public function test_user_without_permission_cannot_view_or_manage_kpi_targets(): void
    {
        // Doctor role only has clinical permissions, not kpi_targets.view or manage
        $userWithoutPerm = $this->createUserWithRole('DOCTOR');
        $this->authenticate($userWithoutPerm);

        $this->getJson('/api/v1/kpi-targets')
            ->assertStatus(403);

        $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => 1,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 10000000,
            'target_visits' => 100,
        ])->assertStatus(403);
    }

    public function test_user_with_view_permission_can_list_kpi_targets(): void
    {
        $doctor = $this->createDoctor('BS-TEST-01');
        $admin = $this->createUserWithRole('ADMIN');

        KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 50000000,
            'target_visits' => 100,
            'created_by' => $admin->id,
        ]);

        $viewer = $this->createUserWithPermissions(['kpi_targets.view']);
        $this->authenticate($viewer);

        $response = $this->getJson('/api/v1/kpi-targets');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'employee_id',
                        'period_start',
                        'period_end',
                        'target_revenue',
                        'target_visits',
                        'actual_revenue',
                        'actual_visits',
                        'revenue_completion_rate',
                        'visits_completion_rate',
                        'evaluation_status',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'total',
                ],
            ]);

        $this->assertCount(1, $response->json('data'));
    }

    public function test_can_filter_kpi_targets_by_employee_and_date_range(): void
    {
        $doctor1 = $this->createDoctor('BS-001', 'Bác sĩ Một');
        $doctor2 = $this->createDoctor('BS-002', 'Bác sĩ Hai');
        $admin = $this->createUserWithRole('ADMIN');

        KpiTarget::create([
            'employee_id' => $doctor1->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 30000000,
            'target_visits' => 50,
            'created_by' => $admin->id,
        ]);

        KpiTarget::create([
            'employee_id' => $doctor2->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 40000000,
            'target_visits' => 60,
            'created_by' => $admin->id,
        ]);

        KpiTarget::create([
            'employee_id' => $doctor1->id,
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'target_revenue' => 35000000,
            'target_visits' => 55,
            'created_by' => $admin->id,
        ]);

        $this->authenticate($admin);

        // Filter by employee_id
        $resDoctor1 = $this->getJson("/api/v1/kpi-targets?employee_id={$doctor1->id}");
        $resDoctor1->assertStatus(200);
        $this->assertCount(2, $resDoctor1->json('data'));

        // Filter via alias endpoint
        $resAlias = $this->getJson("/api/v1/employees/{$doctor2->id}/kpi-targets");
        $resAlias->assertStatus(200);
        $this->assertCount(1, $resAlias->json('data'));
        $this->assertEquals($doctor2->id, $resAlias->json('data.0.employee_id'));

        // Filter by date range
        $resPeriod = $this->getJson('/api/v1/kpi-targets?start_date=2026-11-01&end_date=2026-11-30');
        $resPeriod->assertStatus(200);
        $this->assertCount(1, $resPeriod->json('data'));
        $this->assertEquals('2026-11-01', $resPeriod->json('data.0.period_start'));
    }

    public function test_can_create_kpi_target_successfully(): void
    {
        $doctor = $this->createDoctor('BS-CREATE-01');
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $payload = [
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 25000000.50,
            'target_visits' => 75,
        ];

        $response = $this->postJson('/api/v1/kpi-targets', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.employee_id', $doctor->id)
            ->assertJsonPath('data.period_start', '2026-10-01')
            ->assertJsonPath('data.period_end', '2026-10-31')
            ->assertJsonPath('data.target_revenue', 25000000.5)
            ->assertJsonPath('data.target_visits', 75)
            ->assertJsonPath('data.created_by', $admin->id);

        $this->assertDatabaseHas('kpi_targets', [
            'employee_id' => $doctor->id,
            'target_visits' => 75,
            'created_by' => $admin->id,
        ]);

        $createdTarget = KpiTarget::where('employee_id', $doctor->id)->first();
        $this->assertNotNull($createdTarget);
        $this->assertSame('2026-10-01', Carbon::parse($createdTarget->period_start)->format('Y-m-d'));
        $this->assertSame('2026-10-31', Carbon::parse($createdTarget->period_end)->format('Y-m-d'));

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'kpi_targets',
            'action' => 'create',
            'user_id' => $admin->id,
        ]);
    }

    public function test_create_kpi_target_validation_errors(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        // Missing all required fields
        $this->postJson('/api/v1/kpi-targets', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['employee_id', 'period_start', 'period_end', 'target_revenue', 'target_visits']);

        // End date before start date
        $doctor = $this->createDoctor('BS-VAL-01');
        $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-31',
            'period_end' => '2026-10-01',
            'target_revenue' => 1000000,
            'target_visits' => 10,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['period_end']);

        // Negative values
        $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => -500,
            'target_visits' => -5,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['target_revenue', 'target_visits']);

        // Non-existent employee
        $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => 999999,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 1000000,
            'target_visits' => 10,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['employee_id']);
    }

    public function test_overlap_prevention_blocks_overlapping_kpi_periods_for_same_employee(): void
    {
        $doctorA = $this->createDoctor('BS-OVERLAP-A');
        $doctorB = $this->createDoctor('BS-OVERLAP-B');
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        // Existing target for Doctor A: 2026-10-01 -> 2026-10-31
        KpiTarget::create([
            'employee_id' => $doctorA->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 10000000,
            'target_visits' => 50,
            'created_by' => $admin->id,
        ]);

        // Attempt 1: Overlaps at the end (2026-10-20 -> 2026-11-15) -> FAIL 422
        $res1 = $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctorA->id,
            'period_start' => '2026-10-20',
            'period_end' => '2026-11-15',
            'target_revenue' => 10000000,
            'target_visits' => 50,
        ]);
        $res1->assertStatus(422)
            ->assertJsonPath('success', false);

        // Attempt 2: Overlaps at the beginning (2026-09-15 -> 2026-10-05) -> FAIL 422
        $res2 = $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctorA->id,
            'period_start' => '2026-09-15',
            'period_end' => '2026-10-05',
            'target_revenue' => 10000000,
            'target_visits' => 50,
        ]);
        $res2->assertStatus(422)
            ->assertJsonPath('success', false);

        // Attempt 3: Completely inside (2026-10-10 -> 2026-10-20) -> FAIL 422
        $res3 = $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctorA->id,
            'period_start' => '2026-10-10',
            'period_end' => '2026-10-20',
            'target_revenue' => 10000000,
            'target_visits' => 50,
        ]);
        $res3->assertStatus(422)
            ->assertJsonPath('success', false);

        // Attempt 4: Completely encompasses (2026-09-01 -> 2026-11-30) -> FAIL 422
        $res4 = $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctorA->id,
            'period_start' => '2026-09-01',
            'period_end' => '2026-11-30',
            'target_revenue' => 10000000,
            'target_visits' => 50,
        ]);
        $res4->assertStatus(422)
            ->assertJsonPath('success', false);

        // Doctor A for adjacent next month (2026-11-01 -> 2026-11-30) -> SUCCESS 201
        $resSuccessA = $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctorA->id,
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'target_revenue' => 10000000,
            'target_visits' => 50,
        ]);
        $resSuccessA->assertStatus(201);

        // Doctor B for same period as Doctor A (2026-10-01 -> 2026-10-31) -> SUCCESS 201
        $resSuccessB = $this->postJson('/api/v1/kpi-targets', [
            'employee_id' => $doctorB->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 15000000,
            'target_visits' => 60,
        ]);
        $resSuccessB->assertStatus(201);
    }

    public function test_can_show_single_kpi_target(): void
    {
        $doctor = $this->createDoctor('BS-SHOW-01');
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $target = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 20000000,
            'target_visits' => 40,
            'created_by' => $admin->id,
        ]);

        $response = $this->getJson("/api/v1/kpi-targets/{$target->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $target->id)
            ->assertJsonPath('data.employee.id', $doctor->id)
            ->assertJsonPath('data.target_revenue', 20000000);

        // Non-existent target
        $this->getJson('/api/v1/kpi-targets/999999')
            ->assertStatus(404);
    }

    public function test_can_update_kpi_target_and_overlap_validation_applies(): void
    {
        $doctor = $this->createDoctor('BS-UPD-01');
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $target1 = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 20000000,
            'target_visits' => 40,
            'created_by' => $admin->id,
        ]);

        $target2 = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'target_revenue' => 25000000,
            'target_visits' => 50,
            'created_by' => $admin->id,
        ]);

        // Successfully update targets without changing dates
        $updateRes = $this->putJson("/api/v1/kpi-targets/{$target1->id}", [
            'target_revenue' => 22000000,
            'target_visits' => 45,
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.target_revenue', 22000000)
            ->assertJsonPath('data.target_visits', 45);

        // Updating target2 to overlap with target1 -> FAIL 422
        $overlapRes = $this->putJson("/api/v1/kpi-targets/{$target2->id}", [
            'period_start' => '2026-10-25',
        ]);
        $overlapRes->assertStatus(422)
            ->assertJsonPath('success', false);

        // Non-existent target update
        $this->putJson('/api/v1/kpi-targets/999999', [
            'target_revenue' => 1000000,
        ])->assertStatus(404);
    }

    public function test_can_delete_kpi_target(): void
    {
        $doctor = $this->createDoctor('BS-DEL-01');
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $target = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 20000000,
            'target_visits' => 40,
            'created_by' => $admin->id,
        ]);

        $response = $this->deleteJson("/api/v1/kpi-targets/{$target->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('kpi_targets', ['id' => $target->id]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'kpi_targets',
            'action' => 'delete',
            'user_id' => $admin->id,
        ]);

        // Cannot delete non-existent target
        $this->deleteJson("/api/v1/kpi-targets/{$target->id}")
            ->assertStatus(404);
    }

    public function test_actual_performance_calculation_from_completed_visits_and_invoices(): void
    {
        $doctorA = $this->createDoctor('BS-PERF-A', 'Bác sĩ Đạt Chỉ Tiêu');
        $doctorB = $this->createDoctor('BS-PERF-B', 'Bác sĩ Khác');
        $patient = $this->createPatient();
        $service = $this->createService();
        $admin = $this->createUserWithRole('ADMIN');

        // Create KPI target for Doctor A in October 2026:
        // Target: 10 visits, 1,000,000 VND
        $kpiTarget = KpiTarget::create([
            'employee_id' => $doctorA->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 1000000,
            'target_visits' => 10,
            'created_by' => $admin->id,
        ]);

        // Visit 1: Completed in October by Doctor A (300,000 VND)
        $visit1 = Visit::create([
            'visit_code' => 'VIS-OCT-001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorA->id,
            'service_id' => $service->id,
            'visit_date' => '2026-10-05 09:00:00',
            'quantity' => 1,
            'unit_price' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'status' => Visit::STATUS_COMPLETED,
            'created_by' => $admin->id,
        ]);

        // Invoice for Visit 1
        Invoice::create([
            'invoice_code' => 'INV-OCT-001',
            'patient_id' => $patient->id,
            'visit_id' => $visit1->id,
            'subtotal_amount' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'paid_amount' => 300000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => '2026-10-05 09:30:00',
            'created_by' => $admin->id,
        ]);

        // Visit 2: Completed in October by Doctor A (500,000 VND)
        $visit2 = Visit::create([
            'visit_code' => 'VIS-OCT-002',
            'patient_id' => $patient->id,
            'employee_id' => $doctorA->id,
            'service_id' => $service->id,
            'visit_date' => '2026-10-15 14:00:00',
            'quantity' => 1,
            'unit_price' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => Visit::PAYMENT_STATUS_PARTIAL,
            'status' => Visit::STATUS_COMPLETED,
            'created_by' => $admin->id,
        ]);

        // Invoice for Visit 2
        Invoice::create([
            'invoice_code' => 'INV-OCT-002',
            'patient_id' => $patient->id,
            'visit_id' => $visit2->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'paid_amount' => 200000,
            'remaining_amount' => 300000,
            'status' => 'PARTIAL',
            'issued_at' => '2026-10-15 14:30:00',
            'created_by' => $admin->id,
        ]);

        // Visit 3: SCHEDULED in October by Doctor A (should NOT count as actual visits)
        Visit::create([
            'visit_code' => 'VIS-OCT-003',
            'patient_id' => $patient->id,
            'employee_id' => $doctorA->id,
            'service_id' => $service->id,
            'visit_date' => '2026-10-20 10:00:00',
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
            'status' => Visit::STATUS_SCHEDULED,
            'created_by' => $admin->id,
        ]);

        // Visit 4: CANCELLED in October by Doctor A (should NOT count)
        $visitCancelled = Visit::create([
            'visit_code' => 'VIS-OCT-004',
            'patient_id' => $patient->id,
            'employee_id' => $doctorA->id,
            'service_id' => $service->id,
            'visit_date' => '2026-10-22 10:00:00',
            'quantity' => 1,
            'unit_price' => 400000,
            'discount_amount' => 0,
            'total_amount' => 400000,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
            'status' => Visit::STATUS_CANCELLED,
            'created_by' => $admin->id,
        ]);

        // Cancelled invoice should NOT count towards actual revenue
        Invoice::create([
            'invoice_code' => 'INV-OCT-CANCELLED',
            'patient_id' => $patient->id,
            'visit_id' => $visitCancelled->id,
            'subtotal_amount' => 400000,
            'discount_amount' => 0,
            'total_amount' => 400000,
            'paid_amount' => 0,
            'remaining_amount' => 400000,
            'status' => 'CANCELLED',
            'issued_at' => '2026-10-22 10:30:00',
            'created_by' => $admin->id,
        ]);

        // Visit 5: Completed in November by Doctor A (outside period, should NOT count)
        Visit::create([
            'visit_code' => 'VIS-NOV-001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorA->id,
            'service_id' => $service->id,
            'visit_date' => '2026-11-05 09:00:00',
            'quantity' => 1,
            'unit_price' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'status' => Visit::STATUS_COMPLETED,
            'created_by' => $admin->id,
        ]);

        // Visit 6: Completed in October by Doctor B (different doctor, should NOT count)
        $visitB = Visit::create([
            'visit_code' => 'VIS-OCT-DOCTOR-B',
            'patient_id' => $patient->id,
            'employee_id' => $doctorB->id,
            'service_id' => $service->id,
            'visit_date' => '2026-10-18 11:00:00',
            'quantity' => 1,
            'unit_price' => 800000,
            'discount_amount' => 0,
            'total_amount' => 800000,
            'payment_status' => Visit::PAYMENT_STATUS_PAID,
            'status' => Visit::STATUS_COMPLETED,
            'created_by' => $admin->id,
        ]);

        Invoice::create([
            'invoice_code' => 'INV-OCT-DOCTOR-B',
            'patient_id' => $patient->id,
            'visit_id' => $visitB->id,
            'subtotal_amount' => 800000,
            'discount_amount' => 0,
            'total_amount' => 800000,
            'paid_amount' => 800000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => '2026-10-18 11:30:00',
            'created_by' => $admin->id,
        ]);

        $this->authenticate($admin);

        $response = $this->getJson("/api/v1/kpi-targets/{$kpiTarget->id}");

        $response->assertStatus(200);

        // Expected metrics:
        // actual_visits = 2 (Visit 1 and Visit 2)
        // actual_revenue = 800,000 (300,000 + 500,000)
        // visits_completion_rate = (2 / 10) * 100 = 20.0%
        // revenue_completion_rate = (800,000 / 1,000,000) * 100 = 80.0%
        // average_completion_rate = (20.0 + 80.0) / 2 = 50.0%
        // evaluation_status = 'BEHIND' (since 50% < 80%)
        $data = $response->json('data');

        $this->assertEquals(2, $data['actual_visits']);
        $this->assertEquals(800000.0, $data['actual_revenue']);
        $this->assertEquals(20.0, $data['visits_completion_rate']);
        $this->assertEquals(80.0, $data['revenue_completion_rate']);
        $this->assertEquals(50.0, $data['completion_rate']);
        $this->assertEquals('BEHIND', $data['evaluation_status']);
    }

    public function test_evaluation_status_exceeded_and_on_track(): void
    {
        $doctor = $this->createDoctor('BS-STATUS-TEST');
        $patient = $this->createPatient();
        $service = $this->createService();
        $admin = $this->createUserWithRole('ADMIN');

        // Target 1: Target = 5 visits, 500,000 VND
        $targetExceeded = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-08-01',
            'period_end' => '2026-08-31',
            'target_revenue' => 500000,
            'target_visits' => 5,
            'created_by' => $admin->id,
        ]);

        // Create 6 completed visits (revenue = 600,000) -> 120% completion
        for ($i = 1; $i <= 6; $i++) {
            $v = Visit::create([
                'visit_code' => "VIS-EXCEED-{$i}",
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => "2026-08-0{$i} 09:00:00",
                'quantity' => 1,
                'unit_price' => 100000,
                'discount_amount' => 0,
                'total_amount' => 100000,
                'payment_status' => Visit::PAYMENT_STATUS_PAID,
                'status' => Visit::STATUS_COMPLETED,
                'created_by' => $admin->id,
            ]);

            Invoice::create([
                'invoice_code' => "INV-EXCEED-{$i}",
                'patient_id' => $patient->id,
                'visit_id' => $v->id,
                'subtotal_amount' => 100000,
                'discount_amount' => 0,
                'total_amount' => 100000,
                'paid_amount' => 100000,
                'remaining_amount' => 0,
                'status' => 'PAID',
                'issued_at' => "2026-08-0{$i} 09:30:00",
                'created_by' => $admin->id,
            ]);
        }

        // Target 2: Target = 10 visits, 1,000,000 VND
        $targetOnTrack = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => '2026-09-01',
            'period_end' => '2026-09-30',
            'target_revenue' => 1000000,
            'target_visits' => 10,
            'created_by' => $admin->id,
        ]);

        // Create 9 completed visits (revenue = 850,000) -> visits 90%, revenue 85% -> avg 87.5% -> ON_TRACK
        for ($i = 1; $i <= 9; $i++) {
            $amount = ($i === 9) ? 50000 : 100000;
            $v = Visit::create([
                'visit_code' => "VIS-ONTRACK-{$i}",
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => "2026-09-0{$i} 09:00:00",
                'quantity' => 1,
                'unit_price' => $amount,
                'discount_amount' => 0,
                'total_amount' => $amount,
                'payment_status' => Visit::PAYMENT_STATUS_PAID,
                'status' => Visit::STATUS_COMPLETED,
                'created_by' => $admin->id,
            ]);

            Invoice::create([
                'invoice_code' => "INV-ONTRACK-{$i}",
                'patient_id' => $patient->id,
                'visit_id' => $v->id,
                'subtotal_amount' => $amount,
                'discount_amount' => 0,
                'total_amount' => $amount,
                'paid_amount' => $amount,
                'remaining_amount' => 0,
                'status' => 'PAID',
                'issued_at' => "2026-09-0{$i} 09:30:00",
                'created_by' => $admin->id,
            ]);
        }

        $this->authenticate($admin);

        // Check Target 1 (EXCEEDED)
        $res1 = $this->getJson("/api/v1/kpi-targets/{$targetExceeded->id}");
        $res1->assertStatus(200);
        $this->assertEquals(120.0, $res1->json('data.visits_completion_rate'));
        $this->assertEquals(120.0, $res1->json('data.revenue_completion_rate'));
        $this->assertEquals('EXCEEDED', $res1->json('data.evaluation_status'));

        // Check Target 2 (ON_TRACK)
        $res2 = $this->getJson("/api/v1/kpi-targets/{$targetOnTrack->id}");
        $res2->assertStatus(200);
        $this->assertEquals(90.0, $res2->json('data.visits_completion_rate'));
        $this->assertEquals(85.0, $res2->json('data.revenue_completion_rate'));
        $this->assertEquals(87.5, $res2->json('data.completion_rate'));
        $this->assertEquals('ON_TRACK', $res2->json('data.evaluation_status'));
    }

    public function test_kpi_targets_summary_endpoint(): void
    {
        $doctor1 = $this->createDoctor('BS-SUM-01');
        $doctor2 = $this->createDoctor('BS-SUM-02');
        $admin = $this->createUserWithRole('ADMIN');

        KpiTarget::create([
            'employee_id' => $doctor1->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 10000000,
            'target_visits' => 50,
            'created_by' => $admin->id,
        ]);

        KpiTarget::create([
            'employee_id' => $doctor2->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 20000000,
            'target_visits' => 80,
            'created_by' => $admin->id,
        ]);

        $this->authenticate($admin);

        $response = $this->getJson('/api/v1/kpi-targets/summary');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_targets', 2)
            ->assertJsonPath('data.total_employees_assigned', 2)
            ->assertJsonPath('data.total_target_revenue', 30000000)
            ->assertJsonPath('data.total_target_visits', 130);
    }
}
