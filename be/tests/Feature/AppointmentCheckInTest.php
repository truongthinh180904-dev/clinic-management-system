<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use App\Services\AppointmentService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class AppointmentCheckInTest extends TestCase
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
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Văn Test',
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'address' => '123 Đường Y Tế, Quận 1, TP.HCM',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test doctor/employee.
     */
    protected function createDoctor(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác sĩ '.fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Bác sĩ chuyên khoa',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test clinical service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám chuyên khoa nội tổng quát',
            'description' => 'Khám lâm sàng ban đầu',
            'price' => 200000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
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
            'status' => $overrides['status'] ?? Appointment::STATUS_CONFIRMED,
            'notes' => $overrides['notes'] ?? 'Lịch hẹn định kỳ',
            'created_by' => $overrides['created_by'] ?? null,
        ]);
    }

    /**
     * Test receptionist can check in a confirmed appointment atomically into a visit.
     */
    public function test_receptionist_can_check_in_confirmed_appointment_atomically_into_visit(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $patient = $this->createPatient(['full_name' => 'Bệnh Nhân Tiếp Nhận']);
        $doctor = $this->createDoctor(['full_name' => 'BS. Lê Tiếp Đón']);
        $service = $this->createService(['price' => 250000]);

        $appointment = $this->createAppointment([
            'patient' => $patient,
            'doctor' => $doctor,
            'service' => $service,
            'status' => Appointment::STATUS_CONFIRMED,
            'notes' => 'Khám định kỳ tuần 1',
        ]);

        $response = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.appointment_id', $appointment->id)
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.employee_id', $doctor->id)
            ->assertJsonPath('data.service_id', $service->id)
            ->assertJsonPath('data.status', 'SCHEDULED')
            ->assertJsonPath('data.appointment.status', 'COMPLETED');

        // Verify Visit was created in database linked via appointment_id
        $this->assertDatabaseHas('visits', [
            'appointment_id' => $appointment->id,
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'status' => 'SCHEDULED',
            'total_amount' => 250000,
        ]);

        // Verify Appointment status was transitioned to COMPLETED
        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'status' => Appointment::STATUS_COMPLETED,
        ]);

        // Verify patient visit date is updated
        $patient->refresh();
        $this->assertNotNull($patient->last_visit_date);

        // Verify Audit Logs exist for both Visit creation and Appointment check_in
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'visits',
            'action' => 'create_from_appointment',
            'table_name' => 'visits',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'appointments',
            'action' => 'check_in',
            'table_name' => 'appointments',
            'record_id' => (string) $appointment->id,
        ]);
    }

    /**
     * Test duplicate check-in is rejected when appointment is already completed or has visits.
     */
    public function test_duplicate_check_in_prevention(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $appointment = $this->createAppointment([
            'status' => Appointment::STATUS_CONFIRMED,
        ]);

        // First check-in succeeds
        $firstRes = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in");
        $firstRes->assertStatus(200);

        // Second check-in attempt on the same appointment must fail with 422
        $secondRes = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in");

        $secondRes->assertStatus(422)
            ->assertJsonPath('success', false);

        // Verify exactly one visit exists in database for this appointment
        $this->assertEquals(1, Visit::where('appointment_id', $appointment->id)->count());
    }

    /**
     * Test check-in fails when appointment is still in PENDING status.
     */
    public function test_check_in_fails_for_pending_appointment(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $appointment = $this->createAppointment([
            'status' => Appointment::STATUS_PENDING,
        ]);

        $response = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in");

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        // Appointment remains PENDING
        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'status' => Appointment::STATUS_PENDING,
        ]);

        // No visits were created
        $this->assertEquals(0, Visit::where('appointment_id', $appointment->id)->count());
    }

    /**
     * Test check-in fails when appointment is CANCELLED.
     */
    public function test_check_in_fails_for_cancelled_appointment(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $appointment = $this->createAppointment([
            'status' => Appointment::STATUS_CANCELLED,
        ]);

        $response = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in");

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertEquals(0, Visit::where('appointment_id', $appointment->id)->count());
    }

    /**
     * Test check-in fails when appointment is NO_SHOW.
     */
    public function test_check_in_fails_for_no_show_appointment(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $appointment = $this->createAppointment([
            'status' => Appointment::STATUS_NO_SHOW,
        ]);

        $response = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in");

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertEquals(0, Visit::where('appointment_id', $appointment->id)->count());
    }

    /**
     * Test check-in fails for non-existent appointment ID.
     */
    public function test_check_in_fails_for_non_existent_appointment(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');

        $response = $this->authenticate($receptionist)
            ->postJson('/api/v1/appointments/999999/check-in');

        $response->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    /**
     * Test unauthenticated request is blocked with 401.
     */
    public function test_unauthenticated_user_cannot_check_in(): void
    {
        $appointment = $this->createAppointment([
            'status' => Appointment::STATUS_CONFIRMED,
        ]);

        $response = $this->postJson("/api/v1/appointments/{$appointment->id}/check-in");

        $response->assertStatus(401);
    }

    /**
     * Test check-in with custom visit notes and amounts.
     */
    public function test_check_in_with_custom_visit_notes_and_amounts(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $service = $this->createService(['price' => 300000]);
        $appointment = $this->createAppointment([
            'service' => $service,
            'status' => Appointment::STATUS_CONFIRMED,
        ]);

        $payload = [
            'notes' => 'Tiếp nhận quầy VIP - phòng 101',
            'quantity' => 1,
            'discount_amount' => 50000,
        ];

        $response = $this->authenticate($receptionist)
            ->postJson("/api/v1/appointments/{$appointment->id}/check-in", $payload);

        $response->assertStatus(200)
            ->assertJsonPath('data.total_amount', 250000)
            ->assertJsonPath('data.discount_amount', 50000)
            ->assertJsonPath('data.notes', 'Tiếp nhận quầy VIP - phòng 101');

        $this->assertDatabaseHas('visits', [
            'appointment_id' => $appointment->id,
            'total_amount' => 250000,
            'discount_amount' => 50000,
            'notes' => 'Tiếp nhận quầy VIP - phòng 101',
        ]);
    }

    /**
     * Test service-layer consecutive check-in calls fail and prevent double-creation.
     */
    public function test_consecutive_check_in_service_calls_prevent_double_creation(): void
    {
        $service = app(AppointmentService::class);
        $appointment = $this->createAppointment([
            'status' => Appointment::STATUS_CONFIRMED,
        ]);

        // First execution succeeds
        $visit = $service->checkInAppointment($appointment);
        $this->assertInstanceOf(Visit::class, $visit);
        $this->assertEquals($appointment->id, $visit->appointment_id);

        // Second execution throws InvalidArgumentException
        $this->expectException(InvalidArgumentException::class);
        $service->checkInAppointment($appointment);

        $this->assertEquals(1, Visit::where('appointment_id', $appointment->id)->count());
    }
}
