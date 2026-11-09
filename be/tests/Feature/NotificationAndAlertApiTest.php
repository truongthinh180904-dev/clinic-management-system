<?php

namespace Tests\Feature;

use App\Models\AlertRule;
use App\Models\Employee;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\ServicePackage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationAndAlertApiTest extends TestCase
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
            'username' => 'notif_user_'.fake()->unique()->lexify('??????'),
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
            'name' => 'ROLE_NOTIF_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for notifications',
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

    // ==========================================
    // NOTIFICATION TESTS
    // ==========================================

    public function test_user_can_list_their_notifications_with_unread_count(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $otherUser = $this->createUserWithRole('DOCTOR');

        // Create 2 unread and 1 read notification for user
        Notification::create([
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'title' => 'Sản phẩm A sắp hết',
            'message' => 'Tồn kho chỉ còn 2 hộp',
            'is_read' => false,
            'created_at' => now()->subMinutes(10),
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'OVERDUE_INVOICE',
            'title' => 'Hóa đơn quá hạn',
            'message' => 'Hóa đơn INV-001 quá hạn 15 ngày',
            'is_read' => false,
            'created_at' => now()->subMinutes(5),
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'SYSTEM',
            'title' => 'Thông báo hệ thống',
            'message' => 'Hệ thống đã nâng cấp',
            'is_read' => true,
            'read_at' => now()->subMinutes(2),
            'created_at' => now()->subMinutes(20),
        ]);

        // Create notification for other user
        Notification::create([
            'user_id' => $otherUser->id,
            'type' => 'LOW_STOCK',
            'title' => 'Thông báo của người khác',
            'message' => 'Không được hiển thị',
            'is_read' => false,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/notifications');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('unread_count', 2)
            ->assertJsonCount(3, 'data');
    }

    public function test_user_can_filter_notifications_by_unread_only(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        Notification::create([
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'title' => 'Chưa đọc',
            'message' => 'Nội dung',
            'is_read' => false,
            'created_at' => now(),
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'SYSTEM',
            'title' => 'Đã đọc',
            'message' => 'Nội dung',
            'is_read' => true,
            'read_at' => now(),
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/notifications?unread_only=1');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Chưa đọc');
    }

    public function test_user_can_filter_notifications_by_type(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        Notification::create([
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'title' => 'Cảnh báo kho',
            'message' => 'Kho thấp',
            'is_read' => false,
            'created_at' => now(),
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'PACKAGE_EXPIRING',
            'title' => 'Gói sắp hết',
            'message' => 'Gói hết',
            'is_read' => false,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/notifications?type=LOW_STOCK');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.type', 'LOW_STOCK');
    }

    public function test_user_can_mark_single_notification_as_read(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'title' => 'Cần đọc',
            'message' => 'Tin quan trọng',
            'is_read' => false,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->patchJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_read', true);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);
    }

    public function test_user_cannot_mark_other_users_notification_as_read(): void
    {
        $user = $this->createUserWithRole('ADMIN');
        $otherUser = $this->createUserWithRole('DOCTOR');

        $notification = Notification::create([
            'user_id' => $otherUser->id,
            'type' => 'LOW_STOCK',
            'title' => 'Của user khác',
            'message' => 'Tin khác',
            'is_read' => false,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->patchJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertForbidden();
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        Notification::create([
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'title' => 'Tin 1',
            'message' => 'Nội dung 1',
            'is_read' => false,
            'created_at' => now(),
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'title' => 'Tin 2',
            'message' => 'Nội dung 2',
            'is_read' => false,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/notifications/read-all');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.updated_count', 2);

        $this->assertEquals(0, Notification::where('user_id', $user->id)->where('is_read', false)->count());
    }

    public function test_user_can_delete_notification(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => 'SYSTEM',
            'title' => 'Cần xóa',
            'message' => 'Xóa thông báo này',
            'is_read' => true,
            'created_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/notifications/{$notification->id}");

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('notifications', [
            'id' => $notification->id,
        ]);
    }

    // ==========================================
    // ALERT RULE TESTS
    // ==========================================

    public function test_authorized_user_can_list_alert_rules(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        AlertRule::create([
            'name' => 'Cảnh báo tồn kho tối thiểu',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 15.00,
            'status' => 'ACTIVE',
        ]);

        AlertRule::create([
            'name' => 'Cảnh báo hóa đơn',
            'alert_type' => 'OVERDUE_INVOICE',
            'threshold_value' => 500000,
            'threshold_days' => 10,
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/alert-rules');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data');
    }

    public function test_admin_can_create_new_alert_rule(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        $payload = [
            'name' => 'Quy tắc cảnh báo thử nghiệm',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 25.5,
            'threshold_days' => 7,
            'threshold_sessions' => 2,
            'status' => 'ACTIVE',
        ];

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alert-rules', $payload);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Quy tắc cảnh báo thử nghiệm')
            ->assertJsonPath('data.alert_type', 'LOW_STOCK')
            ->assertJsonPath('data.threshold_value', 25.5)
            ->assertJsonPath('data.threshold_days', 7)
            ->assertJsonPath('data.threshold_sessions', 2);

        $this->assertDatabaseHas('alert_rules', [
            'name' => 'Quy tắc cảnh báo thử nghiệm',
            'alert_type' => 'LOW_STOCK',
        ]);
    }

    public function test_admin_can_view_and_update_alert_rule(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        $rule = AlertRule::create([
            'name' => 'Quy tắc cũ',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 10,
            'status' => 'ACTIVE',
        ]);

        // View detail
        $showResponse = $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/alert-rules/{$rule->id}");

        $showResponse->assertOk()
            ->assertJsonPath('data.name', 'Quy tắc cũ');

        // Update
        $updateResponse = $this->actingAs($user, 'sanctum')
            ->putJson("/api/v1/alert-rules/{$rule->id}", [
                'name' => 'Quy tắc đã cập nhật',
                'threshold_value' => 20,
                'status' => 'INACTIVE',
            ]);

        $updateResponse->assertOk()
            ->assertJsonPath('data.name', 'Quy tắc đã cập nhật')
            ->assertJsonPath('data.threshold_value', 20)
            ->assertJsonPath('data.status', 'INACTIVE');

        $this->assertDatabaseHas('alert_rules', [
            'id' => $rule->id,
            'name' => 'Quy tắc đã cập nhật',
            'status' => 'INACTIVE',
        ]);
    }

    public function test_admin_can_delete_alert_rule(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        $rule = AlertRule::create([
            'name' => 'Quy tắc chuẩn bị xóa',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 10,
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/alert-rules/{$rule->id}");

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('alert_rules', [
            'id' => $rule->id,
        ]);
    }

    // ==========================================
    // ALERTS SCAN TESTS
    // ==========================================

    public function test_alerts_scan_detects_low_stock_and_creates_notifications(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        AlertRule::create([
            'name' => 'Cảnh báo tồn kho thấp',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 10.00,
            'status' => 'ACTIVE',
        ]);

        // Product with stock = 3 (<= 10)
        $product = Product::create([
            'product_code' => 'PRD-TEST01',
            'name' => 'Băng gạc tiệt trùng',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 3,
            'transaction_date' => now(),
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.details.low_stock_alerts', 1);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'LOW_STOCK',
            'reference_type' => 'Product',
            'reference_id' => $product->id,
            'is_read' => false,
        ]);
    }

    public function test_alerts_scan_prevents_duplicate_unread_notifications(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        AlertRule::create([
            'name' => 'Cảnh báo tồn kho thấp',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 10.00,
            'status' => 'ACTIVE',
        ]);

        $product = Product::create([
            'product_code' => 'PRD-TEST02',
            'name' => 'Cồn đỏ sát trùng',
            'unit' => 'Chai',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 2,
            'transaction_date' => now(),
            'created_by' => $user->id,
        ]);

        // Scan 1st time
        $response1 = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');
        $response1->assertOk()
            ->assertJsonPath('data.details.low_stock_alerts', 1);

        // Scan 2nd time without reading notification
        $response2 = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');
        $response2->assertOk()
            ->assertJsonPath('data.created_notifications_count', 0)
            ->assertJsonPath('data.details.low_stock_alerts', 0);

        // Exactly 1 unread notification exists for this product
        $count = Notification::where('user_id', $user->id)
            ->where('reference_type', 'Product')
            ->where('reference_id', $product->id)
            ->count();
        $this->assertEquals(1, $count);
    }

    public function test_alerts_scan_creates_new_notification_once_previous_is_read(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        AlertRule::create([
            'name' => 'Cảnh báo tồn kho thấp',
            'alert_type' => 'LOW_STOCK',
            'threshold_value' => 10.00,
            'status' => 'ACTIVE',
        ]);

        $product = Product::create([
            'product_code' => 'PRD-TEST03',
            'name' => 'Bơm tiêm 5ml',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 2,
            'transaction_date' => now(),
            'created_by' => $user->id,
        ]);

        // 1st scan
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/alerts/scan');

        // Mark existing notification as read
        Notification::where('user_id', $user->id)
            ->where('reference_id', $product->id)
            ->update(['is_read' => true, 'read_at' => now()]);

        // 2nd scan should generate another notification because existing one is read
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');

        $response->assertOk()
            ->assertJsonPath('data.details.low_stock_alerts', 1);

        $totalCount = Notification::where('user_id', $user->id)
            ->where('reference_id', $product->id)
            ->count();
        $this->assertEquals(2, $totalCount);
    }

    public function test_alerts_scan_detects_expiring_packages(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        AlertRule::create([
            'name' => 'Cảnh báo gói dịch vụ',
            'alert_type' => 'PACKAGE_EXPIRING',
            'threshold_days' => 30,
            'threshold_sessions' => 1,
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Văn Test',
            'phone' => '09'.fake()->numerify('########'),
            'gender' => 'MALE',
            'date_of_birth' => '1995-05-10',
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'PKG-EXP01',
            'name' => 'Gói trị liệu da',
            'price' => 1500000,
            'total_sessions' => 5,
            'validity_days' => 60,
            'status' => 'ACTIVE',
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => now()->subDays(20),
            'expiry_date' => now()->addDays(5), // Expiring in 5 days <= 30 days
            'total_sessions' => 5,
            'used_sessions' => 4,
            'remaining_sessions' => 1, // <= 1 session
            'price' => 1500000,
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');

        $response->assertOk()
            ->assertJsonPath('data.details.package_expiring_alerts', 1);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'PACKAGE_EXPIRING',
            'reference_type' => 'PatientPackage',
            'reference_id' => $patientPackage->id,
            'is_read' => false,
        ]);
    }

    public function test_alerts_scan_detects_overdue_invoices(): void
    {
        $user = $this->createUserWithRole('ADMIN');

        AlertRule::create([
            'name' => 'Cảnh báo hóa đơn công nợ quá hạn',
            'alert_type' => 'OVERDUE_INVOICE',
            'threshold_value' => 500000.00,
            'threshold_days' => 15,
            'status' => 'ACTIVE',
        ]);

        $patient = Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Trần Thị Nợ',
            'phone' => '09'.fake()->numerify('########'),
            'gender' => 'FEMALE',
            'date_of_birth' => '1992-03-15',
            'status' => 'ACTIVE',
        ]);

        // Invoice issued 20 days ago, debt = 800.000 >= 500.000
        $invoice = Invoice::create([
            'invoice_code' => 'INV-OVERDUE01',
            'patient_id' => $patient->id,
            'subtotal_amount' => 1000000,
            'discount_amount' => 200000,
            'total_amount' => 800000,
            'paid_amount' => 0,
            'remaining_amount' => 800000,
            'status' => 'UNPAID',
            'issued_at' => now()->subDays(20),
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');

        $response->assertOk()
            ->assertJsonPath('data.details.overdue_invoice_alerts', 1);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'OVERDUE_INVOICE',
            'reference_type' => 'Invoice',
            'reference_id' => $invoice->id,
            'is_read' => false,
        ]);
    }

    public function test_unauthorized_user_cannot_manage_alert_rules_or_trigger_scan(): void
    {
        // User with only notifications.view permission
        $user = $this->createUserWithPermissions(['notifications.view']);

        $postRule = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alert-rules', [
                'name' => 'Tự ý tạo quy tắc',
                'alert_type' => 'LOW_STOCK',
            ]);
        $postRule->assertForbidden();

        $scan = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/alerts/scan');
        $scan->assertForbidden();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
        $this->getJson('/api/v1/alert-rules')->assertUnauthorized();
        $this->postJson('/api/v1/alerts/scan')->assertUnauthorized();
    }
}
