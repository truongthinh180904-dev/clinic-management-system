<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\PackageService;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Phase1EndToEndWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create a user with a specific standard role.
     *
     * @param  array<string, mixed>  $employeeAttrs
     */
    protected function createUserWithRole(string $roleName, string $status = 'ACTIVE', array $employeeAttrs = []): User
    {
        $employee = Employee::create(array_merge([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $employeeAttrs));

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
     * Helper to authenticate user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    // =========================================================================
    // WORKFLOW FLOW 1: Nhân sự & Phân quyền (HR & RBAC Lifecycle)
    // =========================================================================

    public function test_flow_1_hr_and_rbac_lifecycle(): void
    {
        // Step 1: Admin logs in
        $admin = $this->createUserWithRole('ADMIN');
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'username' => $admin->username,
            'password' => 'Secret@123',
        ]);
        $loginRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $adminToken = $loginRes->json('data.token');
        $this->assertNotEmpty($adminToken);

        // Step 2: Admin creates a new Employee
        $createEmpRes = $this->withHeader('Authorization', 'Bearer '.$adminToken)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'NV90001',
                'full_name' => 'Lê Thị Thu Ngân',
                'phone' => '0981999888',
                'email' => 'thungan_flow1@clinic.local',
                'gender' => 'FEMALE',
                'position' => 'CASHIER',
                'department' => 'Phòng Thu Ngân',
                'status' => 'ACTIVE',
            ]);
        $createEmpRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.employee_code', 'NV90001');
        $employeeId = $createEmpRes->json('data.id');

        // Step 3: Admin creates a User linked to that Employee
        $createUserRes = $this->withHeader('Authorization', 'Bearer '.$adminToken)
            ->postJson('/api/v1/users', [
                'employee_id' => $employeeId,
                'username' => 'cashier_flow1',
                'email' => 'thungan_flow1@clinic.local',
                'password' => 'CashierPass@2026',
                'status' => 'ACTIVE',
                'role_names' => ['CASHIER'],
            ]);
        $createUserRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.username', 'cashier_flow1');
        $userId = $createUserRes->json('data.id');

        // Step 4: Admin updates User Roles to RECEPTIONIST
        $updateRolesRes = $this->withHeader('Authorization', 'Bearer '.$adminToken)
            ->putJson("/api/v1/users/{$userId}/roles", [
                'role_names' => ['RECEPTIONIST'],
            ]);
        $updateRolesRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // Step 5: New user logs in with their credentials
        $userLoginRes = $this->postJson('/api/v1/auth/login', [
            'username' => 'cashier_flow1',
            'password' => 'CashierPass@2026',
        ]);
        $userLoginRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $userToken = $userLoginRes->json('data.token');
        $this->assertNotEmpty($userToken);

        // Step 6: Query /auth/me to verify profile, roles, permissions and absence of password_hash
        $meRes = $this->withHeader('Authorization', 'Bearer '.$userToken)
            ->getJson('/api/v1/auth/me');
        $meRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.username', 'cashier_flow1')
            ->assertJsonPath('data.roles.0.name', 'RECEPTIONIST');
        $this->assertNull($meRes->json('data.password_hash'));
        $this->assertArrayNotHasKey('password_hash', $meRes->json('data'));

        // Step 7: Check RBAC enforcement
        // As RECEPTIONIST, creating an employee must be rejected (403 Forbidden)
        $forbiddenRes = $this->withHeader('Authorization', 'Bearer '.$userToken)
            ->postJson('/api/v1/employees', [
                'full_name' => 'Nhân Viên Không Được Phép',
                'phone' => '0912000111',
            ]);
        $forbiddenRes->assertStatus(403);

        // As RECEPTIONIST, accessing patients list must succeed (200 OK)
        $allowedRes = $this->withHeader('Authorization', 'Bearer '.$userToken)
            ->getJson('/api/v1/patients');
        $allowedRes->assertStatus(200);

        // Step 8: User logs out and revokes session
        $logoutRes = $this->withHeader('Authorization', 'Bearer '.$userToken)
            ->postJson('/api/v1/auth/logout');
        $logoutRes->assertStatus(200);

        // Subsequent authenticated call with revoked token must return 401 Unauthorized
        $unauthRes = $this->withHeader('Authorization', 'Bearer '.$userToken)
            ->getJson('/api/v1/auth/me');
        $unauthRes->assertStatus(401);
    }

    // =========================================================================
    // WORKFLOW FLOW 2: Bệnh nhân & Cảnh báo trùng (Patients & Duplicates)
    // =========================================================================

    public function test_flow_2_patient_registration_and_duplicate_warning(): void
    {
        $receptionist = $this->createUserWithRole('RECEPTIONIST');
        $this->authenticate($receptionist);

        $patientPhone = '0977665544';

        // Step 1: Pre-check duplicate before creating (no duplicates expected)
        $preCheckRes = $this->postJson('/api/v1/patients/check-duplicates', [
            'full_name' => 'Nguyễn Minh Tuấn',
            'phone' => $patientPhone,
        ]);
        $preCheckRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.has_duplicates', false);

        // Step 2: Create new patient
        $createPatientRes = $this->postJson('/api/v1/patients', [
            'full_name' => 'Nguyễn Minh Tuấn',
            'date_of_birth' => '1992-04-12',
            'gender' => 'MALE',
            'phone' => $patientPhone,
            'email' => 'tuan.nguyen@example.local',
            'address' => '789 Đường Hai Bà Trưng, Quận 3, TP.HCM',
            'status' => 'ACTIVE',
        ]);
        $createPatientRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.full_name', 'Nguyễn Minh Tuấn')
            ->assertJsonPath('data.phone', $patientPhone);

        $patientId = $createPatientRes->json('data.id');
        $patientCode = $createPatientRes->json('data.patient_code');
        $this->assertNotEmpty($patientCode);
        $this->assertStringStartsWith('BN', $patientCode);

        // Step 3: Check duplicate again with same phone (duplicate warning expected)
        $dupCheckRes = $this->postJson('/api/v1/patients/check-duplicates', [
            'full_name' => 'Nguyễn Minh Tuấn (Trùng SĐT)',
            'phone' => $patientPhone,
        ]);
        $dupCheckRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.has_duplicates', true);

        // Step 4: Update patient profile with emergency contact and notes
        $updateRes = $this->putJson("/api/v1/patients/{$patientId}", [
            'full_name' => 'Nguyễn Minh Tuấn',
            'phone' => $patientPhone,
            'emergency_contact_name' => 'Nguyễn Văn Thân Nhân',
            'emergency_contact_phone' => '0909112233',
            'notes' => 'Bệnh nhân có tiền sử mẫn cảm với Paracetamol',
        ]);
        $updateRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.emergency_contact_name', 'Nguyễn Văn Thân Nhân')
            ->assertJsonPath('data.emergency_contact_phone', '0909112233');

        // Step 5: Search patient by name and code
        $searchRes = $this->getJson('/api/v1/patients?search=Minh+Tuấn');
        $searchRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertGreaterThanOrEqual(1, count($searchRes->json('data')));

        // Step 6: View patient details
        $showRes = $this->getJson("/api/v1/patients/{$patientId}");
        $showRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $patientId)
            ->assertJsonPath('data.patient_code', $patientCode)
            ->assertJsonPath('data.notes', 'Bệnh nhân có tiền sử mẫn cảm với Paracetamol');
    }

    // =========================================================================
    // WORKFLOW FLOW 3: Dịch vụ & Cấp gói (Service Catalog & Package Assignment)
    // =========================================================================

    public function test_flow_3_service_catalog_and_package_assignment(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        // Step 1: Create Service 1
        $service1Res = $this->postJson('/api/v1/services', [
            'service_code' => 'SRV-CARDIO-001',
            'name' => 'Khám Chuyên Khoa Tim Mạch',
            'description' => 'Khám và tư vấn chuyên sâu về tim mạch',
            'price' => 300000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);
        $service1Res->assertStatus(201)
            ->assertJsonPath('success', true);
        $service1Id = $service1Res->json('data.id');

        // Step 2: Create Service 2
        $service2Res = $this->postJson('/api/v1/services', [
            'service_code' => 'SRV-ECG-002',
            'name' => 'Điện Tâm Đồ Kỹ Thuật Số ECG',
            'description' => 'Đo và phân tích điện tâm đồ 12 đạo trình',
            'price' => 200000.00,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);
        $service2Res->assertStatus(201)
            ->assertJsonPath('success', true);
        $service2Id = $service2Res->json('data.id');

        // Step 3: Create Service Package
        $packageRes = $this->postJson('/api/v1/service-packages', [
            'package_code' => 'PKG-CARDIO-CARE',
            'name' => 'Gói Tầm Soát & Chăm Sóc Tim Mạch 4 Buổi',
            'description' => 'Bao gồm 2 lượt khám tim mạch và 2 lượt đo ECG',
            'price' => 900000.00,
            'total_sessions' => 4,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);
        $packageRes->assertStatus(201)
            ->assertJsonPath('success', true);
        $packageId = $packageRes->json('data.id');

        // Step 4: Link services into package via package_services
        $linkSrv1Res = $this->postJson("/api/v1/service-packages/{$packageId}/services", [
            'service_id' => $service1Id,
            'quantity' => 2,
        ]);
        $linkSrv1Res->assertStatus(201)
            ->assertJsonPath('success', true);

        $linkSrv2Res = $this->postJson("/api/v1/service-packages/{$packageId}/services", [
            'service_id' => $service2Id,
            'quantity' => 2,
        ]);
        $linkSrv2Res->assertStatus(201)
            ->assertJsonPath('success', true);

        // Step 5: Assign package to a patient
        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Đỗ Văn Bệnh Nhân Gói',
            'phone' => '0988001122',
            'status' => 'ACTIVE',
        ]);

        $assignRes = $this->postJson("/api/v1/patients/{$patient->id}/packages", [
            'package_id' => $packageId,
            'price' => 900000.00,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'total_sessions' => 4,
            'status' => 'ACTIVE',
        ]);
        $assignRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_sessions', 4)
            ->assertJsonPath('data.used_sessions', 0)
            ->assertJsonPath('data.remaining_sessions', 4)
            ->assertJsonPath('data.status', 'ACTIVE');

        $patientPackageId = $assignRes->json('data.id');

        // Step 6: Query patient's packages list
        $patientPkgsRes = $this->getJson("/api/v1/patients/{$patient->id}/packages");
        $patientPkgsRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertCount(1, $patientPkgsRes->json('data'));
        $this->assertSame($patientPackageId, $patientPkgsRes->json('data.0.id'));

        // Step 7: Query single patient package detail
        $singlePkgRes = $this->getJson("/api/v1/patient-packages/{$patientPackageId}");
        $singlePkgRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $patientPackageId)
            ->assertJsonPath('data.remaining_sessions', 4);
    }

    // =========================================================================
    // WORKFLOW FLOW 4: Đặt lịch hẹn, Khám trừ buổi gói & Bảo mật bệnh án
    // =========================================================================

    public function test_flow_4_appointment_overlap_visit_deduction_and_medical_records(): void
    {
        // 1. Roles & Actors setup
        $doctorUser = $this->createUserWithRole('DOCTOR', 'ACTIVE', [
            'full_name' => 'BS. Nguyễn Văn Chuyên Khoa',
            'position' => 'DOCTOR',
            'department' => 'Khoa Nội Tim Mạch',
        ]);
        $doctorEmployee = $doctorUser->employee;

        $receptionistUser = $this->createUserWithRole('RECEPTIONIST', 'ACTIVE', [
            'full_name' => 'NV. Trần Thị Lễ Tân',
            'position' => 'RECEPTIONIST',
            'department' => 'Phòng Tiếp Đón',
        ]);

        // 2. Data catalog & patient setup
        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh Nhân Khám Trọn Vẹn',
            'phone' => '0933112233',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'SRV-FLOW4-001',
            'name' => 'Khám Tim Mạch & Điện Tâm Đồ',
            'price' => 250000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $servicePackage = ServicePackage::create([
            'package_code' => 'PKG-FLOW4-001',
            'name' => 'Gói Trị Liệu Tim Mạch 3 Buổi',
            'price' => 700000.00,
            'total_sessions' => 3,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        // Connect service to package
        PackageService::create([
            'package_id' => $servicePackage->id,
            'service_id' => $service->id,
            'quantity' => 3,
        ]);

        // Patient acquires package with 3 sessions
        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $servicePackage->id,
            'purchase_date' => now()->toDateString(),
            'expiry_date' => now()->addDays(90)->toDateString(),
            'price' => 700000.00,
            'total_sessions' => 3,
            'used_sessions' => 0,
            'remaining_sessions' => 3,
            'status' => 'ACTIVE',
        ]);

        // ---------------------------------------------------------------------
        // Step A: Receptionist books Appointment 1
        // ---------------------------------------------------------------------
        $this->authenticate($receptionistUser);
        $appointmentDate = now()->addDays(3)->format('Y-m-d');

        $apt1Res = $this->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'appointment_date' => $appointmentDate,
            'start_time' => '09:00:00',
            'end_time' => '10:00:00',
            'notes' => 'Khám tim mạch theo hẹn trước',
        ]);
        $apt1Res->assertStatus(201)
            ->assertJsonPath('success', true);
        $appointmentId = $apt1Res->json('data.id');

        // ---------------------------------------------------------------------
        // Step B: Receptionist attempts to book conflicting Appointment 2 (Overlap!)
        // ---------------------------------------------------------------------
        $aptOverlapRes = $this->postJson('/api/v1/appointments', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'appointment_date' => $appointmentDate,
            'start_time' => '09:30:00',
            'end_time' => '10:30:00',
        ]);
        $this->assertTrue(in_array($aptOverlapRes->status(), [409, 422], true));
        $aptOverlapRes->assertJsonPath('success', false);

        // ---------------------------------------------------------------------
        // Step C: Receptionist confirms Appointment 1
        // ---------------------------------------------------------------------
        $confirmAptRes = $this->patchJson("/api/v1/appointments/{$appointmentId}/status", [
            'status' => 'CONFIRMED',
        ]);
        $confirmAptRes->assertStatus(200)
            ->assertJsonPath('data.status', 'CONFIRMED');

        // ---------------------------------------------------------------------
        // Step D: Receptionist creates Visit deducting 1 session from Patient Package
        // ---------------------------------------------------------------------
        $visitRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'appointment_id' => $appointmentId,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->format('Y-m-d H:i:s'),
            'quantity' => 1,
            'status' => 'SCHEDULED',
            'payment_status' => 'PAID',
            'notes' => 'Buổi 1 theo gói tim mạch',
        ]);
        $visitRes->assertStatus(201)
            ->assertJsonPath('success', true);
        $visitId = $visitRes->json('data.id');

        // Verify package deduction invariant: used=1, remaining=2, status=ACTIVE
        $patientPackage->refresh();
        $this->assertSame(1, (int) $patientPackage->used_sessions);
        $this->assertSame(2, (int) $patientPackage->remaining_sessions);
        $this->assertSame('ACTIVE', $patientPackage->status);

        // Verify patient visit dates updated
        $patient->refresh();
        $this->assertNotNull($patient->first_visit_date);
        $this->assertNotNull($patient->last_visit_date);

        // ---------------------------------------------------------------------
        // Step E: Doctor examines patient and enters Medical Record
        // ---------------------------------------------------------------------
        $this->authenticate($doctorUser);

        // Doctor updates visit status to IN_PROGRESS
        $this->patchJson("/api/v1/visits/{$visitId}/status", [
            'status' => 'IN_PROGRESS',
        ])->assertStatus(200);

        // Doctor creates Medical Record
        $medRecRes = $this->postJson("/api/v1/visits/{$visitId}/medical-record", [
            'doctor_id' => $doctorEmployee->id,
            'diagnosis' => 'Rối loạn nhịp xoang nhẹ, theo dõi tim thiếu máu cục bộ',
            'medical_history' => 'Tiền sử tăng huyết áp nhẹ 1 năm, không dị ứng',
            'indication' => 'Đo ECG 12 cần, xét nghiệm men tim cơ bản',
            'treatment' => 'Nghỉ ngơi điều độ, giảm caffeine, uống thuốc theo đơn',
            'follow_up_date' => now()->addDays(14)->toDateString(),
        ]);
        $medRecRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.diagnosis', 'Rối loạn nhịp xoang nhẹ, theo dõi tim thiếu máu cục bộ');

        // Doctor can view Medical Record
        $doctorMedViewRes = $this->getJson("/api/v1/visits/{$visitId}/medical-record");
        $doctorMedViewRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.diagnosis', 'Rối loạn nhịp xoang nhẹ, theo dõi tim thiếu máu cục bộ');

        // Doctor views Visit details and sees Medical Record attached
        $doctorVisitShowRes = $this->getJson("/api/v1/visits/{$visitId}");
        $doctorVisitShowRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertNotNull($doctorVisitShowRes->json('data.medical_record'));

        // ---------------------------------------------------------------------
        // Step F: Medical Privacy Enforcement for Receptionist
        // ---------------------------------------------------------------------
        $this->authenticate($receptionistUser);

        // Receptionist accessing medical record API is blocked (403 Forbidden)
        $recMedViewRes = $this->getJson("/api/v1/visits/{$visitId}/medical-record");
        $recMedViewRes->assertStatus(403);

        // Receptionist viewing visit detail has medical_record field masked/null
        $recVisitShowRes = $this->getJson("/api/v1/visits/{$visitId}");
        $recVisitShowRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertNull($recVisitShowRes->json('data.medical_record'));

        // ---------------------------------------------------------------------
        // Step G: Complete package sessions consumption and transition to COMPLETED
        // ---------------------------------------------------------------------
        // Deduct remaining 2 sessions in a second visit
        $visit2Res = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDays(1)->format('Y-m-d H:i:s'),
            'quantity' => 2,
            'status' => 'SCHEDULED',
            'payment_status' => 'PAID',
            'notes' => 'Buổi 2 và 3 hoàn tất liệu trình',
        ]);
        $visit2Res->assertStatus(201);

        $patientPackage->refresh();
        $this->assertSame(3, (int) $patientPackage->used_sessions);
        $this->assertSame(0, (int) $patientPackage->remaining_sessions);
        $this->assertSame('COMPLETED', $patientPackage->status);

        // Attempting another visit with exhausted package must be rejected (422)
        $visitFailRes = $this->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'quantity' => 1,
            'status' => 'SCHEDULED',
        ]);
        $visitFailRes->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    // =========================================================================
    // MASTER JOURNEY: Liên hoàn 4 luồng nghiệp vụ trên cùng chuỗi tương tác
    // =========================================================================

    public function test_end_to_end_complete_master_journey(): void
    {
        // 1. Admin login & onboard staff
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        // Create Doctor Employee & User
        $docEmpRes = $this->postJson('/api/v1/employees', [
            'employee_code' => 'NV-MASTER-DOC',
            'full_name' => 'BS. Hoàng Văn Điều Trị',
            'phone' => '0911556677',
            'email' => 'doc_master@clinic.local',
            'position' => 'DOCTOR',
            'department' => 'Khoa Khám Bệnh',
            'status' => 'ACTIVE',
        ]);
        $docEmpRes->assertStatus(201);
        $docEmpId = $docEmpRes->json('data.id');

        $docUserRes = $this->postJson('/api/v1/users', [
            'employee_id' => $docEmpId,
            'username' => 'doc_master',
            'email' => 'doc_master@clinic.local',
            'password' => 'DocPass@2026',
            'status' => 'ACTIVE',
            'role_names' => ['DOCTOR'],
        ]);
        $docUserRes->assertStatus(201);

        // Create Receptionist Employee & User
        $recEmpRes = $this->postJson('/api/v1/employees', [
            'employee_code' => 'NV-MASTER-REC',
            'full_name' => 'NV. Mai Thị Tiếp Nhận',
            'phone' => '0922556677',
            'email' => 'rec_master@clinic.local',
            'position' => 'RECEPTIONIST',
            'department' => 'Bộ Phận Lễ Tân',
            'status' => 'ACTIVE',
        ]);
        $recEmpRes->assertStatus(201);
        $recEmpId = $recEmpRes->json('data.id');

        $recUserRes = $this->postJson('/api/v1/users', [
            'employee_id' => $recEmpId,
            'username' => 'rec_master',
            'email' => 'rec_master@clinic.local',
            'password' => 'RecPass@2026',
            'status' => 'ACTIVE',
            'role_names' => ['RECEPTIONIST'],
        ]);
        $recUserRes->assertStatus(201);

        // 2. Configure Service Catalog & Package
        $serviceRes = $this->postJson('/api/v1/services', [
            'service_code' => 'SRV-MASTER-GEN',
            'name' => 'Khám Nội Tổng Quát Toàn Diện',
            'price' => 300000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);
        $serviceRes->assertStatus(201);
        $serviceId = $serviceRes->json('data.id');

        $packageRes = $this->postJson('/api/v1/service-packages', [
            'package_code' => 'PKG-MASTER-CARE',
            'name' => 'Gói Chăm Sóc Sức Khỏe Gia Đình 2 Buổi',
            'price' => 500000.00,
            'total_sessions' => 2,
            'validity_days' => 120,
            'status' => 'ACTIVE',
        ]);
        $packageRes->assertStatus(201);
        $packageId = $packageRes->json('data.id');

        $linkRes = $this->postJson("/api/v1/service-packages/{$packageId}/services", [
            'service_id' => $serviceId,
            'quantity' => 2,
        ]);
        $linkRes->assertStatus(201);

        // 3. Receptionist logs in, checks duplicates & registers patient
        $recLoginRes = $this->postJson('/api/v1/auth/login', [
            'username' => 'rec_master',
            'password' => 'RecPass@2026',
        ]);
        $recLoginRes->assertStatus(200);
        $recToken = $recLoginRes->json('data.token');

        $dupRes = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson('/api/v1/patients/check-duplicates', [
                'full_name' => 'Đặng Thùy Dương',
                'phone' => '0944778899',
            ]);
        $dupRes->assertStatus(200)
            ->assertJsonPath('data.has_duplicates', false);

        $patientRes = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson('/api/v1/patients', [
                'full_name' => 'Đặng Thùy Dương',
                'date_of_birth' => '1995-10-20',
                'gender' => 'FEMALE',
                'phone' => '0944778899',
                'address' => 'Số 10 Đường Đồng Khởi, Quận 1',
                'status' => 'ACTIVE',
            ]);
        $patientRes->assertStatus(201);
        $patientId = $patientRes->json('data.id');

        // 4. Receptionist assigns Package to Patient
        $assignRes = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson("/api/v1/patients/{$patientId}/packages", [
                'package_id' => $packageId,
                'price' => 500000.00,
                'purchase_date' => now()->toDateString(),
                'expiry_date' => now()->addDays(120)->toDateString(),
                'total_sessions' => 2,
                'status' => 'ACTIVE',
            ]);
        $assignRes->assertStatus(201);
        $patientPackageId = $assignRes->json('data.id');

        // 5. Receptionist schedules appointment and tests overlap protection
        $aptDate = now()->addDays(2)->format('Y-m-d');
        $aptOk = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson('/api/v1/appointments', [
                'patient_id' => $patientId,
                'employee_id' => $docEmpId,
                'service_id' => $serviceId,
                'appointment_date' => $aptDate,
                'start_time' => '14:00:00',
                'end_time' => '15:00:00',
                'status' => 'CONFIRMED',
            ]);
        $aptOk->assertStatus(201);
        $aptId = $aptOk->json('data.id');

        // Booking same doctor overlapping slot fails
        $aptConflict = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson('/api/v1/appointments', [
                'patient_id' => $patientId,
                'employee_id' => $docEmpId,
                'service_id' => $serviceId,
                'appointment_date' => $aptDate,
                'start_time' => '14:30:00',
                'end_time' => '15:30:00',
            ]);
        $this->assertTrue(in_array($aptConflict->status(), [409, 422], true));

        // 6. Receptionist converts appointment to Visit with package session
        $visitRes = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patientId,
                'employee_id' => $docEmpId,
                'service_id' => $serviceId,
                'appointment_id' => $aptId,
                'patient_package_id' => $patientPackageId,
                'visit_date' => now()->format('Y-m-d H:i:s'),
                'quantity' => 1,
                'status' => 'SCHEDULED',
            ]);
        $visitRes->assertStatus(201);
        $visitId = $visitRes->json('data.id');

        // Package sessions updated: remaining=1
        $patPkg = PatientPackage::findOrFail($patientPackageId);
        $this->assertSame(1, (int) $patPkg->used_sessions);
        $this->assertSame(1, (int) $patPkg->remaining_sessions);

        // 7. Doctor examines, transitions visit & creates Medical Record
        $docLoginRes = $this->postJson('/api/v1/auth/login', [
            'username' => 'doc_master',
            'password' => 'DocPass@2026',
        ]);
        $docLoginRes->assertStatus(200);
        $docToken = $docLoginRes->json('data.token');

        $this->withHeader('Authorization', 'Bearer '.$docToken)
            ->patchJson("/api/v1/visits/{$visitId}/status", ['status' => 'IN_PROGRESS'])
            ->assertStatus(200);

        $medRes = $this->withHeader('Authorization', 'Bearer '.$docToken)
            ->postJson("/api/v1/visits/{$visitId}/medical-record", [
                'doctor_id' => $docEmpId,
                'diagnosis' => 'Viêm họng cấp tính do thay đổi thời tiết',
                'treatment' => 'Súc họng nước muối, kháng viêm nhẹ trong 5 ngày',
            ]);
        $medRes->assertStatus(201)
            ->assertJsonPath('data.diagnosis', 'Viêm họng cấp tính do thay đổi thời tiết');

        // Doctor completes visit
        $this->withHeader('Authorization', 'Bearer '.$docToken)
            ->patchJson("/api/v1/visits/{$visitId}/status", ['status' => 'COMPLETED'])
            ->assertStatus(200);

        // 8. Privacy check: Receptionist cannot access medical record
        $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->getJson("/api/v1/visits/{$visitId}/medical-record")
            ->assertStatus(403);

        $maskedVisitRes = $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->getJson("/api/v1/visits/{$visitId}");
        $maskedVisitRes->assertStatus(200);
        $this->assertNull($maskedVisitRes->json('data.medical_record'));

        // 9. Consume the second (last) session of package
        $this->withHeader('Authorization', 'Bearer '.$recToken)
            ->postJson('/api/v1/visits', [
                'patient_id' => $patientId,
                'employee_id' => $docEmpId,
                'service_id' => $serviceId,
                'patient_package_id' => $patientPackageId,
                'visit_date' => now()->addDays(5)->format('Y-m-d H:i:s'),
                'quantity' => 1,
                'status' => 'SCHEDULED',
            ])->assertStatus(201);

        $patPkg->refresh();
        $this->assertSame(2, (int) $patPkg->used_sessions);
        $this->assertSame(0, (int) $patPkg->remaining_sessions);
        $this->assertSame('COMPLETED', $patPkg->status);
    }
}
