<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EndToEndPhase3WorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
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
            'position' => 'Nhân viên chuyên trách',
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
     * Helper to authenticate user via Sanctum personal access token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withToken($token);
    }

    /**
     * Comprehensive End-to-End Workflow Test:
     * Đặt lịch -> Tiếp đón (Check-in) -> Khám chuyên môn -> Đính kèm tệp y tế ->
     * Kê đơn / Trừ kho -> Lập hóa đơn -> Thu tiền nhiều đợt -> Giảm công nợ ->
     * Sổ quỹ -> Kết thúc lượt khám -> Ghi log kiểm toán.
     */
    public function test_end_to_end_clinic_lifecycle_from_appointment_to_cashier(): void
    {
        // 0. Setup Staff Users
        $adminUser = $this->createUserWithRole('ADMIN');
        $this->authenticate($adminUser);

        // Setup Clinical Master Data
        $doctorEmployee = Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'BSCK2 Trần Minh Trí',
            'phone' => '0912345678',
            'email' => 'dr.tri@clinic.example',
            'position' => 'Bác sĩ Tai Mũi Họng',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-TMH01',
            'name' => 'Khám và Nội soi Tai Mũi Họng',
            'price' => 300000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Bệnh Nhân E2E',
            'date_of_birth' => '1992-05-15',
            'gender' => 'MALE',
            'phone' => '0988776655',
            'email' => 'patient.e2e@example.com',
            'address' => '456 Lê Duẩn, Quận 1, TP.HCM',
            'status' => 'ACTIVE',
        ]);

        // -------------------------------------------------------------
        // STEP 1: Đặt lịch hẹn khám (Appointment Creation)
        // -------------------------------------------------------------
        $appointmentDate = now()->addDays(1)->format('Y-m-d');
        $appointmentPayload = [
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service->id,
            'appointment_date' => $appointmentDate,
            'start_time' => '09:00:00',
            'end_time' => '09:30:00',
            'status' => 'CONFIRMED',
            'notes' => 'Bệnh nhân đau rát họng, khàn tiếng kéo dài',
        ];

        $appointmentResponse = $this->postJson('/api/v1/appointments', $appointmentPayload);
        $appointmentResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Đặt lịch hẹn khám thành công.',
            ]);

        $appointmentId = $appointmentResponse->json('data.id');
        $this->assertNotNull($appointmentId);

        $appointment = Appointment::find($appointmentId);
        $this->assertEquals('CONFIRMED', $appointment->status);
        $this->assertEquals($patient->id, $appointment->patient_id);

        // -------------------------------------------------------------
        // STEP 2: Tiếp đón & Check-in nguyên tử (Reception & Check-in)
        // -------------------------------------------------------------
        $checkInResponse = $this->postJson("/api/v1/appointments/{$appointment->id}/check-in");
        $checkInResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Tiếp nhận bệnh nhân từ lịch hẹn thành công.',
            ]);

        $visitId = $checkInResponse->json('data.id');
        $this->assertNotNull($visitId);

        // Verify Appointment status transitioned to COMPLETED
        $appointment->refresh();
        $this->assertEquals(Appointment::STATUS_COMPLETED, $appointment->status);

        // Verify Visit record in database
        $visit = Visit::find($visitId);
        $this->assertNotNull($visit);
        $this->assertEquals($appointment->id, $visit->appointment_id);
        $this->assertEquals($patient->id, $visit->patient_id);
        $this->assertEquals($doctorEmployee->id, $visit->employee_id);
        $this->assertEquals(Visit::STATUS_SCHEDULED, $visit->status);

        // -------------------------------------------------------------
        // STEP 3: Đính kèm tệp y tế (Upload Patient / Visit Medical File)
        // -------------------------------------------------------------
        $fakeFile = UploadedFile::fake()->create('xquang_vom_hong.jpg', 800, 'image/jpeg');

        $uploadResponse = $this->postJson("/api/v1/visits/{$visit->id}/files", [
            'file' => $fakeFile,
            'file_name' => 'Ảnh X-quang Vòm Họng',
            'description' => 'Hình ảnh phim chụp xoang hàm vòm họng lúc tiếp nhận',
        ]);

        $uploadResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tải lên tài liệu y tế thành công.',
            ]);

        $fileId = $uploadResponse->json('data.id');
        $this->assertNotNull($fileId);

        $patientFile = PatientFile::find($fileId);
        $this->assertNotNull($patientFile);
        $this->assertEquals($patient->id, $patientFile->patient_id);
        $this->assertEquals($visit->id, $patientFile->visit_id);
        Storage::disk('local')->assertExists($patientFile->storage_path);

        // Test stream preview of the uploaded file
        $previewResponse = $this->getJson("/api/v1/patient-files/{$patientFile->id}/preview");
        $previewResponse->assertStatus(200);

        // -------------------------------------------------------------
        // STEP 4: Khám bệnh & Bệnh án điện tử (Medical Record & Diagnosis)
        // -------------------------------------------------------------
        $medicalRecordPayload = [
            'doctor_id' => $doctorEmployee->id,
            'medical_history' => 'Tiền sử viêm xoang mạn tính tái phát đợt cấp 3 ngày nay.',
            'diagnosis' => 'Viêm xoang hàm cấp mủ (J01.0), Viêm họng cấp (J02)',
            'indication' => 'Nội soi tai mũi họng vi thể, Chụp X-quang Blondeau-Hirtz',
            'result' => 'Hình ảnh niêm mạc cuốn mũi phù nề xuất tiết dịch mủ khe giữa hai bên.',
            'treatment' => 'Kháng sinh Augmentin 1000mg x 14 viên, Medrol 16mg x 7 viên, Otrivin 0.05% x 1 lọ',
            'follow_up_date' => now()->addDays(7)->format('Y-m-d'),
        ];

        $medicalRecordResponse = $this->postJson("/api/v1/visits/{$visit->id}/medical-record", $medicalRecordPayload);
        $medicalRecordResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo hồ sơ bệnh án thành công.',
            ]);

        // Verify Medical Record in database
        $this->assertDatabaseHas('medical_records', [
            'visit_id' => $visit->id,
            'doctor_id' => $doctorEmployee->id,
            'diagnosis' => 'Viêm xoang hàm cấp mủ (J01.0), Viêm họng cấp (J02)',
        ]);

        // Verify Visit status was synced to COMPLETED upon medical record creation
        $visit->refresh();
        $this->assertEquals(Visit::STATUS_COMPLETED, $visit->status);

        // -------------------------------------------------------------
        // STEP 5: Quản lý kho dược & Kê đơn trừ kho (Inventory Management)
        // -------------------------------------------------------------
        $medicine = Product::create([
            'product_code' => 'THUOC-AUG1000',
            'name' => 'Kháng sinh Augmentin 1000mg Hộp 14 viên',
            'unit' => 'Hộp',
            'cost_price' => 180000,
            'selling_price' => 240000,
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        // 5.1 Nhập kho ban đầu (Stock IN: 50 hộp)
        $stockInResponse = $this->postJson('/api/v1/inventory-transactions', [
            'product_id' => $medicine->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'reference_type' => 'GoodsReceipt',
            'reference_id' => 101,
            'transaction_date' => now()->format('Y-m-d'),
        ]);
        $stockInResponse->assertStatus(201);

        // 5.2 Xuất kho kê đơn cho bệnh nhân (Stock OUT: 1 hộp cho lượt khám này)
        $stockOutResponse = $this->postJson('/api/v1/inventory-transactions', [
            'product_id' => $medicine->id,
            'transaction_type' => 'OUT',
            'quantity' => 1,
            'reference_type' => 'Prescription',
            'reference_id' => $visit->id,
            'transaction_date' => now()->format('Y-m-d'),
        ]);
        $stockOutResponse->assertStatus(201);

        // Verify remaining stock is 49
        $remainingStock = (float) InventoryTransaction::where('product_id', $medicine->id)
            ->selectRaw("SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity ELSE 0 END) as total")
            ->value('total');
        $this->assertEquals(49.0, $remainingStock);

        // -------------------------------------------------------------
        // STEP 6: Lập hóa đơn viện phí (Create Invoice)
        // -------------------------------------------------------------
        // Phí khám: 300,000 + Thuốc: 240,000 = 540,000. Giảm giá: 40,000 => Tổng thanh toán: 500,000
        $invoicePayload = [
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'subtotal_amount' => 540000,
            'discount_amount' => 40000,
            'issued_at' => now()->toIso8601String(),
        ];

        $invoiceResponse = $this->postJson('/api/v1/invoices', $invoicePayload);
        $invoiceResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo hóa đơn mới thành công.',
            ]);

        $invoiceId = $invoiceResponse->json('data.id');
        $this->assertNotNull($invoiceId);

        $invoice = Invoice::find($invoiceId);
        $this->assertEquals(540000.0, (float) $invoice->subtotal_amount);
        $this->assertEquals(40000.0, (float) $invoice->discount_amount);
        $this->assertEquals(500000.0, (float) $invoice->total_amount);
        $this->assertEquals(0.0, (float) $invoice->paid_amount);
        $this->assertEquals(500000.0, (float) $invoice->remaining_amount);
        $this->assertEquals('UNPAID', $invoice->status);

        // Verify visit payment status is UNPAID
        $visit->refresh();
        $this->assertEquals('UNPAID', $visit->payment_status);

        // -------------------------------------------------------------
        // STEP 7: Kiểm tra công nợ trước thanh toán (Debt Ledger Verification)
        // -------------------------------------------------------------
        $debtSummaryResponse = $this->getJson('/api/v1/debts/summary');
        $debtSummaryResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
        $this->assertGreaterThanOrEqual(500000, (float) $debtSummaryResponse->json('data.total_remaining_debt'));

        $patientDebtResponse = $this->getJson("/api/v1/debts/patients/{$patient->id}");
        $patientDebtResponse->assertStatus(200);
        $patientDebt = (float) ($patientDebtResponse->json('data.total_debt') ?? $patientDebtResponse->json('data.summary.total_remaining_debt'));
        $this->assertEquals(500000.0, $patientDebt);

        // -------------------------------------------------------------
        // STEP 8: Thu tiền Đợt 1 - Tạm ứng 200,000 VNĐ (Partial Payment)
        // -------------------------------------------------------------
        $payment1Payload = [
            'amount' => 200000,
            'payment_method' => 'CASH',
            'notes' => 'Bệnh nhân tạm ứng tiền mặt đợt 1 tại quầy thu ngân',
        ];

        $payment1Response = $this->postJson("/api/v1/invoices/{$invoice->id}/payments", $payment1Payload);
        $payment1Response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Thu tiền hóa đơn thành công.',
            ]);

        $invoice->refresh();
        $this->assertEquals(200000.0, (float) $invoice->paid_amount);
        $this->assertEquals(300000.0, (float) $invoice->remaining_amount);
        $this->assertEquals('PARTIAL', $invoice->status);

        $visit->refresh();
        $this->assertEquals('PARTIAL', $visit->payment_status);

        // Verify CashTransaction IN was automatically created for Payment 1
        $this->assertDatabaseHas('cash_transactions', [
            'transaction_type' => 'IN',
            'amount' => 200000,
            'payment_method' => 'CASH',
            'reference_type' => 'Payment',
        ]);

        // Verify patient debt reduced to 300,000
        $patientDebtResponseAfterP1 = $this->getJson("/api/v1/debts/patients/{$patient->id}");
        $patientDebtAfterP1 = (float) ($patientDebtResponseAfterP1->json('data.total_debt') ?? $patientDebtResponseAfterP1->json('data.summary.total_remaining_debt'));
        $this->assertEquals(300000.0, $patientDebtAfterP1);

        // -------------------------------------------------------------
        // STEP 9: Thu tiền Đợt 2 - Tất toán 300,000 VNĐ (Full Final Payment)
        // -------------------------------------------------------------
        $payment2Payload = [
            'amount' => 300000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_code' => 'VCB-20261029-998877',
            'notes' => 'Bệnh nhân chuyển khoản thanh toán dứt điểm phần còn lại',
        ];

        $payment2Response = $this->postJson("/api/v1/invoices/{$invoice->id}/payments", $payment2Payload);
        $payment2Response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Thu tiền hóa đơn thành công.',
            ]);

        $invoice->refresh();
        $this->assertEquals(500000.0, (float) $invoice->paid_amount);
        $this->assertEquals(0.0, (float) $invoice->remaining_amount);
        $this->assertEquals('PAID', $invoice->status);

        $visit->refresh();
        $this->assertEquals('PAID', $visit->payment_status);

        // Verify CashTransaction IN was automatically created for Payment 2
        $this->assertDatabaseHas('cash_transactions', [
            'transaction_type' => 'IN',
            'amount' => 300000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_type' => 'Payment',
        ]);

        // Verify patient debt is now 0.00
        $patientDebtResponseAfterP2 = $this->getJson("/api/v1/debts/patients/{$patient->id}");
        $patientDebtAfterP2 = (float) ($patientDebtResponseAfterP2->json('data.total_debt') ?? $patientDebtResponseAfterP2->json('data.summary.total_remaining_debt'));
        $this->assertEquals(0.0, $patientDebtAfterP2);

        // -------------------------------------------------------------
        // STEP 10: Sổ quỹ & Báo cáo dòng tiền (Cash Transactions & Cashbook)
        // -------------------------------------------------------------
        $cashbookSummaryResponse = $this->getJson('/api/v1/cash-transactions/summary');
        $cashbookSummaryResponse->assertStatus(200);
        $this->assertGreaterThanOrEqual(500000.0, (float) $cashbookSummaryResponse->json('data.total_in'));

        $cashTransactionsList = $this->getJson('/api/v1/cash-transactions?reference_type=Payment');
        $cashTransactionsList->assertStatus(200);
        $this->assertGreaterThanOrEqual(2, count($cashTransactionsList->json('data')));

        // -------------------------------------------------------------
        // STEP 11: Kiểm tra kết thúc Lượt khám hoàn tất toàn diện
        // -------------------------------------------------------------
        $finalVisitResponse = $this->getJson("/api/v1/visits/{$visit->id}");
        $finalVisitResponse->assertStatus(200);
        $this->assertEquals(Visit::STATUS_COMPLETED, $finalVisitResponse->json('data.status'));
        $this->assertEquals('PAID', $finalVisitResponse->json('data.payment_status'));

        // -------------------------------------------------------------
        // STEP 12: Nhật ký kiểm toán toàn trình (Audit Trail Verification)
        // -------------------------------------------------------------
        $auditLogsResponse = $this->getJson('/api/v1/audit-logs');
        $auditLogsResponse->assertStatus(200);

        // Verify audit logs were captured for key lifecycle actions
        $this->assertTrue(AuditLog::where('module', 'medical_records')->where('table_name', 'medical_records')->exists());
        $this->assertTrue(AuditLog::where('module', 'patient_files')->where('action', 'upload')->exists());
        $this->assertTrue(AuditLog::where('module', 'invoices')->where('action', 'create_invoice')->exists());
        $this->assertTrue(AuditLog::where('module', 'payments')->where('action', 'create_payment')->count() >= 2);
    }

    /**
     * Test walk-in patient lifecycle without prior appointment:
     * Patient Registration -> Walk-in Visit -> Medical Record -> Invoice -> Single Full Payment.
     */
    public function test_end_to_end_walk_in_patient_without_prior_appointment(): void
    {
        $adminUser = $this->createUserWithRole('ADMIN');
        $this->authenticate($adminUser);

        // 1. Direct Patient Registration
        $patientResponse = $this->postJson('/api/v1/patients', [
            'full_name' => 'Lê Khách Vãng Lai',
            'gender' => 'FEMALE',
            'date_of_birth' => '1985-11-20',
            'phone' => '0901234999',
            'address' => '789 Nguyễn Thị Minh Khai, Q3, TP.HCM',
        ]);
        $patientResponse->assertStatus(201);
        $patientId = $patientResponse->json('data.id');

        // Master doctor & service
        $doctor = Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác sĩ Đặng Thu Trang',
            'phone' => '0909887766',
            'status' => 'ACTIVE',
        ]);
        $service = Service::create([
            'service_code' => 'DV-KTM',
            'name' => 'Khám tổng quát Da liễu',
            'price' => 200000,
            'duration_minutes' => 20,
            'status' => 'ACTIVE',
        ]);

        // 2. Direct Walk-in Visit
        $visitResponse = $this->postJson('/api/v1/visits', [
            'patient_id' => $patientId,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->toIso8601String(),
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'status' => Visit::STATUS_SCHEDULED,
        ]);
        $visitResponse->assertStatus(201);
        $visitId = $visitResponse->json('data.id');

        // 3. Medical Record
        $medResponse = $this->postJson("/api/v1/visits/{$visitId}/medical-record", [
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Viêm da tiếp xúc dị ứng (L23)',
            'treatment' => 'Kem bôi Hydrocortisone 1%, Telfast 180mg x 10 ngày',
        ]);
        $medResponse->assertStatus(201);

        // 4. Invoice
        $invoiceResponse = $this->postJson('/api/v1/invoices', [
            'patient_id' => $patientId,
            'visit_id' => $visitId,
            'subtotal_amount' => 200000,
            'discount_amount' => 0,
        ]);
        $invoiceResponse->assertStatus(201);
        $invoiceId = $invoiceResponse->json('data.id');

        // 5. Pay in full via Card
        $paymentResponse = $this->postJson("/api/v1/invoices/{$invoiceId}/payments", [
            'amount' => 200000,
            'payment_method' => 'CARD',
            'reference_code' => 'POS-TRAN-8899',
            'notes' => 'Quẹt thẻ máy POS Sacombank',
        ]);
        $paymentResponse->assertStatus(201);

        // 6. Verify Completed State
        $invoice = Invoice::find($invoiceId);
        $this->assertEquals('PAID', $invoice->status);
        $this->assertEquals(0.0, (float) $invoice->remaining_amount);

        $visit = Visit::find($visitId);
        $this->assertEquals(Visit::STATUS_COMPLETED, $visit->status);
        $this->assertEquals('PAID', $visit->payment_status);

        $this->assertDatabaseHas('cash_transactions', [
            'amount' => 200000,
            'payment_method' => 'CARD',
            'reference_type' => 'Payment',
        ]);
    }

    /**
     * Test edge case: An invoice cannot be overpaid and rejects excess amount with 422.
     */
    public function test_payment_cannot_exceed_remaining_invoice_debt(): void
    {
        $adminUser = $this->createUserWithRole('ADMIN');
        $this->authenticate($adminUser);

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Kiểm Tra Nợ',
            'phone' => '0933333333',
            'status' => 'ACTIVE',
        ]);

        $invoice = Invoice::create([
            'invoice_code' => 'HD'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'subtotal_amount' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'paid_amount' => 0,
            'remaining_amount' => 150000,
            'status' => 'UNPAID',
            'issued_at' => now(),
            'created_by' => $adminUser->id,
        ]);

        // Attempt to pay 200,000 for a 150,000 invoice
        $response = $this->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 200000,
            'payment_method' => 'CASH',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        // Invoice remains UNPAID
        $invoice->refresh();
        $this->assertEquals('UNPAID', $invoice->status);
        $this->assertEquals(150000.0, (float) $invoice->remaining_amount);
    }

    /**
     * Test edge case: Cannot check-in an already COMPLETED or CANCELLED appointment.
     */
    public function test_cannot_check_in_already_completed_appointment(): void
    {
        $adminUser = $this->createUserWithRole('ADMIN');
        $this->authenticate($adminUser);

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh nhân Check-in Trùng',
            'phone' => '0944444444',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác sĩ Trực',
            'phone' => '0955555555',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-TEST',
            'name' => 'Dịch vụ Kiểm tra',
            'price' => 100000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        $appointment = Appointment::create([
            'appointment_code' => 'LH'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => now()->format('Y-m-d'),
            'start_time' => '14:00:00',
            'end_time' => '14:30:00',
            'status' => Appointment::STATUS_COMPLETED,
            'created_by' => $adminUser->id,
        ]);

        $response = $this->postJson("/api/v1/appointments/{$appointment->id}/check-in");
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }
}
