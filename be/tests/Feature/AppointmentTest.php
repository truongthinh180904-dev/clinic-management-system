<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AppointmentTest extends TestCase
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
     * Helper to authenticate user via Sanctum token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withToken($token);
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
            'date_of_birth' => '1990-01-01',
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create a test doctor/employee.
     */
    protected function createDoctor(): Employee
    {
        return Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác sĩ '.fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Bác sĩ chuyên khoa',
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create a test service.
     */
    protected function createService(): Service
    {
        return Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám tổng quát '.fake()->lexify('???'),
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create an appointment.
     */
    protected function createAppointment(array $overrides = []): Appointment
    {
        $patient = $overrides['patient'] ?? $this->createPatient();
        $doctor = $overrides['doctor'] ?? $this->createDoctor();
        $service = $overrides['service'] ?? $this->createService();

        return Appointment::create([
            'appointment_code' => $overrides['appointment_code'] ?? 'APT'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => $overrides['appointment_date'] ?? '2026-11-01',
            'start_time' => $overrides['start_time'] ?? '08:30:00',
            'end_time' => $overrides['end_time'] ?? '09:00:00',
            'status' => $overrides['status'] ?? Appointment::STATUS_PENDING,
            'notes' => $overrides['notes'] ?? null,
            'created_by' => $overrides['created_by'] ?? null,
        ]);
    }

    /**
     * Test multi-criteria appointment filters (Date range, Employee, Service, Status, Search).
     */
    public function test_can_list_appointments_with_multi_criteria_filters(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $doctor1 = $this->createDoctor();
        $doctor2 = $this->createDoctor();
        $service1 = $this->createService();
        $service2 = $this->createService();
        $patient1 = $this->createPatient();
        $patient2 = $this->createPatient();

        // Appointment 1: Doctor 1, Service 1, Status PENDING, Date 2026-11-05
        $appt1 = $this->createAppointment([
            'doctor' => $doctor1,
            'service' => $service1,
            'patient' => $patient1,
            'status' => Appointment::STATUS_PENDING,
            'appointment_date' => '2026-11-05',
            'appointment_code' => 'APT001001',
        ]);

        // Appointment 2: Doctor 2, Service 2, Status CONFIRMED, Date 2026-11-10
        $appt2 = $this->createAppointment([
            'doctor' => $doctor2,
            'service' => $service2,
            'patient' => $patient2,
            'status' => Appointment::STATUS_CONFIRMED,
            'appointment_date' => '2026-11-10',
            'appointment_code' => 'APT001002',
        ]);

        // Appointment 3: Doctor 1, Service 2, Status COMPLETED, Date 2026-11-20
        $appt3 = $this->createAppointment([
            'doctor' => $doctor1,
            'service' => $service2,
            'patient' => $patient1,
            'status' => Appointment::STATUS_COMPLETED,
            'appointment_date' => '2026-11-20',
            'appointment_code' => 'APT001003',
        ]);

        // Filter 1: By Date Range (2026-11-01 to 2026-11-12) -> should return appt1 and appt2
        $response = $this->authenticate($admin)->getJson('/api/v1/appointments?from_date=2026-11-01&to_date=2026-11-12');
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($appt1->id, $ids);
        $this->assertContains($appt2->id, $ids);
        $this->assertNotContains($appt3->id, $ids);

        // Filter 2: By Employee/Doctor (Doctor 2 only)
        $response = $this->authenticate($admin)->getJson('/api/v1/appointments?employee_id='.$doctor2->id);
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($appt2->id, $ids);
        $this->assertNotContains($appt1->id, $ids);
        $this->assertNotContains($appt3->id, $ids);

        // Filter 3: By Service (Service 1 only)
        $response = $this->authenticate($admin)->getJson('/api/v1/appointments?service_id='.$service1->id);
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($appt1->id, $ids);
        $this->assertNotContains($appt2->id, $ids);

        // Filter 4: By Status (CONFIRMED only)
        $response = $this->authenticate($admin)->getJson('/api/v1/appointments?status=CONFIRMED');
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($appt2->id, $ids);
        $this->assertNotContains($appt1->id, $ids);

        // Filter 5: Keyword Search by Code
        $response = $this->authenticate($admin)->getJson('/api/v1/appointments?search=APT001001');
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($appt1->id, $ids);
        $this->assertNotContains($appt2->id, $ids);
    }

    /**
     * Test valid state transition: PENDING -> CONFIRMED.
     */
    public function test_state_machine_transition_from_pending_to_confirmed(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_PENDING]);

        $response = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'CONFIRMED',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'CONFIRMED');

        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'CONFIRMED',
        ]);
    }

    /**
     * Test valid state transition: CONFIRMED -> COMPLETED.
     */
    public function test_state_machine_transition_from_confirmed_to_completed(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_CONFIRMED]);

        $response = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'COMPLETED',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'COMPLETED');

        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'COMPLETED',
        ]);
    }

    /**
     * Test anti-jumping: PENDING cannot directly jump to COMPLETED without being CONFIRMED.
     */
    public function test_state_machine_cannot_jump_from_pending_to_completed(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_PENDING]);

        $response = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'COMPLETED',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        // Verify status remains PENDING in database
        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'PENDING',
        ]);
    }

    /**
     * Test cancellation requires a cancellation reason.
     */
    public function test_state_machine_cancel_requires_reason(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_PENDING]);

        // 1. Cancel endpoint without reason
        $response1 = $this->authenticate($admin)->postJson("/api/v1/appointments/{$appt->id}/cancel", [
            'reason' => '',
        ]);
        $response1->assertStatus(422);

        // 2. Status update endpoint with CANCELLED but empty notes/reason
        $response2 = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'CANCELLED',
            'notes' => '',
        ]);
        $response2->assertStatus(422);

        // Verify status is not CANCELLED
        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'PENDING',
        ]);
    }

    /**
     * Test valid cancellation with reason.
     */
    public function test_state_machine_cancel_with_reason_succeeds(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_PENDING]);

        $response = $this->authenticate($admin)->postJson("/api/v1/appointments/{$appt->id}/cancel", [
            'reason' => 'Bệnh nhân bận việc đột xuất cần đổi lịch sau.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'CANCELLED');

        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'CANCELLED',
        ]);
    }

    /**
     * Test terminal state COMPLETED cannot be changed or cancelled.
     */
    public function test_state_machine_terminal_state_completed_cannot_be_changed(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_COMPLETED]);

        // Attempt to cancel a COMPLETED appointment
        $response1 = $this->authenticate($admin)->postJson("/api/v1/appointments/{$appt->id}/cancel", [
            'reason' => 'Muốn hủy sau khi đã khám',
        ]);
        $response1->assertStatus(422);

        // Attempt to change status back to CONFIRMED
        $response2 = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'CONFIRMED',
        ]);
        $response2->assertStatus(422);

        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'COMPLETED',
        ]);
    }

    /**
     * Test terminal state CANCELLED cannot be reopened or changed.
     */
    public function test_state_machine_terminal_state_cancelled_cannot_be_changed(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment([
            'status' => Appointment::STATUS_CANCELLED,
            'notes' => 'Lý do hủy: Đã hủy trước đó',
        ]);

        // Attempt to change status to CONFIRMED
        $response1 = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'CONFIRMED',
        ]);
        $response1->assertStatus(422);

        // Attempt to change status to COMPLETED
        $response2 = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'COMPLETED',
        ]);
        $response2->assertStatus(422);

        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'CANCELLED',
        ]);
    }

    /**
     * Test valid transition from CONFIRMED to NO_SHOW.
     */
    public function test_state_machine_confirmed_to_no_show(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_CONFIRMED]);

        $response = $this->authenticate($admin)->patchJson("/api/v1/appointments/{$appt->id}/status", [
            'status' => 'NO_SHOW',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'NO_SHOW');

        $this->assertDatabaseHas('appointments', [
            'id' => $appt->id,
            'status' => 'NO_SHOW',
        ]);
    }

    /**
     * Test update appointment via PUT also enforces state machine transitions.
     */
    public function test_update_appointment_via_put_enforces_state_machine(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $appt = $this->createAppointment(['status' => Appointment::STATUS_PENDING]);

        // Invalid: PENDING directly to COMPLETED via PUT
        $response = $this->authenticate($admin)->putJson("/api/v1/appointments/{$appt->id}", [
            'status' => 'COMPLETED',
        ]);

        $response->assertStatus(422);

        // Valid: PENDING to CONFIRMED via PUT
        $responseValid = $this->authenticate($admin)->putJson("/api/v1/appointments/{$appt->id}", [
            'status' => 'CONFIRMED',
        ]);

        $responseValid->assertStatus(200)
            ->assertJsonPath('data.status', 'CONFIRMED');
    }
}
