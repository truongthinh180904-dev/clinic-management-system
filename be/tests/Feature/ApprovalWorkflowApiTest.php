<?php

namespace Tests\Feature;

use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApprovalWorkflowApiTest extends TestCase
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
            'username' => 'appr_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'perm_appr_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ROLE_APPR_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for approvals',
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
     * Helper to create an Expense record with Category.
     */
    protected function createExpense(User $creator, array $overrides = []): Expense
    {
        $category = ExpenseCategory::create([
            'name' => 'Chi phí vật tư y tế '.fake()->unique()->numerify('####'),
            'description' => 'Danh mục chi phí kiểm thử',
            'status' => 'ACTIVE',
        ]);

        return Expense::create(array_merge([
            'expense_code' => 'EXP-'.fake()->unique()->numerify('######'),
            'category_id' => $category->id,
            'amount' => 500000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'description' => 'Mua vật tư tiêu hao phòng khám',
            'approval_status' => 'PENDING',
            'created_by' => $creator->id,
        ], $overrides));
    }

    // ==========================================
    // 1. LISTING & FILTERING TESTS
    // ==========================================

    public function test_user_with_approvals_view_can_list_approval_requests(): void
    {
        $viewer = $this->createUserWithPermissions(['approvals.view']);
        $requester = $this->createUserWithRole('ACCOUNTANT');

        $expense1 = $this->createExpense($requester, ['amount' => 300000]);
        $expense2 = $this->createExpense($requester, ['amount' => 700000]);

        ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense1->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'reason' => 'Đề nghị duyệt chi vật tư đợt 1',
            'created_at' => now()->subHours(2),
        ]);

        ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense2->id,
            'requested_by' => $requester->id,
            'status' => 'APPROVED',
            'reason' => 'Đề nghị duyệt chi vật tư đợt 2',
            'created_at' => now()->subHour(),
        ]);

        $response = $this->authenticate($viewer)
            ->getJson('/api/v1/approval-requests');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh sách yêu cầu phê duyệt thành công.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'pending_count',
                'data' => [
                    '*' => [
                        'id',
                        'request_type',
                        'reference_type',
                        'reference_id',
                        'requested_by',
                        'approved_by',
                        'status',
                        'reason',
                        'rejection_reason',
                        'created_at',
                        'approved_at',
                        'requester',
                        'approver',
                        'reference',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'per_page',
                    'total',
                ],
            ]);

        $this->assertEquals(2, $response->json('meta.total'));
        $this->assertEquals(1, $response->json('pending_count'));
    }

    public function test_user_can_filter_approval_requests_by_status_and_request_type(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');

        $expense = $this->createExpense($requester);

        ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'reason' => 'Chi phí đang chờ duyệt',
            'created_at' => now(),
        ]);

        ApprovalRequest::create([
            'request_type' => 'DISCOUNT_APPROVAL',
            'reference_type' => 'Invoice',
            'reference_id' => 99,
            'requested_by' => $requester->id,
            'status' => 'REJECTED',
            'reason' => 'Giảm giá quá 20%',
            'rejection_reason' => 'Không đúng chính sách',
            'created_at' => now(),
        ]);

        // Filter status = PENDING
        $pendingResp = $this->authenticate($admin)
            ->getJson('/api/v1/approval-requests?status=PENDING');

        $pendingResp->assertStatus(200);
        $this->assertEquals(1, $pendingResp->json('meta.total'));
        $this->assertEquals('PENDING', $pendingResp->json('data.0.status'));

        // Filter request_type = DISCOUNT_APPROVAL
        $typeResp = $this->authenticate($admin)
            ->getJson('/api/v1/approval-requests?request_type=DISCOUNT_APPROVAL');

        $typeResp->assertStatus(200);
        $this->assertEquals(1, $typeResp->json('meta.total'));
        $this->assertEquals('DISCOUNT_APPROVAL', $typeResp->json('data.0.request_type'));
    }

    public function test_user_can_view_single_approval_request(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester, ['amount' => 450000]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'reason' => 'Duyệt chi thiết bị y tế',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/approval-requests/{$approval->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $approval->id,
                    'request_type' => 'EXPENSE_APPROVAL',
                    'status' => 'PENDING',
                    'reason' => 'Duyệt chi thiết bị y tế',
                    'reference' => [
                        'id' => $expense->id,
                        'amount' => 450000,
                    ],
                ],
            ]);
    }

    public function test_user_can_create_approval_request_via_api(): void
    {
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester, ['amount' => 200000]);

        $payload = [
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'reason' => 'Đề nghị duyệt chi bảo trì máy đo huyết áp',
        ];

        $response = $this->authenticate($requester)
            ->postJson('/api/v1/approval-requests', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo yêu cầu phê duyệt thành công.',
                'data' => [
                    'request_type' => 'EXPENSE_APPROVAL',
                    'status' => 'PENDING',
                    'reason' => 'Đề nghị duyệt chi bảo trì máy đo huyết áp',
                    'requested_by' => $requester->id,
                ],
            ]);

        $this->assertDatabaseHas('approval_requests', [
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_id' => $expense->id,
            'status' => 'PENDING',
            'requested_by' => $requester->id,
        ]);
    }

    // ==========================================
    // 2. APPROVAL WORKFLOW TESTS
    // ==========================================

    public function test_admin_approves_expense_request_auto_creates_cash_out_and_notifies_requester(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');

        // 1. Tạo phiếu chi (Expense)
        $expense = $this->createExpense($requester, [
            'expense_code' => 'EXP-TEST-001',
            'amount' => 350000,
            'payment_method' => 'CASH',
            'approval_status' => 'PENDING',
        ]);

        // 2. Xuất hiện trong approval_requests
        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'reason' => 'Chi phí mua bông băng gạc khử trùng',
            'created_at' => now(),
        ]);

        // 3. Admin duyệt qua POST /api/v1/approval-requests/{id}/approve
        $response = $this->authenticate($admin)
            ->postJson("/api/v1/approval-requests/{$approval->id}/approve");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Phê duyệt yêu cầu thành công.',
                'data' => [
                    'id' => $approval->id,
                    'status' => 'APPROVED',
                    'approved_by' => $admin->id,
                ],
            ]);

        // 4. Kiểm tra ApprovalRequest trong DB
        $this->assertDatabaseHas('approval_requests', [
            'id' => $approval->id,
            'status' => 'APPROVED',
            'approved_by' => $admin->id,
        ]);

        // 5. Kiểm tra Expense được cập nhật sang APPROVED
        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'approval_status' => 'APPROVED',
            'approved_by' => $admin->id,
        ]);

        // 6. Kiểm tra tự động ghi bút toán chi (OUT) vào cash_transactions
        $this->assertDatabaseHas('cash_transactions', [
            'transaction_type' => 'OUT',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'amount' => 350000.00,
            'payment_method' => 'CASH',
        ]);

        // 7. Kiểm tra bắn Notification tức thì cho người tạo yêu cầu
        $this->assertDatabaseHas('notifications', [
            'user_id' => $requester->id,
            'type' => 'APPROVAL_APPROVED',
            'reference_type' => 'ApprovalRequest',
            'reference_id' => $approval->id,
            'is_read' => false,
        ]);

        // 8. Kiểm tra ghi AuditLog
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'approvals',
            'action' => 'approve_request',
            'record_id' => $approval->id,
        ]);
    }

    public function test_approving_an_already_approved_request_returns_422(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'APPROVED',
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->postJson("/api/v1/approval-requests/{$approval->id}/approve");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Yêu cầu phê duyệt này đã được xử lý trước đó.',
            ]);
    }

    public function test_approval_idempotency_does_not_duplicate_cash_transactions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester, ['amount' => 120000]);

        // Pre-create cash transaction
        CashTransaction::create([
            'transaction_code' => 'CTX-000099',
            'transaction_type' => 'OUT',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'amount' => 120000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'description' => 'Đã chi trước đó',
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->postJson("/api/v1/approval-requests/{$approval->id}/approve");

        $response->assertStatus(200);

        // Vẫn chỉ có đúng 1 bản ghi cash_transactions
        $count = CashTransaction::where('reference_type', 'Expense')
            ->where('reference_id', $expense->id)
            ->count();

        $this->assertEquals(1, $count);
    }

    // ==========================================
    // 3. REJECTION WORKFLOW TESTS
    // ==========================================

    public function test_admin_rejects_expense_request_with_reason_and_notifies_requester(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');

        $expense = $this->createExpense($requester, [
            'expense_code' => 'EXP-REJ-001',
            'amount' => 800000,
            'approval_status' => 'PENDING',
        ]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'reason' => 'Đề nghị mua máy in hóa đơn mới',
            'created_at' => now(),
        ]);

        // Thử từ chối nhưng không nhập lý do -> 422
        $emptyReasonResp = $this->authenticate($admin)
            ->postJson("/api/v1/approval-requests/{$approval->id}/reject", []);

        $emptyReasonResp->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_reason']);

        // Từ chối kèm lý do hợp lệ
        $rejectResp = $this->authenticate($admin)
            ->postJson("/api/v1/approval-requests/{$approval->id}/reject", [
                'rejection_reason' => 'Vượt ngân sách cho phép của phòng ban trong tháng này.',
            ]);

        $rejectResp->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Từ chối yêu cầu phê duyệt thành công.',
                'data' => [
                    'id' => $approval->id,
                    'status' => 'REJECTED',
                    'rejection_reason' => 'Vượt ngân sách cho phép của phòng ban trong tháng này.',
                    'approved_by' => $admin->id,
                ],
            ]);

        // Kiểm tra ApprovalRequest trong DB
        $this->assertDatabaseHas('approval_requests', [
            'id' => $approval->id,
            'status' => 'REJECTED',
            'rejection_reason' => 'Vượt ngân sách cho phép của phòng ban trong tháng này.',
        ]);

        // Kiểm tra Expense được cập nhật sang REJECTED
        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'approval_status' => 'REJECTED',
        ]);

        // Đảm bảo TUYỆT ĐỐI KHÔNG sinh bút toán chi tiền vào cash_transactions
        $this->assertDatabaseMissing('cash_transactions', [
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
        ]);

        // Kiểm tra bắn Notification từ chối cho requester kèm lý do
        $this->assertDatabaseHas('notifications', [
            'user_id' => $requester->id,
            'type' => 'APPROVAL_REJECTED',
            'reference_type' => 'ApprovalRequest',
            'reference_id' => $approval->id,
            'is_read' => false,
        ]);

        $notification = Notification::where('user_id', $requester->id)
            ->where('type', 'APPROVAL_REJECTED')
            ->first();

        $this->assertStringContainsString('Vượt ngân sách', $notification->message);
    }

    public function test_cannot_reject_already_processed_request(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'REJECTED',
            'rejection_reason' => 'Lý do ban đầu',
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->postJson("/api/v1/approval-requests/{$approval->id}/reject", [
                'rejection_reason' => 'Từ chối lần 2',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Yêu cầu phê duyệt này đã được xử lý trước đó.',
            ]);
    }

    // ==========================================
    // 4. AUTHORIZATION & RBAC TESTS
    // ==========================================

    public function test_user_without_permission_cannot_list_or_manage_approvals(): void
    {
        $unauthorizedUser = $this->createUserWithRole('VIEWER');
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'created_at' => now(),
        ]);

        // List requests without approvals.view -> 403
        $listResp = $this->authenticate($unauthorizedUser)
            ->getJson('/api/v1/approval-requests');

        $listResp->assertStatus(403);

        // Approve request without approvals.manage -> 403
        $approveResp = $this->authenticate($unauthorizedUser)
            ->postJson("/api/v1/approval-requests/{$approval->id}/approve");

        $approveResp->assertStatus(403);

        // Reject request without approvals.manage -> 403
        $rejectResp = $this->authenticate($unauthorizedUser)
            ->postJson("/api/v1/approval-requests/{$approval->id}/reject", [
                'rejection_reason' => 'Không có quyền',
            ]);

        $rejectResp->assertStatus(403);
    }

    public function test_manager_role_can_approve_requests(): void
    {
        $manager = $this->createUserWithRole('MANAGER');
        $requester = $this->createUserWithRole('ACCOUNTANT');
        $expense = $this->createExpense($requester, ['amount' => 150000]);

        $approval = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => 'Expense',
            'reference_id' => $expense->id,
            'requested_by' => $requester->id,
            'status' => 'PENDING',
            'created_at' => now(),
        ]);

        $response = $this->authenticate($manager)
            ->postJson("/api/v1/approval-requests/{$approval->id}/approve");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $approval->id,
                    'status' => 'APPROVED',
                    'approved_by' => $manager->id,
                ],
            ]);
    }
}
