<?php

namespace Tests\Feature;

use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentApiTest extends TestCase
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
            'username' => 'pay_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'perm_user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'CUSTOM_ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Custom test role',
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
     * Helper to create a test invoice.
     */
    protected function createInvoice(array $overrides = []): Invoice
    {
        $patient = $this->createPatient();

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

    public function test_guest_cannot_access_payments_api(): void
    {
        $response = $this->getJson('/api/v1/payments');
        $response->assertStatus(401);

        $responsePost = $this->postJson('/api/v1/payments', [
            'invoice_id' => 1,
            'amount' => 100000,
            'payment_method' => 'CASH',
        ]);
        $responsePost->assertStatus(401);
    }

    public function test_user_without_permission_cannot_access_payments(): void
    {
        $user = $this->createUserWithPermissions(['users.view']);

        $responseGet = $this->authenticate($user)->getJson('/api/v1/payments');
        $responseGet->assertStatus(403);

        $invoice = $this->createInvoice(['total_amount' => 500000, 'remaining_amount' => 500000]);

        $responsePost = $this->authenticate($user)->postJson('/api/v1/payments', [
            'invoice_id' => $invoice->id,
            'amount' => 200000,
            'payment_method' => 'CASH',
        ]);
        $responsePost->assertStatus(403);
    }

    public function test_cashier_can_view_and_create_payments(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $invoice = $this->createInvoice(['total_amount' => 500000, 'remaining_amount' => 500000]);

        $response = $this->authenticate($cashier)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 250000,
            'payment_method' => 'CASH',
            'notes' => 'Thu tiền mặt đợt 1',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 250000)
            ->assertJsonPath('data.payment_method', 'CASH');
    }

    public function test_multi_installment_payment_lifecycle_unpaid_to_partial_to_paid(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice([
            'subtotal_amount' => 1000000,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'paid_amount' => 0,
            'remaining_amount' => 1000000,
            'status' => 'UNPAID',
        ]);

        // Đợt 1: Thu 300,000 VND
        $response1 = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 300000,
            'payment_method' => 'CASH',
            'notes' => 'Đợt 1 đặt cọc',
        ]);

        $response1->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 300000)
            ->assertJsonPath('data.invoice.status', 'PARTIAL')
            ->assertJsonPath('data.invoice.paid_amount', 300000)
            ->assertJsonPath('data.invoice.remaining_amount', 700000);

        $invoice->refresh();
        $this->assertEquals('PARTIAL', $invoice->status);
        $this->assertEquals(300000, (float) $invoice->paid_amount);
        $this->assertEquals(700000, (float) $invoice->remaining_amount);

        // Kiểm tra bút toán sổ quỹ tự sinh
        $payment1Id = $response1->json('data.id');
        $this->assertDatabaseHas('cash_transactions', [
            'reference_type' => 'Payment',
            'reference_id' => $payment1Id,
            'transaction_type' => 'IN',
            'amount' => 300000,
            'payment_method' => 'CASH',
        ]);

        // Đợt 2: Thu 400,000 VND qua chuyển khoản bằng POST /api/v1/payments (invoice_id in body)
        $response2 = $this->authenticate($admin)->postJson('/api/v1/payments', [
            'invoice_id' => $invoice->id,
            'amount' => 400000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_code' => 'FT2610279999',
            'notes' => 'Đợt 2 chuyển khoản ngân hàng',
        ]);

        $response2->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 400000)
            ->assertJsonPath('data.invoice.status', 'PARTIAL')
            ->assertJsonPath('data.invoice.paid_amount', 700000)
            ->assertJsonPath('data.invoice.remaining_amount', 300000);

        $invoice->refresh();
        $this->assertEquals('PARTIAL', $invoice->status);
        $this->assertEquals(700000, (float) $invoice->paid_amount);
        $this->assertEquals(300000, (float) $invoice->remaining_amount);

        // Đợt 3: Thu tất toán 300,000 VND bằng quẹt thẻ
        $response3 = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 300000,
            'payment_method' => 'CARD',
            'reference_code' => 'POS-888888',
            'notes' => 'Đợt 3 tất toán quẹt thẻ',
        ]);

        $response3->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 300000)
            ->assertJsonPath('data.invoice.status', 'PAID')
            ->assertJsonPath('data.invoice.paid_amount', 1000000)
            ->assertJsonPath('data.invoice.remaining_amount', 0);

        $invoice->refresh();
        $this->assertEquals('PAID', $invoice->status);
        $this->assertEquals(1000000, (float) $invoice->paid_amount);
        $this->assertEquals(0, (float) $invoice->remaining_amount);
        $this->assertCount(3, $invoice->payments);
    }

    public function test_payment_synchronizes_visit_payment_status(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();

        $doctor = Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác sĩ A',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV'.fake()->unique()->numerify('######'),
            'name' => 'Khám tổng quát',
            'price' => 500000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'LK'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'unit_price' => 500000,
            'quantity' => 1,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => 'UNPAID',
            'status' => 'COMPLETED',
        ]);

        $invoice = Invoice::create([
            'invoice_code' => 'INV-'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'paid_amount' => 0,
            'remaining_amount' => 500000,
            'status' => 'UNPAID',
            'issued_at' => now(),
        ]);

        // Thanh toán một phần -> visit chuyển sang PARTIAL
        $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 200000,
            'payment_method' => 'CASH',
        ])->assertStatus(201);

        $visit->refresh();
        $this->assertEquals('PARTIAL', $visit->payment_status);

        // Thanh toán phần còn lại -> visit chuyển sang PAID
        $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 300000,
            'payment_method' => 'CASH',
        ])->assertStatus(201);

        $visit->refresh();
        $this->assertEquals('PAID', $visit->payment_status);
    }

    public function test_cannot_pay_more_than_remaining_amount(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice([
            'total_amount' => 500000,
            'paid_amount' => 200000,
            'remaining_amount' => 300000,
            'status' => 'PARTIAL',
        ]);

        // Cố thanh toán vượt nợ (300,001 VND)
        $response = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 300001,
            'payment_method' => 'CASH',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['amount']]);

        // Số dư hóa đơn không đổi
        $invoice->refresh();
        $this->assertEquals(200000, (float) $invoice->paid_amount);
        $this->assertEquals(300000, (float) $invoice->remaining_amount);
    }

    public function test_cannot_pay_fully_paid_invoice(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice([
            'total_amount' => 500000,
            'paid_amount' => 500000,
            'remaining_amount' => 0,
            'status' => 'PAID',
        ]);

        $response = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 50000,
            'payment_method' => 'CASH',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['invoice_id']]);
    }

    public function test_cannot_pay_cancelled_invoice(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice([
            'total_amount' => 500000,
            'paid_amount' => 0,
            'remaining_amount' => 0,
            'status' => 'CANCELLED',
        ]);

        $response = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 100000,
            'payment_method' => 'CASH',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['invoice_id']]);
    }

    public function test_cannot_pay_with_zero_or_negative_amount(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice(['total_amount' => 500000, 'remaining_amount' => 500000]);

        // 0 VND
        $responseZero = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 0,
            'payment_method' => 'CASH',
        ]);
        $responseZero->assertStatus(422);

        // Số âm
        $responseNegative = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => -50000,
            'payment_method' => 'CASH',
        ]);
        $responseNegative->assertStatus(422);
    }

    public function test_cannot_pay_with_invalid_payment_method(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice(['total_amount' => 500000, 'remaining_amount' => 500000]);

        $response = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 100000,
            'payment_method' => 'CRYPTO',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['payment_method']]);
    }

    public function test_auto_cashbook_entry_and_audit_log_created_on_payment(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice(['total_amount' => 1000000, 'remaining_amount' => 1000000]);

        $response = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 450000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_code' => 'VIB123456789',
            'notes' => 'Chuyển khoản qua VIB',
        ]);

        $response->assertStatus(201);
        $paymentId = $response->json('data.id');

        // Bút toán sổ quỹ tự động
        $cashTransaction = CashTransaction::where('reference_type', 'Payment')
            ->where('reference_id', $paymentId)
            ->first();

        $this->assertNotNull($cashTransaction);
        $this->assertStringStartsWith('CTX-', $cashTransaction->transaction_code);
        $this->assertEquals('IN', $cashTransaction->transaction_type);
        $this->assertEquals(450000, (float) $cashTransaction->amount);
        $this->assertEquals('BANK_TRANSFER', $cashTransaction->payment_method);
        $this->assertEquals($admin->id, $cashTransaction->created_by);

        // Audit Log
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'payments',
            'action' => 'create_payment',
            'table_name' => 'payments',
            'record_id' => (string) $paymentId,
            'user_id' => $admin->id,
        ]);
    }

    public function test_index_payments_with_search_and_filters(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice1 = $this->createInvoice(['total_amount' => 500000, 'remaining_amount' => 500000]);
        $invoice2 = $this->createInvoice(['total_amount' => 800000, 'remaining_amount' => 800000]);

        $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice1->id}/payments", [
            'amount' => 200000,
            'payment_method' => 'CASH',
            'reference_code' => 'REF-001',
        ])->assertStatus(201);

        $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice2->id}/payments", [
            'amount' => 300000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_code' => 'REF-002',
        ])->assertStatus(201);

        // Lọc theo invoice_id
        $resInvoice = $this->authenticate($admin)->getJson("/api/v1/payments?invoice_id={$invoice1->id}");
        $resInvoice->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.invoice_id', $invoice1->id);

        // Lọc theo payment_method
        $resMethod = $this->authenticate($admin)->getJson('/api/v1/payments?payment_method=BANK_TRANSFER');
        $resMethod->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.payment_method', 'BANK_TRANSFER');

        // Tìm kiếm theo reference_code
        $resSearch = $this->authenticate($admin)->getJson('/api/v1/payments?search=REF-001');
        $resSearch->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference_code', 'REF-001');
    }

    public function test_show_payment_details(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $invoice = $this->createInvoice(['total_amount' => 500000, 'remaining_amount' => 500000]);

        $createRes = $this->authenticate($admin)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 200000,
            'payment_method' => 'CARD',
            'reference_code' => 'POS-999',
            'notes' => 'Chi tiết phiếu thu test',
        ]);
        $paymentId = $createRes->json('data.id');

        $showRes = $this->authenticate($admin)->getJson("/api/v1/payments/{$paymentId}");
        $showRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $paymentId)
            ->assertJsonPath('data.payment_method', 'CARD')
            ->assertJsonPath('data.reference_code', 'POS-999')
            ->assertJsonPath('data.amount', 200000)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'payment_code',
                    'invoice_id',
                    'amount',
                    'payment_method',
                    'reference_code',
                    'payment_date',
                    'notes',
                    'invoice',
                    'receiver',
                    'cash_transactions',
                ],
            ]);
    }
}
