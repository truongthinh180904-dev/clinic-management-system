<?php

namespace Tests\Feature;

use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpenseApiTest extends TestCase
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
            'username' => 'exp_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'perm_exp_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ROLE_EXP_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for expenses',
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
     * Helper to create a test expense category.
     */
    protected function createCategory(array $overrides = []): ExpenseCategory
    {
        return ExpenseCategory::create(array_merge([
            'name' => 'Danh mục chi '.fake()->unique()->numerify('####'),
            'description' => 'Mô tả danh mục mẫu',
            'status' => 'ACTIVE',
        ], $overrides));
    }

    public function test_guest_cannot_access_expense_endpoints(): void
    {
        $this->getJson('/api/v1/expense-categories')->assertStatus(401);
        $this->postJson('/api/v1/expense-categories', ['name' => 'Test'])->assertStatus(401);
        $this->getJson('/api/v1/expense-categories/1')->assertStatus(401);
        $this->putJson('/api/v1/expense-categories/1', ['name' => 'Update'])->assertStatus(401);
        $this->deleteJson('/api/v1/expense-categories/1')->assertStatus(401);

        $this->getJson('/api/v1/expenses')->assertStatus(401);
        $this->postJson('/api/v1/expenses', [])->assertStatus(401);
        $this->getJson('/api/v1/expenses/1')->assertStatus(401);
        $this->putJson('/api/v1/expenses/1', [])->assertStatus(401);
        $this->patchJson('/api/v1/expenses/1/approve')->assertStatus(401);
        $this->patchJson('/api/v1/expenses/1/reject', ['reason' => 'test'])->assertStatus(401);
        $this->deleteJson('/api/v1/expenses/1')->assertStatus(401);
    }

    public function test_user_without_permissions_is_forbidden(): void
    {
        $user = $this->createUserWithPermissions(['patients.view']);
        $cat = $this->createCategory();

        $this->authenticate($user)->getJson('/api/v1/expense-categories')->assertStatus(403);
        $this->authenticate($user)->postJson('/api/v1/expense-categories', ['name' => 'Chi phí mới'])->assertStatus(403);

        $this->authenticate($user)->getJson('/api/v1/expenses')->assertStatus(403);
        $this->authenticate($user)->postJson('/api/v1/expenses', [
            'category_id' => $cat->id,
            'amount' => 500000,
            'payment_method' => 'CASH',
        ])->assertStatus(403);
    }

    public function test_can_crud_expense_categories(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $this->authenticate($accountant);

        // 1. Create category
        $response = $this->postJson('/api/v1/expense-categories', [
            'name' => 'Vật tư tiêu hao y tế',
            'description' => 'Bông băng, kim tiêm, găng tay',
            'status' => 'ACTIVE',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Vật tư tiêu hao y tế')
            ->assertJsonPath('data.status', 'ACTIVE');

        $catId = $response->json('data.id');

        // Verify AuditLog
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'expenses',
            'action' => 'create_category',
            'record_id' => (string) $catId,
        ]);

        // 2. Cannot create duplicate category name
        $this->postJson('/api/v1/expense-categories', [
            'name' => 'Vật tư tiêu hao y tế',
        ])->assertStatus(422)->assertJsonValidationErrors(['name']);

        // 3. List categories
        $listRes = $this->getJson('/api/v1/expense-categories?search=tiêu hao');
        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertCount(1, $listRes->json('data'));

        // 4. Show category
        $showRes = $this->getJson("/api/v1/expense-categories/{$catId}");
        $showRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Vật tư tiêu hao y tế');

        // 5. Update category
        $updateRes = $this->putJson("/api/v1/expense-categories/{$catId}", [
            'name' => 'Vật tư tiêu hao y tế chuyên khoa',
            'description' => 'Cập nhật mô tả mới',
        ]);
        $updateRes->assertStatus(200)
            ->assertJsonPath('data.name', 'Vật tư tiêu hao y tế chuyên khoa');

        // 6. Delete empty category
        $delRes = $this->deleteJson("/api/v1/expense-categories/{$catId}");
        $delRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('expense_categories', ['id' => $catId]);
    }

    public function test_cannot_delete_category_with_existing_expenses(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $cat = $this->createCategory();

        Expense::create([
            'expense_code' => 'EXP-CAT-001',
            'category_id' => $cat->id,
            'amount' => 300000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'PENDING',
            'created_by' => $admin->id,
        ]);

        $this->deleteJson("/api/v1/expense-categories/{$cat->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('expense_categories', ['id' => $cat->id]);
    }

    public function test_user_can_create_expense_voucher_and_creates_approval_request(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $this->authenticate($accountant);

        $cat = $this->createCategory();

        $payload = [
            'category_id' => $cat->id,
            'amount' => 1500000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => '2026-10-25 10:30:00',
            'description' => 'Thanh toán tiền điện phòng khám tháng 10',
        ];

        $response = $this->postJson('/api/v1/expenses', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.amount', 1500000)
            ->assertJsonPath('data.payment_method', 'BANK_TRANSFER')
            ->assertJsonPath('data.approval_status', 'PENDING')
            ->assertJsonPath('data.category_id', $cat->id)
            ->assertJsonPath('data.created_by', $accountant->id);

        $expenseId = $response->json('data.id');
        $expenseCode = $response->json('data.expense_code');

        $this->assertNotEmpty($expenseCode);
        $this->assertStringStartsWith('EXP-', $expenseCode);

        // Verify that ApprovalRequest was automatically created
        $approval = ApprovalRequest::where('request_type', 'EXPENSE_APPROVAL')
            ->where('reference_type', 'Expense')
            ->where('reference_id', $expenseId)
            ->first();

        $this->assertNotNull($approval);
        $this->assertEquals('PENDING', $approval->status);
        $this->assertEquals($accountant->id, $approval->requested_by);
        $this->assertStringContainsString('Thanh toán tiền điện', $approval->reason);

        // Verify AuditLog
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'expenses',
            'action' => 'create_expense',
            'record_id' => (string) $expenseId,
            'user_id' => $accountant->id,
        ]);
    }

    public function test_user_can_create_expense_with_custom_code(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $this->authenticate($accountant);
        $cat = $this->createCategory();

        $response = $this->postJson('/api/v1/expenses', [
            'expense_code' => 'EXP-CUSTOM-777',
            'category_id' => $cat->id,
            'amount' => 500000,
            'payment_method' => 'CASH',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.expense_code', 'EXP-CUSTOM-777');

        $this->assertDatabaseHas('expenses', [
            'expense_code' => 'EXP-CUSTOM-777',
            'amount' => 500000.00,
        ]);
    }

    public function test_cannot_create_expense_with_invalid_data(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $this->authenticate($accountant);
        $cat = $this->createCategory();

        // 1. Missing required fields
        $this->postJson('/api/v1/expenses', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category_id', 'amount', 'payment_method']);

        // 2. Non-existent category_id
        $this->postJson('/api/v1/expenses', [
            'category_id' => 999999,
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['category_id']);

        // 3. Amount <= 0
        $this->postJson('/api/v1/expenses', [
            'category_id' => $cat->id,
            'amount' => 0,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $this->postJson('/api/v1/expenses', [
            'category_id' => $cat->id,
            'amount' => -50000,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        // 4. Invalid payment method
        $this->postJson('/api/v1/expenses', [
            'category_id' => $cat->id,
            'amount' => 100000,
            'payment_method' => 'CRYPTO',
        ])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);

        // 5. Duplicate expense_code
        $this->postJson('/api/v1/expenses', [
            'expense_code' => 'EXP-DUP-001',
            'category_id' => $cat->id,
            'amount' => 100000,
            'payment_method' => 'CASH',
        ])->assertStatus(201);

        $this->postJson('/api/v1/expenses', [
            'expense_code' => 'EXP-DUP-001',
            'category_id' => $cat->id,
            'amount' => 200000,
            'payment_method' => 'CASH',
        ])->assertStatus(422)->assertJsonValidationErrors(['expense_code']);
    }

    public function test_can_list_expenses_with_filters_and_search(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $cat1 = $this->createCategory(['name' => 'Chi phí văn phòng']);
        $cat2 = $this->createCategory(['name' => 'Chi phí y tế']);

        Expense::create([
            'expense_code' => 'EXP-FLT-001',
            'category_id' => $cat1->id,
            'amount' => 400000,
            'payment_method' => 'CASH',
            'expense_date' => Carbon::parse('2026-10-10 10:00:00'),
            'description' => 'Mua giấy in nhiệt A4',
            'approval_status' => 'PENDING',
            'created_by' => $admin->id,
        ]);

        Expense::create([
            'expense_code' => 'EXP-FLT-002',
            'category_id' => $cat2->id,
            'amount' => 2500000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => Carbon::parse('2026-10-20 14:00:00'),
            'description' => 'Bảo trì máy siêu âm màu',
            'approval_status' => 'APPROVED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        Expense::create([
            'expense_code' => 'EXP-FLT-003',
            'category_id' => $cat1->id,
            'amount' => 1000000,
            'payment_method' => 'CARD',
            'expense_date' => Carbon::parse('2026-10-25 09:00:00'),
            'description' => 'Mua bình chữa cháy',
            'approval_status' => 'REJECTED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        // 1. Filter by approval_status
        $resPending = $this->getJson('/api/v1/expenses?approval_status=PENDING');
        $resPending->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->assertEquals('EXP-FLT-001', $resPending->json('data.0.expense_code'));

        $resApproved = $this->getJson('/api/v1/expenses?approval_status=APPROVED');
        $resApproved->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->assertEquals('EXP-FLT-002', $resApproved->json('data.0.expense_code'));

        // 2. Filter by category_id
        $resCat = $this->getJson("/api/v1/expenses?category_id={$cat1->id}");
        $resCat->assertStatus(200)->assertJsonPath('meta.total', 2);

        // 3. Filter by payment_method
        $resCard = $this->getJson('/api/v1/expenses?payment_method=CARD');
        $resCard->assertStatus(200)->assertJsonPath('meta.total', 1);

        // 4. Search keyword
        $resSearch = $this->getJson('/api/v1/expenses?search=siêu âm');
        $resSearch->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->assertEquals('EXP-FLT-002', $resSearch->json('data.0.expense_code'));

        // 5. Date range
        $resDate = $this->getJson('/api/v1/expenses?start_date=2026-10-15&end_date=2026-10-22');
        $resDate->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->assertEquals('EXP-FLT-002', $resDate->json('data.0.expense_code'));
    }

    public function test_can_show_expense_details(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-SHOW-001',
            'category_id' => $cat->id,
            'amount' => 880000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'description' => 'Xem chi tiết phiếu chi',
            'approval_status' => 'PENDING',
            'created_by' => $admin->id,
        ]);

        $response = $this->getJson("/api/v1/expenses/{$expense->id}");
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $expense->id)
            ->assertJsonPath('data.expense_code', 'EXP-SHOW-001')
            ->assertJsonPath('data.amount', 880000)
            ->assertJsonPath('data.category.id', $cat->id);
    }

    public function test_can_update_expense_when_pending(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);
        $cat1 = $this->createCategory();
        $cat2 = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-UPD-001',
            'category_id' => $cat1->id,
            'amount' => 500000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'description' => 'Mô tả cũ',
            'approval_status' => 'PENDING',
            'created_by' => $admin->id,
        ]);

        ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $admin->id,
            'status' => 'PENDING',
            'reason' => 'Mô tả cũ',
            'created_at' => now(),
        ]);

        $response = $this->putJson("/api/v1/expenses/{$expense->id}", [
            'category_id' => $cat2->id,
            'amount' => 650000,
            'description' => 'Mô tả đã được cập nhật',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.category_id', $cat2->id)
            ->assertJsonPath('data.amount', 650000)
            ->assertJsonPath('data.description', 'Mô tả đã được cập nhật');

        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'category_id' => $cat2->id,
            'amount' => 650000.00,
            'description' => 'Mô tả đã được cập nhật',
        ]);

        // ApprovalRequest reason is synchronized
        $this->assertDatabaseHas('approval_requests', [
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'reason' => 'Mô tả đã được cập nhật',
        ]);

        // AuditLog recorded
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'expenses',
            'action' => 'update_expense',
            'record_id' => (string) $expense->id,
        ]);
    }

    public function test_cannot_update_approved_or_rejected_expense(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);
        $cat = $this->createCategory();

        $approved = Expense::create([
            'expense_code' => 'EXP-NOUPD-001',
            'category_id' => $cat->id,
            'amount' => 500000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'APPROVED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        $rejected = Expense::create([
            'expense_code' => 'EXP-NOUPD-002',
            'category_id' => $cat->id,
            'amount' => 300000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'REJECTED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        $this->putJson("/api/v1/expenses/{$approved->id}", ['amount' => 600000])
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->putJson("/api/v1/expenses/{$rejected->id}", ['amount' => 400000])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_can_approve_expense_and_creates_cash_out_transaction(): void
    {
        $manager = $this->createUserWithRole('MANAGER');
        $this->authenticate($manager);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-APP-001',
            'category_id' => $cat->id,
            'amount' => 3200000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => Carbon::parse('2026-10-24 15:00:00'),
            'description' => 'Chi phí bảo dưỡng định kỳ máy X-quang',
            'approval_status' => 'PENDING',
            'created_by' => $manager->id,
        ]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $manager->id,
            'status' => 'PENDING',
            'reason' => 'Chi phí bảo dưỡng định kỳ máy X-quang',
            'created_at' => now(),
        ]);

        $response = $this->patchJson("/api/v1/expenses/{$expense->id}/approve");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.approval_status', 'APPROVED')
            ->assertJsonPath('data.approved_by', $manager->id);

        $this->assertNotNull($response->json('data.approved_at'));

        // Verify expense in database
        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'approval_status' => 'APPROVED',
            'approved_by' => $manager->id,
        ]);

        // Verify ApprovalRequest updated
        $this->assertEquals('APPROVED', $approval->fresh()->status);
        $this->assertEquals($manager->id, $approval->fresh()->approved_by);

        // Verify CashTransaction (OUT) automatically created
        $cashTx = CashTransaction::where('reference_type', 'Expense')
            ->where('reference_id', $expense->id)
            ->first();

        $this->assertNotNull($cashTx);
        $this->assertEquals('OUT', $cashTx->transaction_type);
        $this->assertEquals(3200000.00, (float) $cashTx->amount);
        $this->assertEquals('BANK_TRANSFER', $cashTx->payment_method);
        $this->assertEquals($manager->id, $cashTx->created_by);
        $this->assertStringStartsWith('CTX-', $cashTx->transaction_code);

        // Verify AuditLog
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'expenses',
            'action' => 'approve_expense',
            'record_id' => (string) $expense->id,
            'user_id' => $manager->id,
        ]);
    }

    public function test_cannot_approve_expense_twice(): void
    {
        $manager = $this->createUserWithRole('MANAGER');
        $this->authenticate($manager);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-APP-002',
            'category_id' => $cat->id,
            'amount' => 1000000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'PENDING',
            'created_by' => $manager->id,
        ]);

        // First approval succeeds
        $this->patchJson("/api/v1/expenses/{$expense->id}/approve")->assertStatus(200);

        // Second approval must fail with 422
        $resSecond = $this->patchJson("/api/v1/expenses/{$expense->id}/approve");
        $resSecond->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.approval_status.0', 'Phiếu chi này đã được xử lý trước đó.');

        // Verify only ONE CashTransaction was recorded
        $count = CashTransaction::where('reference_type', 'Expense')
            ->where('reference_id', $expense->id)
            ->count();
        $this->assertEquals(1, $count);
    }

    public function test_can_reject_expense_with_reason(): void
    {
        $manager = $this->createUserWithRole('MANAGER');
        $this->authenticate($manager);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-REJ-001',
            'category_id' => $cat->id,
            'amount' => 5000000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => now(),
            'description' => 'Mua thiết bị không rõ nguồn gốc',
            'approval_status' => 'PENDING',
            'created_by' => $manager->id,
        ]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $manager->id,
            'status' => 'PENDING',
            'reason' => 'Mua thiết bị không rõ nguồn gốc',
            'created_at' => now(),
        ]);

        // Rejection without reason fails with 422
        $this->patchJson("/api/v1/expenses/{$expense->id}/reject", [])
            ->assertStatus(422);

        // Rejection with reason succeeds
        $response = $this->patchJson("/api/v1/expenses/{$expense->id}/reject", [
            'reason' => 'Nhà cung cấp chưa có hóa đơn VAT hợp lệ',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.approval_status', 'REJECTED')
            ->assertJsonPath('data.rejection_reason', 'Nhà cung cấp chưa có hóa đơn VAT hợp lệ');

        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'approval_status' => 'REJECTED',
            'approved_by' => $manager->id,
        ]);

        $this->assertEquals('REJECTED', $approval->fresh()->status);
        $this->assertEquals('Nhà cung cấp chưa có hóa đơn VAT hợp lệ', $approval->fresh()->rejection_reason);

        // Ensure NO CashTransaction is generated
        $this->assertDatabaseMissing('cash_transactions', [
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
        ]);

        // Verify AuditLog
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'expenses',
            'action' => 'reject_expense',
            'record_id' => (string) $expense->id,
            'user_id' => $manager->id,
        ]);
    }

    public function test_cannot_reject_already_approved_or_rejected_expense(): void
    {
        $manager = $this->createUserWithRole('MANAGER');
        $this->authenticate($manager);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-REJ-002',
            'category_id' => $cat->id,
            'amount' => 1000000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'APPROVED',
            'created_by' => $manager->id,
            'approved_by' => $manager->id,
            'approved_at' => now(),
        ]);

        $this->patchJson("/api/v1/expenses/{$expense->id}/reject", [
            'reason' => 'Từ chối sau khi đã duyệt',
        ])->assertStatus(422)->assertJsonPath('success', false);
    }

    public function test_can_delete_pending_expense(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-DEL-001',
            'category_id' => $cat->id,
            'amount' => 700000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'PENDING',
            'created_by' => $admin->id,
        ]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $admin->id,
            'status' => 'PENDING',
            'created_at' => now(),
        ]);

        $response = $this->deleteJson("/api/v1/expenses/{$expense->id}");
        $response->assertStatus(200)->assertJsonPath('success', true);

        $this->assertDatabaseMissing('expenses', ['id' => $expense->id]);
        $this->assertDatabaseMissing('approval_requests', ['id' => $approval->id]);
    }

    public function test_cannot_delete_approved_expense(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);
        $cat = $this->createCategory();

        $expense = Expense::create([
            'expense_code' => 'EXP-DEL-002',
            'category_id' => $cat->id,
            'amount' => 900000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'APPROVED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        $this->deleteJson("/api/v1/expenses/{$expense->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('expenses', ['id' => $expense->id]);
    }
}
