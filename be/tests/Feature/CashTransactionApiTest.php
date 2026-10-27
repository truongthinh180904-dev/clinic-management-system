<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashTransactionApiTest extends TestCase
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
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'cash_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'perm_cash_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ROLE_CASH_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for cashbook',
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
        $token = $user->createToken('test_token')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    /**
     * Helper to create a test invoice for payment symmetry tests.
     */
    protected function createInvoice(array $overrides = []): Invoice
    {
        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'gender' => 'FEMALE',
            'status' => 'ACTIVE',
        ]);

        $subtotal = $overrides['subtotal_amount'] ?? 1000000.00;
        $discount = $overrides['discount_amount'] ?? 0.00;
        $total = $overrides['total_amount'] ?? ($subtotal - $discount);
        $paid = $overrides['paid_amount'] ?? 0.00;
        $remaining = $overrides['remaining_amount'] ?? ($total - $paid);
        $status = $overrides['status'] ?? ($remaining == 0.0 ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID'));

        return Invoice::create(array_merge([
            'invoice_code' => 'INV-'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'subtotal_amount' => $subtotal,
            'discount_amount' => $discount,
            'total_amount' => $total,
            'paid_amount' => $paid,
            'remaining_amount' => $remaining,
            'status' => $status,
            'issued_at' => now(),
        ], $overrides));
    }

    public function test_guest_cannot_access_cash_transactions_api(): void
    {
        $this->getJson('/api/v1/cash-transactions')->assertStatus(401);
        $this->getJson('/api/v1/cash-transactions/summary')->assertStatus(401);
        $this->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'IN',
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(401);
    }

    public function test_user_without_permission_cannot_view_or_create_cash_transactions(): void
    {
        $userWithoutPerm = $this->createUserWithPermissions(['users.view']);

        $this->authenticate($userWithoutPerm)->getJson('/api/v1/cash-transactions')->assertStatus(403);
        $this->authenticate($userWithoutPerm)->getJson('/api/v1/cash-transactions/summary')->assertStatus(403);
        $this->authenticate($userWithoutPerm)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'IN',
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(403);
    }

    public function test_user_with_view_permission_can_list_and_summarize_but_not_create(): void
    {
        $viewUser = $this->createUserWithPermissions(['cash_transactions.view']);

        $this->authenticate($viewUser)->getJson('/api/v1/cash-transactions')
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->authenticate($viewUser)->getJson('/api/v1/cash-transactions/summary')
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->authenticate($viewUser)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'IN',
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(403);
    }

    public function test_user_can_create_manual_cash_in_transaction(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'IN',
            'amount' => 5000000,
            'payment_method' => 'CASH',
            'description' => 'Nộp tiền mặt quỹ đầu kỳ',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.transaction_type', 'IN')
            ->assertJsonPath('data.amount', 5000000)
            ->assertJsonPath('data.payment_method', 'CASH')
            ->assertJsonPath('data.description', 'Nộp tiền mặt quỹ đầu kỳ')
            ->assertJsonPath('data.created_by', $admin->id);

        $txCode = $response->json('data.transaction_code');
        $this->assertNotEmpty($txCode);
        $this->assertStringStartsWith('CTX-', $txCode);

        // Verify AuditLog creation
        $txId = $response->json('data.id');
        $log = AuditLog::where('module', 'cash_transactions')
            ->where('record_id', (string) $txId)
            ->where('action', 'create_cash_transaction')
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($admin->id, $log->user_id);
    }

    public function test_user_can_create_manual_cash_out_transaction_with_custom_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_code' => 'CTX-MANUAL-888',
            'transaction_type' => 'OUT',
            'amount' => 1200000,
            'payment_method' => 'BANK_TRANSFER',
            'description' => 'Rút quỹ gửi vào tài khoản ngân hàng phòng khám',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.transaction_code', 'CTX-MANUAL-888')
            ->assertJsonPath('data.transaction_type', 'OUT')
            ->assertJsonPath('data.amount', 1200000)
            ->assertJsonPath('data.payment_method', 'BANK_TRANSFER');

        $this->assertDatabaseHas('cash_transactions', [
            'transaction_code' => 'CTX-MANUAL-888',
            'transaction_type' => 'OUT',
            'amount' => 1200000.00,
            'payment_method' => 'BANK_TRANSFER',
        ]);
    }

    public function test_cannot_create_cash_transaction_with_invalid_data(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Missing required fields
        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_type', 'amount', 'payment_method']);

        // Zero amount
        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'IN',
            'amount' => 0,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        // Negative amount
        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'OUT',
            'amount' => -50000,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        // Invalid transaction type
        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'TRANSFER',
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['transaction_type']);

        // Invalid payment method
        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_type' => 'IN',
            'amount' => 100000,
            'payment_method' => 'CRYPTO',
        ])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);

        // Duplicate custom transaction_code
        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_code' => 'CTX-DUP-001',
            'transaction_type' => 'IN',
            'amount' => 200000,
            'payment_method' => 'CASH',
        ])->assertStatus(201);

        $this->authenticate($admin)->postJson('/api/v1/cash-transactions', [
            'transaction_code' => 'CTX-DUP-001',
            'transaction_type' => 'OUT',
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['transaction_code']);
    }

    public function test_can_filter_cash_transactions_by_type_and_method(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        CashTransaction::create([
            'transaction_code' => 'CTX-000010',
            'transaction_type' => 'IN',
            'amount' => 1000000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'description' => 'Thu tiền mặt 1',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        CashTransaction::create([
            'transaction_code' => 'CTX-000011',
            'transaction_type' => 'IN',
            'amount' => 2000000,
            'payment_method' => 'BANK_TRANSFER',
            'transaction_date' => now(),
            'description' => 'Thu chuyển khoản 2',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        CashTransaction::create([
            'transaction_code' => 'CTX-000012',
            'transaction_type' => 'OUT',
            'amount' => 300000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'description' => 'Chi tiền mặt 3',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        CashTransaction::create([
            'transaction_code' => 'CTX-000013',
            'transaction_type' => 'OUT',
            'amount' => 400000,
            'payment_method' => 'CARD',
            'transaction_date' => now(),
            'description' => 'Chi quẹt thẻ 4',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        // Filter IN
        $resIn = $this->authenticate($admin)->getJson('/api/v1/cash-transactions?transaction_type=IN');
        $resIn->assertStatus(200);
        $this->assertCount(2, $resIn->json('data'));

        // Filter OUT
        $resOut = $this->authenticate($admin)->getJson('/api/v1/cash-transactions?transaction_type=OUT');
        $resOut->assertStatus(200);
        $this->assertCount(2, $resOut->json('data'));

        // Filter CASH
        $resCash = $this->authenticate($admin)->getJson('/api/v1/cash-transactions?payment_method=CASH');
        $resCash->assertStatus(200);
        $this->assertCount(2, $resCash->json('data'));

        // Filter BANK_TRANSFER
        $resBank = $this->authenticate($admin)->getJson('/api/v1/cash-transactions?payment_method=BANK_TRANSFER');
        $resBank->assertStatus(200);
        $this->assertCount(1, $resBank->json('data'));
    }

    public function test_can_filter_cash_transactions_by_date_range_and_search_keyword(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        CashTransaction::create([
            'transaction_code' => 'CTX-SEARCH-01',
            'transaction_type' => 'IN',
            'amount' => 500000,
            'payment_method' => 'CASH',
            'transaction_date' => Carbon::parse('2026-10-10 10:00:00'),
            'description' => 'Mua thiết bị bảo hộ đặc biệt',
            'created_by' => $admin->id,
            'created_at' => Carbon::parse('2026-10-10 10:00:00'),
        ]);

        CashTransaction::create([
            'transaction_code' => 'CTX-SEARCH-02',
            'transaction_type' => 'OUT',
            'amount' => 300000,
            'payment_method' => 'CASH',
            'transaction_date' => Carbon::parse('2026-10-25 15:00:00'),
            'description' => 'Tiền điện sinh hoạt',
            'created_by' => $admin->id,
            'created_at' => Carbon::parse('2026-10-25 15:00:00'),
        ]);

        // Search by keyword
        $resSearch = $this->authenticate($admin)->getJson('/api/v1/cash-transactions?search=bảo hộ đặc biệt');
        $resSearch->assertStatus(200);
        $this->assertCount(1, $resSearch->json('data'));
        $this->assertEquals('CTX-SEARCH-01', $resSearch->json('data.0.transaction_code'));

        // Date range filter matching only second transaction
        $resDate = $this->authenticate($admin)->getJson('/api/v1/cash-transactions?start_date=2026-10-20&end_date=2026-10-30');
        $resDate->assertStatus(200);
        $this->assertCount(1, $resDate->json('data'));
        $this->assertEquals('CTX-SEARCH-02', $resDate->json('data.0.transaction_code'));
    }

    public function test_can_view_single_cash_transaction(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $tx = CashTransaction::create([
            'transaction_code' => 'CTX-DETAIL-001',
            'transaction_type' => 'IN',
            'amount' => 850000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'description' => 'Giao dịch xem chi tiết',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)->getJson("/api/v1/cash-transactions/{$tx->id}");
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $tx->id)
            ->assertJsonPath('data.transaction_code', 'CTX-DETAIL-001')
            ->assertJsonPath('data.amount', 850000);

        // Not found
        $this->authenticate($admin)->getJson('/api/v1/cash-transactions/9999999')->assertStatus(404);
    }

    public function test_symmetry_between_payment_in_and_expense_out(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // 1. Thu tiền thanh toán viện phí -> tự động sinh CashTransaction (IN)
        $invoice = $this->createInvoice([
            'total_amount' => 1500000,
            'remaining_amount' => 1500000,
            'paid_amount' => 0,
            'status' => 'UNPAID',
        ]);

        $payRes = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 1500000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_code' => 'VIB-TX-12345',
            'notes' => 'Thanh toán viện phí đầy đủ',
        ]);
        $payRes->assertStatus(201);
        $paymentId = $payRes->json('data.id');

        $inTx = CashTransaction::where('reference_type', 'Payment')
            ->where('reference_id', $paymentId)
            ->first();
        $this->assertNotNull($inTx);
        $this->assertEquals('IN', $inTx->transaction_type);
        $this->assertEquals(1500000, (float) $inTx->amount);
        $this->assertEquals('BANK_TRANSFER', $inTx->payment_method);

        // 2. Chi tiền hoạt động phòng khám (Expense OUT)
        $category = ExpenseCategory::create([
            'name' => 'Chi phí vật tư y tế',
            'description' => 'Mua cồn sát khuẩn',
            'status' => 'ACTIVE',
        ]);

        $expense = Expense::create([
            'expense_code' => 'EXP-000001',
            'category_id' => $category->id,
            'amount' => 500000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => now(),
            'description' => 'Mua cồn y tế dự phòng',
            'approval_status' => 'APPROVED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        $outTx = CashTransaction::create([
            'transaction_code' => 'CTX-000099',
            'transaction_type' => 'OUT',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'amount' => 500000,
            'payment_method' => 'BANK_TRANSFER',
            'transaction_date' => now(),
            'description' => 'Chi tiền theo phiếu EXP-000001',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);
        $this->assertNotNull($outTx);

        // 3. Đối chiếu báo cáo tổng hợp sổ quỹ (/summary)
        $summaryRes = $this->authenticate($admin)->getJson('/api/v1/cash-transactions/summary');
        $summaryRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_in', 1500000)
            ->assertJsonPath('data.total_out', 500000)
            ->assertJsonPath('data.net_change', 1000000)
            ->assertJsonPath('data.closing_balance', 1000000)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.total_in', 1500000)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.total_out', 500000)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.net_change', 1000000)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.closing_balance', 1000000);
    }

    public function test_cashbook_summary_calculates_opening_balance_and_period_closing_balance(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Giao dịch kỳ trước (5 ngày trước):
        // +3,000,000 tiền mặt (IN)
        // -1,000,000 tiền mặt (OUT)
        // => Tồn đầu kỳ = 2,000,000
        CashTransaction::create([
            'transaction_code' => 'CTX-PRIOR-01',
            'transaction_type' => 'IN',
            'amount' => 3000000,
            'payment_method' => 'CASH',
            'transaction_date' => Carbon::parse('2026-10-01 09:00:00'),
            'description' => 'Thu đầu kỳ',
            'created_by' => $admin->id,
            'created_at' => Carbon::parse('2026-10-01 09:00:00'),
        ]);

        CashTransaction::create([
            'transaction_code' => 'CTX-PRIOR-02',
            'transaction_type' => 'OUT',
            'amount' => 1000000,
            'payment_method' => 'CASH',
            'transaction_date' => Carbon::parse('2026-10-02 14:00:00'),
            'description' => 'Chi đầu kỳ',
            'created_by' => $admin->id,
            'created_at' => Carbon::parse('2026-10-02 14:00:00'),
        ]);

        // Giao dịch trong kỳ (từ 2026-10-05 đến 2026-10-10):
        // +2,500,000 chuyển khoản (IN)
        // -500,000 tiền mặt (OUT)
        CashTransaction::create([
            'transaction_code' => 'CTX-INPERIOD-01',
            'transaction_type' => 'IN',
            'amount' => 2500000,
            'payment_method' => 'BANK_TRANSFER',
            'transaction_date' => Carbon::parse('2026-10-06 10:00:00'),
            'description' => 'Thu trong kỳ chuyển khoản',
            'created_by' => $admin->id,
            'created_at' => Carbon::parse('2026-10-06 10:00:00'),
        ]);

        CashTransaction::create([
            'transaction_code' => 'CTX-INPERIOD-02',
            'transaction_type' => 'OUT',
            'amount' => 500000,
            'payment_method' => 'CASH',
            'transaction_date' => Carbon::parse('2026-10-08 11:00:00'),
            'description' => 'Chi trong kỳ tiền mặt',
            'created_by' => $admin->id,
            'created_at' => Carbon::parse('2026-10-08 11:00:00'),
        ]);

        // Gọi báo cáo kỳ 2026-10-05 đến 2026-10-10
        $response = $this->authenticate($admin)->getJson('/api/v1/cash-transactions/summary?start_date=2026-10-05&end_date=2026-10-10');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.opening_balance', 2000000)
            ->assertJsonPath('data.total_in', 2500000)
            ->assertJsonPath('data.total_out', 500000)
            ->assertJsonPath('data.net_change', 2000000)
            ->assertJsonPath('data.closing_balance', 4000000);

        // Kiểm tra phân tách theo tiền mặt CASH:
        // Tồn đầu kỳ: 2,000,000; Thu trong kỳ: 0; Chi trong kỳ: 500,000; Tồn cuối: 1,500,000
        $response->assertJsonPath('data.by_payment_method.CASH.opening_balance', 2000000)
            ->assertJsonPath('data.by_payment_method.CASH.total_in', 0)
            ->assertJsonPath('data.by_payment_method.CASH.total_out', 500000)
            ->assertJsonPath('data.by_payment_method.CASH.net_change', -500000)
            ->assertJsonPath('data.by_payment_method.CASH.closing_balance', 1500000);

        // Kiểm tra phân tách theo chuyển khoản BANK_TRANSFER:
        // Tồn đầu: 0; Thu trong kỳ: 2,500,000; Chi: 0; Tồn cuối: 2,500,000
        $response->assertJsonPath('data.by_payment_method.BANK_TRANSFER.opening_balance', 0)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.total_in', 2500000)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.total_out', 0)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.net_change', 2500000)
            ->assertJsonPath('data.by_payment_method.BANK_TRANSFER.closing_balance', 2500000);
    }

    public function test_cashbook_alias_routes_work_identically(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        CashTransaction::create([
            'transaction_code' => 'CTX-ALIAS-01',
            'transaction_type' => 'IN',
            'amount' => 100000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'description' => 'Test alias route',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $resIndex = $this->authenticate($admin)->getJson('/api/v1/cashbook');
        $resIndex->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertNotEmpty($resIndex->json('data'));

        $resSummary = $this->authenticate($admin)->getJson('/api/v1/cashbook/summary');
        $resSummary->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_in', 100000)
            ->assertJsonPath('data.closing_balance', 100000);
    }
}
