<?php

namespace Tests\Feature;

use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\KpiTarget;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class Phase2EndToEndWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create an active user with a specific role.
     */
    protected function createUserWithRole(string $roleName = 'ADMIN'): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Nhân viên y tế',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'e2e_user_'.fake()->unique()->lexify('??????'),
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
     * Helper to authenticate a user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('e2e-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(): Patient
    {
        return Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh nhân '.fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'gender' => 'MALE',
            'date_of_birth' => '1990-05-15',
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create a test doctor employee.
     */
    protected function createDoctor(string $code = 'BS001', string $name = 'Bác Sĩ Trưởng Khoa'): Employee
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
     * Helper to create a medical service.
     */
    protected function createService(float $price = 1000000.00): Service
    {
        return Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('#####'),
            'name' => 'Gói khám tổng quát chuyên sâu',
            'price' => $price,
            'duration_minutes' => 45,
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * Helper to create a test product.
     */
    protected function createProduct(array $attributes = []): Product
    {
        return Product::create(array_merge([
            'product_code' => 'PRD-'.fake()->unique()->numerify('#####'),
            'name' => 'Vật tư y tế '.fake()->words(2, true),
            'unit' => 'Hộp',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create an expense category.
     */
    protected function createExpenseCategory(string $name = 'Chi phí vận hành y tế'): ExpenseCategory
    {
        return ExpenseCategory::create([
            'name' => $name.' '.fake()->unique()->numerify('####'),
            'description' => 'Danh mục chi phí kiểm thử E2E',
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * =========================================================================
     * KỊCH BẢN E2E 1: Khám bệnh -> Hóa đơn -> Thanh toán nhiều đợt -> Công nợ -> Sổ quỹ -> KPI
     * =========================================================================
     * Bệnh nhân hoàn tất lượt khám -> Tạo Hóa đơn 1.000.000đ -> Thu đợt 1 (400.000đ)
     * -> Kiểm tra Công nợ còn 600.000đ (PARTIAL) -> Thu đợt 2 (600.000đ) -> Hóa đơn PAID,
     * Sổ quỹ tăng đúng 1.000.000đ, KPI Bác sĩ tự động cộng doanh thu và lượt khám.
     */
    public function test_e2e_scenario_1_clinical_visit_to_invoice_split_payments_debt_and_doctor_kpi(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $cashier = $this->createUserWithRole('CASHIER');
        $doctor = $this->createDoctor('BS-E2E-01', 'BS CK1 Nguyễn Văn An');

        // Associate user to doctor for role authentication if needed
        $doctorUser = User::create([
            'employee_id' => $doctor->id,
            'username' => 'dr_nguyenvanan',
            'email' => $doctor->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);
        $doctorRole = Role::where('name', 'DOCTOR')->first();
        if ($doctorRole) {
            $doctorUser->roles()->attach($doctorRole->id, ['created_at' => now()]);
        }

        $patient = $this->createPatient();
        $service = $this->createService(1000000.00);

        // 1. Giao chỉ tiêu KPI cho Bác sĩ trong tháng hiện tại:
        // Target: 2.000.000 VND doanh thu, 5 lượt khám
        $periodStart = now()->startOfMonth()->toDateString();
        $periodEnd = now()->endOfMonth()->toDateString();

        $kpiTarget = KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'target_revenue' => 2000000,
            'target_visits' => 5,
            'created_by' => $admin->id,
        ]);

        // 2. Bệnh nhân hoàn tất lượt khám (COMPLETED) với Bác sĩ
        $visit = Visit::create([
            'visit_code' => 'VIS-E2E-'.fake()->unique()->numerify('#####'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->format('Y-m-d H:i:s'),
            'quantity' => 1,
            'unit_price' => 1000000,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
            'status' => Visit::STATUS_COMPLETED,
            'created_by' => $admin->id,
        ]);

        // 3. Lập Hóa đơn 1.000.000đ từ lượt khám qua API /api/v1/invoices
        $invoicePayload = [
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'subtotal_amount' => 1000000,
            'discount_amount' => 0,
            'issued_at' => now()->format('Y-m-d H:i:s'),
        ];

        $invoiceResponse = $this->authenticate($cashier)
            ->postJson('/api/v1/invoices', $invoicePayload);

        $invoiceResponse->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_amount', 1000000)
            ->assertJsonPath('data.paid_amount', 0)
            ->assertJsonPath('data.remaining_amount', 1000000)
            ->assertJsonPath('data.status', 'UNPAID');

        $invoiceId = $invoiceResponse->json('data.id');

        // 4. Thu đợt 1 (400.000đ) bằng Tiền mặt (CASH)
        $payment1Response = $this->authenticate($cashier)
            ->postJson("/api/v1/invoices/{$invoiceId}/payments", [
                'amount' => 400000,
                'payment_method' => 'CASH',
                'payment_date' => now()->toDateString(),
                'note' => 'Thu tiền đợt 1 tại quầy thu ngân',
            ]);

        $payment1Response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 400000)
            ->assertJsonPath('data.invoice.status', 'PARTIAL')
            ->assertJsonPath('data.invoice.paid_amount', 400000)
            ->assertJsonPath('data.invoice.remaining_amount', 600000);

        // 5. Kiểm tra Công nợ qua API: Công nợ còn lại của bệnh nhân là 600.000đ
        $debtSummaryResponse = $this->authenticate($cashier)
            ->getJson('/api/v1/debts/summary');

        $debtSummaryResponse->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertEquals(600000, (float) $debtSummaryResponse->json('data.total_remaining_debt'));

        $patientDebtResponse = $this->authenticate($cashier)
            ->getJson("/api/v1/debts/patients/{$patient->id}");

        $patientDebtResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.summary.total_remaining', 600000)
            ->assertJsonPath('data.summary.total_invoiced', 1000000)
            ->assertJsonPath('data.summary.total_paid', 400000);

        // Kiểm tra bút toán thu IN đợt 1 đã được tự động ghi vào Sổ quỹ
        $this->assertDatabaseHas('cash_transactions', [
            'transaction_type' => 'IN',
            'amount' => 400000.00,
            'payment_method' => 'CASH',
            'reference_type' => 'Payment',
        ]);

        // 6. Thu đợt 2 (600.000đ) qua Chuyển khoản (BANK_TRANSFER) -> Tất toán hóa đơn
        $payment2Response = $this->authenticate($cashier)
            ->postJson("/api/v1/invoices/{$invoiceId}/payments", [
                'amount' => 600000,
                'payment_method' => 'BANK_TRANSFER',
                'payment_date' => now()->toDateString(),
                'reference_code' => 'FT261028-999',
                'note' => 'Thu tiền đợt 2 - tất toán hóa đơn',
            ]);

        $payment2Response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 600000)
            ->assertJsonPath('data.invoice.status', 'PAID')
            ->assertJsonPath('data.invoice.paid_amount', 1000000)
            ->assertJsonPath('data.invoice.remaining_amount', 0);

        // Đồng bộ trạng thái thanh toán trên Lượt khám sang PAID
        $this->assertEquals(Visit::PAYMENT_STATUS_PAID, $visit->fresh()->payment_status);

        // Công nợ của bệnh nhân trở về 0đ
        $patientDebtPostPay = $this->authenticate($cashier)
            ->getJson("/api/v1/debts/patients/{$patient->id}");
        $patientDebtPostPay->assertStatus(200)
            ->assertJsonPath('data.summary.total_remaining', 0);

        // Kiểm tra Sổ quỹ: Tổng thu IN từ 2 đợt thanh toán đúng 1.000.000đ
        $cashbookResponse = $this->authenticate($admin)
            ->getJson('/api/v1/cash-transactions/summary');

        $cashbookResponse->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertEquals(1000000, (float) $cashbookResponse->json('data.total_in'));

        // 7. Kiểm tra KPI Bác sĩ tự động tổng hợp từ Lượt khám COMPLETED & Hóa đơn PAID
        $kpiResponse = $this->authenticate($admin)
            ->getJson("/api/v1/kpi-targets?employee_id={$doctor->id}");

        $kpiResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $kpiData = $kpiResponse->json('data.0');
        $this->assertEquals($doctor->id, $kpiData['employee_id']);
        $this->assertEquals(1000000, (float) $kpiData['actual_revenue']);
        $this->assertEquals(1, (int) $kpiData['actual_visits']);
        $this->assertEquals(50.0, (float) $kpiData['revenue_completion_rate']); // 1.000.000 / 2.000.000 = 50%
        $this->assertEquals(20.0, (float) $kpiData['visits_completion_rate']);  // 1 / 5 = 20%
    }

    /**
     * =========================================================================
     * KỊCH BẢN E2E 2: Lập phiếu chi -> Phê duyệt -> Tự động trừ quỹ & Gửi thông báo
     * =========================================================================
     * Kế toán lập Phiếu chi 300.000đ (PENDING) -> Quản lý duyệt qua
     * /api/v1/approval-requests/{id}/approve -> Phiếu chi APPROVED,
     * Sổ quỹ tự động ghi OUT 300.000đ (Tồn quỹ còn 700.000đ), Kế toán nhận được Notification.
     */
    public function test_e2e_scenario_2_expense_creation_and_approval_workflow_with_cash_out_and_notification(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $manager = $this->createUserWithRole('MANAGER');
        $accountant = $this->createUserWithRole('ACCOUNTANT');

        // Giả lập tiền quỹ ban đầu có 1.000.000đ (qua giao dịch thu)
        CashTransaction::create([
            'transaction_code' => 'CTX-INIT-001',
            'transaction_type' => 'IN',
            'reference_type' => 'InitialFund',
            'reference_id' => 1,
            'amount' => 1000000,
            'payment_method' => 'CASH',
            'transaction_date' => now()->toDateString(),
            'description' => 'Số dư quỹ đầu kỳ',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $category = $this->createExpenseCategory('Vật tư khử khuẩn phòng khám');

        // 1. Kế toán lập Phiếu chi 300.000đ ở trạng thái PENDING
        $expense = Expense::create([
            'expense_code' => 'EXP-E2E-'.fake()->unique()->numerify('#####'),
            'category_id' => $category->id,
            'amount' => 300000,
            'payment_method' => 'CASH',
            'expense_date' => now()->toDateString(),
            'description' => 'Mua dung dịch sát khuẩn Chloramin B',
            'approval_status' => 'PENDING',
            'created_by' => $accountant->id,
        ]);

        // Kế toán tạo yêu cầu phê duyệt qua API /api/v1/approval-requests
        $approvalPayload = [
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'reason' => 'Đề nghị duyệt chi mua dung dịch sát khuẩn Chloramin B phòng dịch',
        ];

        $createApprovalResp = $this->authenticate($accountant)
            ->postJson('/api/v1/approval-requests', $approvalPayload);

        $createApprovalResp->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.requested_by', $accountant->id);

        $approvalId = $createApprovalResp->json('data.id');

        // 2. Quản lý kiểm tra danh sách yêu cầu chờ duyệt
        $pendingListResp = $this->authenticate($manager)
            ->getJson('/api/v1/approval-requests?status=PENDING');

        $pendingListResp->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertTrue(collect($pendingListResp->json('data'))->pluck('id')->contains($approvalId));

        // 3. Quản lý duyệt phiếu chi qua API /api/v1/approval-requests/{id}/approve
        $approveResp = $this->authenticate($manager)
            ->postJson("/api/v1/approval-requests/{$approvalId}/approve");

        $approveResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $approvalId)
            ->assertJsonPath('data.status', 'APPROVED')
            ->assertJsonPath('data.approved_by', $manager->id);

        // 4. Kiểm tra trạng thái Phiếu chi Expense được cập nhật sang APPROVED
        $freshExpense = $expense->fresh();
        $this->assertEquals('APPROVED', $freshExpense->approval_status);
        $this->assertEquals($manager->id, $freshExpense->approved_by);

        // 5. Kiểm tra Sổ quỹ tự động ghi nhận bút toán chi OUT 300.000đ
        $this->assertDatabaseHas('cash_transactions', [
            'transaction_type' => 'OUT',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'amount' => 300000.00,
        ]);

        // Kiểm tra tồn quỹ cuối kỳ: 1.000.000 (IN) - 300.000 (OUT) = 700.000đ
        $cashSummaryResp = $this->authenticate($accountant)
            ->getJson('/api/v1/cash-transactions/summary');

        $cashSummaryResp->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertEquals(1000000, (float) $cashSummaryResp->json('data.total_in'));
        $this->assertEquals(300000, (float) $cashSummaryResp->json('data.total_out'));
        $this->assertEquals(700000, (float) $cashSummaryResp->json('data.net_change'));

        // 6. Kiểm tra Kế toán nhận được Notification báo yêu cầu đã được duyệt
        $notificationResp = $this->authenticate($accountant)
            ->getJson('/api/v1/notifications?unread_only=1');

        $notificationResp->assertStatus(200)
            ->assertJsonPath('success', true);

        $notifications = collect($notificationResp->json('data'));
        $foundApprovedNoti = $notifications->firstWhere('type', 'APPROVAL_APPROVED');

        $this->assertNotNull($foundApprovedNoti, 'Kế toán phải nhận được thông báo APPROVAL_APPROVED');
        $this->assertEquals('ApprovalRequest', $foundApprovedNoti['reference_type']);
        $this->assertEquals($approvalId, $foundApprovedNoti['reference_id']);
        $this->assertFalse($foundApprovedNoti['is_read']);
    }

    /**
     * =========================================================================
     * KỊCH BẢN E2E 3: Nhập/Xuất kho -> Cảnh báo tồn kho thấp -> Chặn âm kho
     * =========================================================================
     * Nhập kho 10 hộp vật tư (minimum_stock = 5) -> Xuất kho 6 hộp (còn 4 hộp <= 5)
     * -> Tự động sinh cảnh báo LOW_STOCK -> Thử xuất tiếp 5 hộp bị chặn 422.
     */
    public function test_e2e_scenario_3_inventory_transactions_and_low_stock_notification_and_negative_stock_prevention(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $manager = $this->createUserWithRole('MANAGER');

        // Tạo sản phẩm vật tư y tế với ngưỡng tối thiểu 5 hộp
        $product = $this->createProduct([
            'product_code' => 'PRD-E2E-GAUZE-01',
            'name' => 'Băng gạc tiệt trùng 10x10cm',
            'unit' => 'Hộp',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        // 1. Nhập kho 10 hộp vật tư
        $stockInResp = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'IN',
                'quantity' => 10,
                'reference_type' => 'PURCHASE_ORDER',
                'description' => 'Nhập kho lô băng gạc đợt 1',
            ]);

        $stockInResp->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.transaction_type', 'IN')
            ->assertJsonPath('data.quantity', 10)
            ->assertJsonPath('current_stock', 10)
            ->assertJsonPath('is_low_stock', false);

        $this->assertEquals(10, $product->fresh()->current_stock);

        // 2. Xuất kho 6 hộp (Tồn kho giảm còn 4 hộp <= minimum_stock 5)
        $stockOutResp = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'OUT',
                'quantity' => 6,
                'reference_type' => 'CLINIC_USAGE',
                'description' => 'Xuất cấp cho phòng tiểu phẫu',
            ]);

        $stockOutResp->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.transaction_type', 'OUT')
            ->assertJsonPath('data.quantity', 6)
            ->assertJsonPath('current_stock', 4)
            ->assertJsonPath('is_low_stock', true);

        $this->assertEquals(4, $product->fresh()->current_stock);

        // Kiểm tra tự động sinh Notification cảnh báo LOW_STOCK cho Admin và Manager
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type' => 'LOW_STOCK',
            'reference_type' => 'Product',
            'reference_id' => $product->id,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $manager->id,
            'type' => 'LOW_STOCK',
            'reference_type' => 'Product',
            'reference_id' => $product->id,
        ]);

        // 3. Thử xuất tiếp 5 hộp khi tồn kho chỉ còn 4 hộp -> Bắt buộc bị chặn HTTP 422
        $excessiveOutResp = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'OUT',
                'quantity' => 5,
                'description' => 'Thử xuất quá số lượng tồn',
            ]);

        $excessiveOutResp->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        // Đảm bảo tồn kho vẫn được bảo vệ nguyên vẹn ở mức 4 hộp, không bị âm
        $this->assertEquals(4, $product->fresh()->current_stock);
        $this->assertDatabaseMissing('inventory_transactions', [
            'product_id' => $product->id,
            'transaction_type' => 'OUT',
            'quantity' => 5,
        ]);
    }

    /**
     * =========================================================================
     * KỊCH BẢN E2E 4: Import CSV có dòng lỗi -> Lưu vết -> Export CSV -> Báo cáo Quản trị
     * =========================================================================
     * Import CSV sản phẩm có cả dòng hợp lệ và dòng lỗi -> Kiểm tra import_batches
     * và import_errors, sau đó Export CSV và kiểm tra Báo cáo Quản trị.
     */
    public function test_e2e_scenario_4_data_import_with_partial_errors_export_and_management_reports(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // 1. Chuẩn bị file CSV sản phẩm: dòng 1 hợp lệ, dòng 2 lỗi (thiếu tên sản phẩm)
        $csvContent = "product_code,name,unit,minimum_stock,initial_stock\n"
            ."PRD-E2E-GOOD-01,Dung dịch sát khuẩn Povidone 500ml,Chai,10,30\n"
            ."PRD-E2E-BAD-02,,Hộp,5,10\n";

        $csvFile = UploadedFile::fake()->createWithContent('products_e2e_batch.csv', $csvContent);

        // Gửi request Import qua API /api/v1/imports/products
        $importResponse = $this->authenticate($admin)
            ->postJson('/api/v1/imports/products', [
                'file' => $csvFile,
            ]);

        $importResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_rows', 2)
            ->assertJsonPath('data.success_rows', 1)
            ->assertJsonPath('data.error_rows', 1)
            ->assertJsonPath('data.status', 'COMPLETED_WITH_ERRORS');

        $batchId = $importResponse->json('data.id');

        // Kiểm tra bản ghi import_batches được cập nhật chuẩn
        $this->assertDatabaseHas('import_batches', [
            'id' => $batchId,
            'module' => 'products',
            'total_rows' => 2,
            'success_rows' => 1,
            'error_rows' => 1,
            'status' => 'COMPLETED_WITH_ERRORS',
        ]);

        // Kiểm tra dòng lỗi được lưu vết chi tiết trong bảng import_errors
        $this->assertDatabaseHas('import_errors', [
            'batch_id' => $batchId,
            'row_number' => 3, // Dòng 3 tính từ header
            'column_name' => 'name',
        ]);

        // Kiểm tra sản phẩm hợp lệ đã được thêm vào kho và khởi tạo tồn kho
        $validProduct = Product::where('product_code', 'PRD-E2E-GOOD-01')->firstOrFail();
        $this->assertEquals(30, $validProduct->current_stock);

        // 2. Xuất dữ liệu ra file CSV chuẩn UTF-8 BOM qua API /api/v1/exports/inventory
        $exportInventoryResp = $this->authenticate($admin)
            ->getJson('/api/v1/exports/inventory');

        $exportInventoryResp->assertStatus(200);
        $this->assertStringContainsString('text/csv', (string) $exportInventoryResp->headers->get('Content-Type'));

        $inventoryCsvOutput = $exportInventoryResp->getContent();
        // Kiểm tra có ký tự UTF-8 BOM đầu file
        $this->assertStringStartsWith("\xEF\xBB\xBF", $inventoryCsvOutput);
        $this->assertStringContainsString('PRD-E2E-GOOD-01', $inventoryCsvOutput);
        $this->assertStringContainsString('Dung dịch sát khuẩn Povidone 500ml', $inventoryCsvOutput);

        // Xuất file CSV danh sách hóa đơn qua /api/v1/exports/invoices
        $exportInvoiceResp = $this->authenticate($admin)
            ->getJson('/api/v1/exports/invoices');

        $exportInvoiceResp->assertStatus(200);
        $this->assertStringContainsString('text/csv', (string) $exportInvoiceResp->headers->get('Content-Type'));
        $this->assertStringStartsWith("\xEF\xBB\xBF", $exportInvoiceResp->getContent());

        // 3. Kiểm tra các Báo cáo Quản trị hoạt động chuẩn xác
        // Báo cáo Tài chính
        $financialReportResp = $this->authenticate($admin)
            ->getJson('/api/v1/reports/financial?start_date='.now()->startOfMonth()->toDateString().'&end_date='.now()->endOfMonth()->toDateString());

        $financialReportResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'invoiced_amount',
                    'collected_amount',
                    'debt_amount',
                    'expense_amount',
                    'net_profit',
                    'net_cashflow',
                ],
            ]);

        // Báo cáo Kho vận y tế
        $inventoryReportResp = $this->authenticate($admin)
            ->getJson('/api/v1/reports/inventory');

        $inventoryReportResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data',
            ]);

        // Báo cáo Hoạt động Khám chữa bệnh
        $clinicalReportResp = $this->authenticate($admin)
            ->getJson('/api/v1/reports/clinical?start_date='.now()->startOfMonth()->toDateString().'&end_date='.now()->endOfMonth()->toDateString());

        $clinicalReportResp->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * =========================================================================
     * KỊCH BẢN E2E TOÀN DIỆN (FULL CLINIC LIFECYCLE):
     * Vòng đời điều hành phòng khám khép kín xuyên suốt 11 Modules Phase 2
     * =========================================================================
     */
    public function test_e2e_full_clinic_operational_pipeline(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $manager = $this->createUserWithRole('MANAGER');
        $doctor = $this->createDoctor('BS-PIPELINE', 'Bác sĩ Đỗ Trọng');
        $cashier = $this->createUserWithRole('CASHIER');
        $accountant = $this->createUserWithRole('ACCOUNTANT');

        // 1. Đăng ký Bệnh nhân & Dịch vụ y tế
        $patient = $this->createPatient();
        $service = $this->createService(1500000.00);

        // 2. Giao chỉ tiêu KPI cho Bác sĩ
        KpiTarget::create([
            'employee_id' => $doctor->id,
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
            'target_revenue' => 3000000,
            'target_visits' => 10,
            'created_by' => $admin->id,
        ]);

        // 3. Thực hiện Lượt khám (COMPLETED)
        $visit = Visit::create([
            'visit_code' => 'VIS-PIPE-'.fake()->unique()->numerify('#####'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now()->format('Y-m-d H:i:s'),
            'quantity' => 1,
            'unit_price' => 1500000,
            'discount_amount' => 100000,
            'total_amount' => 1400000,
            'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
            'status' => Visit::STATUS_COMPLETED,
            'created_by' => $admin->id,
        ]);

        // 4. Lập Hóa đơn (1.500.000 - 100.000 = 1.400.000)
        $invResp = $this->authenticate($cashier)->postJson('/api/v1/invoices', [
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'subtotal_amount' => 1500000,
            'discount_amount' => 100000,
        ]);
        $invResp->assertStatus(201);
        $invoiceId = $invResp->json('data.id');

        // 5. Thanh toán nhiều đợt: Đợt 1 (500k) + Đợt 2 (900k)
        $this->authenticate($cashier)->postJson("/api/v1/invoices/{$invoiceId}/payments", [
            'amount' => 500000,
            'payment_method' => 'CASH',
            'payment_date' => now()->toDateString(),
        ])->assertStatus(201);

        // Kiểm tra đối soát công nợ giữa chừng
        $debtMiddle = $this->authenticate($cashier)->getJson("/api/v1/debts/patients/{$patient->id}");
        $debtMiddle->assertStatus(200)->assertJsonPath('data.summary.total_remaining', 900000);

        // Tất toán đợt 2
        $this->authenticate($cashier)->postJson("/api/v1/invoices/{$invoiceId}/payments", [
            'amount' => 900000,
            'payment_method' => 'BANK_TRANSFER',
            'payment_date' => now()->toDateString(),
        ])->assertStatus(201);

        // Công nợ về 0, Lượt khám PAID
        $this->assertEquals(Visit::PAYMENT_STATUS_PAID, $visit->fresh()->payment_status);

        // 6. Lập Phiếu chi & Phê duyệt
        $cat = $this->createExpenseCategory('Bảo dưỡng máy xét nghiệm');
        $expense = Expense::create([
            'expense_code' => 'EXP-PIPE-'.fake()->unique()->numerify('#####'),
            'category_id' => $cat->id,
            'amount' => 400000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => now()->toDateString(),
            'approval_status' => 'PENDING',
            'created_by' => $accountant->id,
        ]);

        $apprResp = $this->authenticate($accountant)->postJson('/api/v1/approval-requests', [
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'reason' => 'Bảo dưỡng định kỳ máy sinh hóa',
        ]);
        $apprResp->assertStatus(201);
        $approvalId = $apprResp->json('data.id');

        // Manager duyệt
        $this->authenticate($manager)->postJson("/api/v1/approval-requests/{$approvalId}/approve")
            ->assertStatus(200);

        // 7. Quản lý Kho vật tư y tế
        $medProduct = $this->createProduct(['minimum_stock' => 10]);
        $this->authenticate($admin)->postJson('/api/v1/inventory-transactions', [
            'product_id' => $medProduct->id,
            'transaction_type' => 'IN',
            'quantity' => 20,
        ])->assertStatus(201);

        $this->authenticate($admin)->postJson('/api/v1/inventory-transactions', [
            'product_id' => $medProduct->id,
            'transaction_type' => 'OUT',
            'quantity' => 12,
        ])->assertStatus(201); // còn 8 <= 10 -> sinh cảnh báo

        $this->assertDatabaseHas('notifications', [
            'type' => 'LOW_STOCK',
            'reference_id' => $medProduct->id,
        ]);

        // Chặn xuất quá tồn
        $this->authenticate($admin)->postJson('/api/v1/inventory-transactions', [
            'product_id' => $medProduct->id,
            'transaction_type' => 'OUT',
            'quantity' => 15,
        ])->assertStatus(422);

        // 8. Báo cáo Quản trị & Dashboard tổng quan
        $dashboardResp = $this->authenticate($admin)->getJson('/api/v1/dashboard/summary');
        $dashboardResp->assertStatus(200)->assertJsonPath('success', true);

        // Kiểm tra Sổ quỹ: Thu 1.400.000đ, Chi 400.000đ -> Dòng tiền ròng 1.000.000đ
        $cashSummary = $this->authenticate($admin)->getJson('/api/v1/cash-transactions/summary');
        $cashSummary->assertStatus(200)
            ->assertJsonPath('data.total_in', 1400000)
            ->assertJsonPath('data.total_out', 400000)
            ->assertJsonPath('data.net_change', 1000000);
    }
}
