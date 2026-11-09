<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AppointmentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
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
     * Helper to authenticate user via Sanctum token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh Nhân Test',
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test employee (doctor).
     */
    protected function createEmployee(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác Sĩ Test',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'DOCTOR',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'SRV-'.fake()->unique()->numerify('#####'),
            'name' => 'Khám Nội Tổng Quát',
            'description' => 'Dịch vụ khám lâm sàng',
            'price' => 200000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test appointment directly in database.
     */
    protected function createAppointment(array $attributes = []): Appointment
    {
        $patient = $attributes['patient'] ?? $this->createPatient();
        $employee = $attributes['employee'] ?? $this->createEmployee();
        $service = $attributes['service'] ?? $this->createService();

        unset($attributes['patient'], $attributes['employee'], $attributes['service']);

        return Appointment::create(array_merge([
            'appointment_code' => 'APT'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-01',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => 'CONFIRMED',
            'notes' => 'Lịch hẹn thử nghiệm',
        ], $attributes));
    }

    public function test_unauthenticated_request_is_rejected_with_401(): void
    {
        $response = $this->getJson('/api/v1/appointments');

        $response->assertStatus(401);
    }

    public function test_user_without_appointments_view_permission_is_forbidden_with_403(): void
    {
        $user = $this->createUserWithPermissions(['services.view']);

        $response = $this->authenticate($user)->getJson('/api/v1/appointments');

        $response->assertStatus(403);
    }

    public function test_can_list_and_paginate_appointments(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);
        $this->createAppointment();
        $this->createAppointment();

        $response = $this->authenticate($user)->getJson('/api/v1/appointments?per_page=10');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'appointment_code',
                        'patient_id',
                        'employee_id',
                        'service_id',
                        'appointment_date',
                        'start_time',
                        'end_time',
                        'status',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'from',
                    'last_page',
                    'per_page',
                    'to',
                    'total',
                ],
            ]);
    }

    public function test_can_filter_appointments_by_date_employee_patient_and_status(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);
        $patientA = $this->createPatient(['full_name' => 'Nguyễn A']);
        $patientB = $this->createPatient(['full_name' => 'Trần B']);
        $doctorA = $this->createEmployee(['full_name' => 'Bác Sĩ A']);
        $doctorB = $this->createEmployee(['full_name' => 'Bác Sĩ B']);

        $apt1 = $this->createAppointment([
            'patient' => $patientA,
            'employee' => $doctorA,
            'appointment_date' => '2026-11-05',
            'status' => 'CONFIRMED',
        ]);
        $apt2 = $this->createAppointment([
            'patient' => $patientB,
            'employee' => $doctorB,
            'appointment_date' => '2026-11-06',
            'status' => 'COMPLETED',
        ]);

        // Filter by date
        $resDate = $this->authenticate($user)->getJson('/api/v1/appointments?appointment_date=2026-11-05');
        $resDate->assertStatus(200);
        $this->assertCount(1, $resDate->json('data'));
        $this->assertSame($apt1->id, $resDate->json('data.0.id'));

        // Filter by employee
        $resEmployee = $this->authenticate($user)->getJson('/api/v1/appointments?employee_id='.$doctorB->id);
        $resEmployee->assertStatus(200);
        $this->assertCount(1, $resEmployee->json('data'));
        $this->assertSame($apt2->id, $resEmployee->json('data.0.id'));

        // Filter by patient
        $resPatient = $this->authenticate($user)->getJson('/api/v1/appointments?patient_id='.$patientA->id);
        $resPatient->assertStatus(200);
        $this->assertCount(1, $resPatient->json('data'));
        $this->assertSame($apt1->id, $resPatient->json('data.0.id'));

        // Filter by status
        $resStatus = $this->authenticate($user)->getJson('/api/v1/appointments?status=COMPLETED');
        $resStatus->assertStatus(200);
        $this->assertCount(1, $resStatus->json('data'));
        $this->assertSame($apt2->id, $resStatus->json('data.0.id'));
    }

    public function test_can_search_appointments_by_code_and_patient_name(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);
        $patient = $this->createPatient(['full_name' => 'Đỗ Thị Lan Anh']);

        $apt = $this->createAppointment([
            'patient' => $patient,
            'appointment_code' => 'APT-SPECIAL-999',
        ]);

        $response = $this->authenticate($user)->getJson('/api/v1/appointments?search=Lan Anh');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($apt->id, $response->json('data.0.id'));

        $responseByCode = $this->authenticate($user)->getJson('/api/v1/appointments?search=SPECIAL-999');
        $responseByCode->assertStatus(200);
        $this->assertCount(1, $responseByCode->json('data'));
        $this->assertSame($apt->id, $responseByCode->json('data.0.id'));
    }

    public function test_user_without_appointments_create_permission_cannot_create_appointment(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);
        $patient = $this->createPatient();
        $employee = $this->createEmployee();
        $service = $this->createService();

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-10',
            'start_time' => '09:00',
            'end_time' => '10:00',
        ];

        $response = $this->authenticate($user)->postJson('/api/v1/appointments', $payload);

        $response->assertStatus(403);
    }

    public function test_create_appointment_successfully_with_auto_generated_code(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $employee = $this->createEmployee();
        $service = $this->createService();

        $payload = [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-10',
            'start_time' => '09:00',
            'end_time' => '09:30',
            'notes' => 'Khám tổng quát định kỳ',
        ];

        $response = $this->authenticate($user)->postJson('/api/v1/appointments', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.employee_id', $employee->id)
            ->assertJsonPath('data.service_id', $service->id)
            ->assertJsonPath('data.appointment_date', '2026-11-10')
            ->assertJsonPath('data.status', 'CONFIRMED');

        $appointmentCode = $response->json('data.appointment_code');
        $this->assertNotNull($appointmentCode);
        $this->assertStringStartsWith('APT', $appointmentCode);

        $this->assertDatabaseHas('appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'appointment_code' => $appointmentCode,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'appointments',
            'action' => 'create',
            'table_name' => 'appointments',
        ]);
    }

    /**
     * Acceptance Criteria 1:
     * Prevent overlapping time-slot booking for the same employee on the same date (409 or 422).
     */
    public function test_prevent_overlapping_appointment_for_same_employee_on_same_date(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $doctor = $this->createEmployee();
        $service = $this->createService();

        // Baseline appointment: 09:00:00 -> 10:00:00 on 2026-11-15
        $this->createAppointment([
            'patient' => $patient,
            'employee' => $doctor,
            'service' => $service,
            'appointment_date' => '2026-11-15',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => 'CONFIRMED',
        ]);

        // Attempt 1: Partial overlap right (09:30 -> 10:30)
        $resRight = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-15',
            'start_time' => '09:30:00',
            'end_time' => '10:30:00',
        ]);
        $this->assertTrue(in_array($resRight->status(), [409, 422], true));
        $resRight->assertJsonPath('success', false);

        // Attempt 2: Partial overlap left (08:30 -> 09:30)
        $resLeft = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-15',
            'start_time' => '08:30:00',
            'end_time' => '09:30:00',
        ]);
        $this->assertTrue(in_array($resLeft->status(), [409, 422], true));
        $resLeft->assertJsonPath('success', false);

        // Attempt 3: Inside slot (09:15 -> 09:45)
        $resInside = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-15',
            'start_time' => '09:15:00',
            'end_time' => '09:45:00',
        ]);
        $this->assertTrue(in_array($resInside->status(), [409, 422], true));
        $resInside->assertJsonPath('success', false);

        // Attempt 4: Enclosing slot (08:30 -> 10:30)
        $resEnclose = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-15',
            'start_time' => '08:30:00',
            'end_time' => '10:30:00',
        ]);
        $this->assertTrue(in_array($resEnclose->status(), [409, 422], true));
        $resEnclose->assertJsonPath('success', false);

        // Attempt 5: Exact same slot (09:00 -> 10:00)
        $resExact = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-15',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);
        $this->assertTrue(in_array($resExact->status(), [409, 422], true));
        $resExact->assertJsonPath('success', false);
    }

    public function test_adjacent_non_overlapping_slots_are_allowed_for_same_employee(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $doctor = $this->createEmployee();
        $service = $this->createService();

        // Baseline: 09:00:00 -> 10:00:00 on 2026-11-16
        $this->createAppointment([
            'patient' => $patient,
            'employee' => $doctor,
            'service' => $service,
            'appointment_date' => '2026-11-16',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);

        // Prior contiguous slot: 08:00:00 -> 09:00:00 (end_time == existing start_time)
        $resPrior = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-16',
            'start_time' => '08:00:00',
            'end_time' => '09:00:00',
        ]);
        $resPrior->assertStatus(201);

        // Posterior contiguous slot: 10:00:00 -> 11:00:00 (start_time == existing end_time)
        $resPost = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-16',
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
        ]);
        $resPost->assertStatus(201);
    }

    public function test_overlapping_slot_allowed_for_different_employee_or_different_date(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $doctorA = $this->createEmployee();
        $doctorB = $this->createEmployee();
        $service = $this->createService();

        // Doctor A has appointment on 2026-11-17 from 09:00 to 10:00
        $this->createAppointment([
            'patient' => $patient,
            'employee' => $doctorA,
            'service' => $service,
            'appointment_date' => '2026-11-17',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);

        // Same slot for Doctor B on same date -> ALLOWED (201)
        $resDoctorB = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorB->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-17',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);
        $resDoctorB->assertStatus(201);

        // Same slot for Doctor A on next day (2026-11-18) -> ALLOWED (201)
        $resNextDay = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorA->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-18',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);
        $resNextDay->assertStatus(201);
    }

    /**
     * Acceptance Criteria 2:
     * Cancelled appointment (status = CANCELLED) releases the slot and allows new booking.
     */
    public function test_cancelled_appointment_does_not_block_new_booking_in_same_slot(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $doctor = $this->createEmployee();
        $service = $this->createService();

        // Appointment in CANCELLED status in slot 14:00 -> 15:00
        $this->createAppointment([
            'patient' => $patient,
            'employee' => $doctor,
            'service' => $service,
            'appointment_date' => '2026-11-20',
            'start_time' => '14:00:00',
            'end_time' => '15:00:00',
            'status' => 'CANCELLED',
        ]);

        // New appointment for same doctor in the exact same slot -> MUST SUCCEED (201)
        $response = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-20',
            'start_time' => '14:00:00',
            'end_time' => '15:00:00',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'CONFIRMED');
    }

    public function test_cannot_create_appointment_with_inactive_service(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $doctor = $this->createEmployee();
        $inactiveService = $this->createService(['status' => 'INACTIVE']);

        $response = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $inactiveService->id,
            'appointment_date' => '2026-11-21',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_cannot_create_appointment_when_end_time_is_not_after_start_time(): void
    {
        $user = $this->createUserWithPermissions(['appointments.create']);
        $patient = $this->createPatient();
        $doctor = $this->createEmployee();
        $service = $this->createService();

        // end_time earlier than start_time
        $resEarlier = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-22',
            'start_time' => '10:00:00',
            'end_time' => '09:00:00',
        ]);
        $resEarlier->assertStatus(422);

        // end_time equals start_time
        $resEqual = $this->authenticate($user)->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-11-22',
            'start_time' => '10:00:00',
            'end_time' => '10:00:00',
        ]);
        $resEqual->assertStatus(422);
    }

    public function test_show_appointment_returns_details_and_relation_data(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);
        $apt = $this->createAppointment();

        $response = $this->authenticate($user)->getJson('/api/v1/appointments/'.$apt->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $apt->id)
            ->assertJsonPath('data.patient.id', $apt->patient_id)
            ->assertJsonPath('data.employee.id', $apt->employee_id)
            ->assertJsonPath('data.service.id', $apt->service_id);

        $responseNotFound = $this->authenticate($user)->getJson('/api/v1/appointments/999999');
        $responseNotFound->assertStatus(404);
    }

    public function test_update_appointment_reschedule_successfully(): void
    {
        $user = $this->createUserWithPermissions(['appointments.update']);
        $apt = $this->createAppointment([
            'appointment_date' => '2026-11-25',
            'start_time' => '08:00:00',
            'end_time' => '09:00:00',
        ]);

        $response = $this->authenticate($user)->putJson('/api/v1/appointments/'.$apt->id, [
            'appointment_date' => '2026-11-26',
            'start_time' => '13:00:00',
            'end_time' => '14:00:00',
            'notes' => 'Dời lịch sang buổi chiều',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.appointment_date', '2026-11-26')
            ->assertJsonPath('data.start_time', '13:00:00')
            ->assertJsonPath('data.end_time', '14:00:00')
            ->assertJsonPath('data.notes', 'Dời lịch sang buổi chiều');
    }

    public function test_rescheduling_to_an_overlapping_slot_is_rejected_with_409(): void
    {
        $user = $this->createUserWithPermissions(['appointments.update']);
        $doctor = $this->createEmployee();

        // Appointment 1: 09:00 -> 10:00 on 2026-11-27
        $this->createAppointment([
            'employee' => $doctor,
            'appointment_date' => '2026-11-27',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'status' => 'CONFIRMED',
        ]);

        // Appointment 2: 11:00 -> 12:00 on 2026-11-27
        $apt2 = $this->createAppointment([
            'employee' => $doctor,
            'appointment_date' => '2026-11-27',
            'start_time' => '11:00:00',
            'end_time' => '12:00:00',
            'status' => 'CONFIRMED',
        ]);

        // Try to reschedule Appointment 2 into overlapping slot 09:30 -> 10:30
        $response = $this->authenticate($user)->putJson('/api/v1/appointments/'.$apt2->id, [
            'start_time' => '09:30:00',
            'end_time' => '10:30:00',
        ]);

        $this->assertTrue(in_array($response->status(), [409, 422], true));
        $response->assertJsonPath('success', false);
    }

    public function test_updating_appointment_without_changing_slot_does_not_conflict_with_itself(): void
    {
        $user = $this->createUserWithPermissions(['appointments.update']);
        $apt = $this->createAppointment([
            'appointment_date' => '2026-11-28',
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
        ]);

        $response = $this->authenticate($user)->putJson('/api/v1/appointments/'.$apt->id, [
            'notes' => 'Cập nhật ghi chú mới mà không đổi giờ',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.notes', 'Cập nhật ghi chú mới mà không đổi giờ');
    }

    public function test_cancel_appointment_endpoint(): void
    {
        $user = $this->createUserWithPermissions(['appointments.cancel']);
        $apt = $this->createAppointment([
            'status' => 'CONFIRMED',
        ]);

        $response = $this->authenticate($user)->postJson('/api/v1/appointments/'.$apt->id.'/cancel', [
            'reason' => 'Bệnh nhân bận công tác đột xuất',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'CANCELLED');

        $this->assertDatabaseHas('appointments', [
            'id' => $apt->id,
            'status' => 'CANCELLED',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'appointments',
            'action' => 'cancel',
            'table_name' => 'appointments',
            'record_id' => (string) $apt->id,
        ]);
    }

    public function test_update_appointment_status_endpoint(): void
    {
        $user = $this->createUserWithPermissions(['appointments.update']);
        $apt = $this->createAppointment([
            'status' => 'PENDING',
        ]);

        $response = $this->authenticate($user)->patchJson('/api/v1/appointments/'.$apt->id.'/status', [
            'status' => 'CONFIRMED',
            'notes' => 'Đã gọi điện xác nhận lịch hẹn',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'CONFIRMED');

        $this->assertDatabaseHas('appointments', [
            'id' => $apt->id,
            'status' => 'CONFIRMED',
        ]);
    }

    public function test_cannot_delete_appointment_with_associated_visits(): void
    {
        $user = $this->createUserWithPermissions(['appointments.cancel', 'appointments.update']);
        $patient = $this->createPatient();
        $employee = $this->createEmployee();
        $service = $this->createService();

        $apt = $this->createAppointment([
            'patient' => $patient,
            'employee' => $employee,
            'service' => $service,
        ]);

        // Create visit associated with this appointment
        Visit::create([
            'visit_code' => 'VST-'.fake()->unique()->numerify('#####'),
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'appointment_id' => $apt->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_status' => 'UNPAID',
            'status' => 'IN_PROGRESS',
        ]);

        $response = $this->authenticate($user)->deleteJson('/api/v1/appointments/'.$apt->id);

        $response->assertStatus(400)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Không thể xóa lịch hẹn đã phát sinh lượt khám.');
    }

    public function test_can_delete_appointment_without_associated_visits(): void
    {
        $user = $this->createUserWithPermissions(['appointments.cancel', 'appointments.update']);
        $apt = $this->createAppointment();

        $response = $this->authenticate($user)->deleteJson('/api/v1/appointments/'.$apt->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Xóa lịch hẹn thành công.');

        $this->assertDatabaseMissing('appointments', [
            'id' => $apt->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'appointments',
            'action' => 'delete',
            'table_name' => 'appointments',
            'record_id' => (string) $apt->id,
        ]);
    }
}
