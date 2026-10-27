<?php

namespace Tests\Feature;

use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataExportApiTest extends TestCase
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
            'position' => 'Nhân viên',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'export_user_'.fake()->unique()->lexify('??????'),
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
     * Authenticate a user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test_token')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Văn Test',
            'date_of_birth' => '1992-06-15',
            'gender' => 'MALE',
            'phone' => '09'.fake()->unique()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'address' => 'Số 123 Đường Hai Bà Trưng, Quận 1, TP. Hồ Chí Minh',
            'emergency_contact_name' => 'Trần Thị Người Nhà',
            'emergency_contact_phone' => '0988776655',
            'first_visit_date' => '2026-01-10',
            'last_visit_date' => '2026-02-15',
            'status' => 'ACTIVE',
            'notes' => 'Bệnh nhân có tiền sử dị ứng thuốc aspirin',
        ], $attributes));
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->get('/api/v1/exports/patients')->assertUnauthorized();
        $this->get('/api/v1/exports/invoices')->assertUnauthorized();
        $this->get('/api/v1/exports/cashbook')->assertUnauthorized();
        $this->get('/api/v1/exports/inventory')->assertUnauthorized();
    }

    public function test_users_without_exports_view_permission_are_forbidden(): void
    {
        $doctor = $this->createUserWithRole('DOCTOR');
        $this->authenticate($doctor);

        $this->get('/api/v1/exports/patients')->assertForbidden();
        $this->get('/api/v1/exports/invoices')->assertForbidden();
        $this->get('/api/v1/exports/cashbook')->assertForbidden();
        $this->get('/api/v1/exports/inventory')->assertForbidden();

        $viewer = $this->createUserWithRole('VIEWER');
        $this->authenticate($viewer);

        $this->get('/api/v1/exports/patients')->assertForbidden();
        $this->get('/api/v1/exports/invoices')->assertForbidden();
        $this->get('/api/v1/exports/cashbook')->assertForbidden();
        $this->get('/api/v1/exports/inventory')->assertForbidden();
    }

    public function test_admin_can_export_patients_with_utf8_bom_and_vietnamese_content(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patient = $this->createPatient([
            'patient_code' => 'BN009999',
            'full_name' => 'Nguyễn Thị Bích Phượng',
            'phone' => '0912999888',
            'address' => '456 Lê Duẩn, TP. Đà Nẵng',
        ]);

        $response = $this->get('/api/v1/exports/patients');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('Content-Type'));
        $this->assertStringContainsString('charset=UTF-8', (string) $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment;', (string) $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('danh_sach_benh_nhan_', (string) $response->headers->get('Content-Disposition'));

        $content = $response->getContent();

        // Verify UTF-8 BOM
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);

        // Verify headers
        $this->assertStringContainsString('Mã bệnh nhân', $content);
        $this->assertStringContainsString('Họ và tên', $content);
        $this->assertStringContainsString('Số điện thoại', $content);
        $this->assertStringContainsString('Địa chỉ', $content);

        // Verify data
        $this->assertStringContainsString('BN009999', $content);
        $this->assertStringContainsString('Nguyễn Thị Bích Phượng', $content);
        $this->assertStringContainsString('0912999888', $content);
        $this->assertStringContainsString('456 Lê Duẩn, TP. Đà Nẵng', $content);
    }

    public function test_patient_export_supports_search_and_filters(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $this->createPatient(['patient_code' => 'BN-FOUND', 'full_name' => 'Võ Hoàng Yến', 'status' => 'ACTIVE']);
        $this->createPatient(['patient_code' => 'BN-OTHER', 'full_name' => 'Trần Văn Khác', 'status' => 'INACTIVE']);

        // Filter by keyword search
        $response = $this->get('/api/v1/exports/patients?search=Hoàng+Yến');
        $response->assertOk();
        $content = $response->getContent();
        $this->assertStringContainsString('BN-FOUND', $content);
        $this->assertStringNotContainsString('BN-OTHER', $content);

        // Filter by status
        $responseStatus = $this->get('/api/v1/exports/patients?status=INACTIVE');
        $responseStatus->assertOk();
        $contentStatus = $responseStatus->getContent();
        $this->assertStringContainsString('BN-OTHER', $contentStatus);
        $this->assertStringNotContainsString('BN-FOUND', $contentStatus);
    }

    public function test_admin_can_export_invoices_and_filter_debts(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patientA = $this->createPatient(['patient_code' => 'BN-PAID-01', 'full_name' => 'Lê Thành Đạt']);
        $patientB = $this->createPatient(['patient_code' => 'BN-DEBT-02', 'full_name' => 'Phạm Gia Hưng']);

        $paidInvoice = Invoice::create([
            'invoice_code' => 'INV-PAID-001',
            'patient_id' => $patientA->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'paid_amount' => 500000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => now(),
            'created_by' => $admin->id,
        ]);

        $debtInvoice = Invoice::create([
            'invoice_code' => 'INV-DEBT-002',
            'patient_id' => $patientB->id,
            'subtotal_amount' => 1200000,
            'discount_amount' => 200000,
            'total_amount' => 1000000,
            'paid_amount' => 300000,
            'remaining_amount' => 700000,
            'status' => 'PARTIAL',
            'issued_at' => now(),
            'created_by' => $admin->id,
        ]);

        // 1. All invoices export
        $response = $this->get('/api/v1/exports/invoices');
        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('Content-Type'));
        $this->assertStringContainsString('hoa_don_cong_no_', (string) $response->headers->get('Content-Disposition'));

        $content = $response->getContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);
        $this->assertStringContainsString('Mã hóa đơn', $content);
        $this->assertStringContainsString('Còn nợ', $content);
        $this->assertStringContainsString('INV-PAID-001', $content);
        $this->assertStringContainsString('INV-DEBT-002', $content);
        $this->assertStringContainsString('700000.00', $content);

        // 2. Debt-only filter export
        $debtResponse = $this->get('/api/v1/exports/invoices?debt_only=1');
        $debtResponse->assertOk();
        $debtContent = $debtResponse->getContent();
        $this->assertStringContainsString('INV-DEBT-002', $debtContent);
        $this->assertStringNotContainsString('INV-PAID-001', $debtContent);
    }

    public function test_admin_and_accountant_can_export_cashbook_with_filters(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $this->authenticate($accountant);

        $txnIn = CashTransaction::create([
            'transaction_code' => 'THU-202610-001',
            'transaction_type' => 'IN',
            'reference_type' => 'PAYMENT',
            'reference_id' => 101,
            'amount' => 1500000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'description' => 'Thu tiền tạm ứng viện phí đợt 1',
            'created_by' => $accountant->id,
        ]);

        $txnOut = CashTransaction::create([
            'transaction_code' => 'CHI-202610-002',
            'transaction_type' => 'OUT',
            'reference_type' => 'EXPENSE',
            'reference_id' => 202,
            'amount' => 450000,
            'payment_method' => 'BANK_TRANSFER',
            'transaction_date' => now(),
            'description' => 'Chi mua văn phòng phẩm và găng tay y tế',
            'created_by' => $accountant->id,
        ]);

        // Accountant export cashbook
        $response = $this->get('/api/v1/exports/cashbook');
        $response->assertOk();
        $this->assertStringContainsString('so_quy_thu_chi_', (string) $response->headers->get('Content-Disposition'));

        $content = $response->getContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);
        $this->assertStringContainsString('Mã phiếu', $content);
        $this->assertStringContainsString('Loại giao dịch', $content);
        $this->assertStringContainsString('Phương thức thanh toán', $content);
        $this->assertStringContainsString('THU-202610-001', $content);
        $this->assertStringContainsString('CHI-202610-002', $content);
        $this->assertStringContainsString('1500000.00', $content);
        $this->assertStringContainsString('Tiền mặt', $content);
        $this->assertStringContainsString('Chuyển khoản', $content);

        // Filter by transaction_type=IN
        $responseIn = $this->get('/api/v1/exports/cashbook?transaction_type=IN');
        $responseIn->assertOk();
        $contentIn = $responseIn->getContent();
        $this->assertStringContainsString('THU-202610-001', $contentIn);
        $this->assertStringNotContainsString('CHI-202610-002', $contentIn);
    }

    public function test_admin_can_export_inventory_with_movements_and_stock_status(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $productA = Product::create([
            'product_code' => 'MED-001',
            'name' => 'Kháng sinh Amoxicillin 500mg',
            'unit' => 'Hộp',
            'minimum_stock' => 20,
            'status' => 'ACTIVE',
        ]);

        $productB = Product::create([
            'product_code' => 'MED-002',
            'name' => 'Băng gạc tiệt trùng y tế',
            'unit' => 'Cuộn',
            'minimum_stock' => 50,
            'status' => 'ACTIVE',
        ]);

        // Product A: 100 IN -> closing = 100 (> 20 -> Còn hàng)
        InventoryTransaction::create([
            'product_id' => $productA->id,
            'transaction_type' => 'IN',
            'quantity' => 100,
            'transaction_date' => now(),
            'created_by' => $admin->id,
        ]);

        // Product B: 10 IN, 5 OUT -> closing = 5 (<= 50 -> Sắp hết)
        InventoryTransaction::create([
            'product_id' => $productB->id,
            'transaction_type' => 'IN',
            'quantity' => 10,
            'transaction_date' => now(),
            'created_by' => $admin->id,
        ]);
        InventoryTransaction::create([
            'product_id' => $productB->id,
            'transaction_type' => 'OUT',
            'quantity' => 5,
            'transaction_date' => now(),
            'created_by' => $admin->id,
        ]);

        // 1. All products export
        $response = $this->get('/api/v1/exports/inventory');
        $response->assertOk();
        $this->assertStringContainsString('bao_cao_ton_kho_', (string) $response->headers->get('Content-Disposition'));

        $content = $response->getContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);
        $this->assertStringContainsString('Mã sản phẩm', $content);
        $this->assertStringContainsString('Tồn cuối kỳ', $content);
        $this->assertStringContainsString('Trạng thái tồn', $content);
        $this->assertStringContainsString('MED-001', $content);
        $this->assertStringContainsString('MED-002', $content);
        $this->assertStringContainsString('Còn hàng', $content);
        $this->assertStringContainsString('Sắp hết', $content);

        // 2. Low stock only filter
        $lowStockResponse = $this->get('/api/v1/exports/inventory?low_stock_only=1');
        $lowStockResponse->assertOk();
        $lowContent = $lowStockResponse->getContent();
        $this->assertStringContainsString('MED-002', $lowContent);
        $this->assertStringNotContainsString('MED-001', $lowContent);
    }

    public function test_csv_escapes_special_characters_and_vietnamese_diacritics_safely(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patient = $this->createPatient([
            'patient_code' => 'BN-SPECIAL-01',
            'full_name' => 'Ngô Đặng Hoàng "Bảo" Phúc',
            'address' => 'Số 10, Ngõ 20, Đường CMT8, Phường 5, Quận 3',
            'notes' => "Tiền sử: huyết áp cao, hen suyễn; Dị ứng: tôm, cua, kháng sinh penicillin.\nGhi chú nội bộ: \"Cần theo dõi sát\".",
        ]);

        $response = $this->get('/api/v1/exports/patients?search=BN-SPECIAL-01');
        $response->assertOk();

        $content = $response->getContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);

        // Strip BOM and parse CSV lines
        $cleanCsv = substr($content, 3);
        $lines = explode("\n", trim($cleanCsv));
        $this->assertGreaterThanOrEqual(2, count($lines));

        // Use str_getcsv to verify standard RFC 4180 CSV compliance
        $parsedHeader = str_getcsv($lines[0]);
        $this->assertEquals('Mã bệnh nhân', $parsedHeader[0]);

        $parsedRow = str_getcsv($lines[1]);
        $this->assertEquals('BN-SPECIAL-01', $parsedRow[0]);
        $this->assertEquals('Ngô Đặng Hoàng "Bảo" Phúc', $parsedRow[1]);

        $this->assertStringContainsString('Ngô Đặng Hoàng ""Bảo"" Phúc', $content);
        $this->assertStringContainsString('BN-SPECIAL-01', $content);
    }
}
