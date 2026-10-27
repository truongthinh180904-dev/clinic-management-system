<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\InventoryTransaction;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
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
            'username' => 'prod_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'perm_prod_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ROLE_PROD_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for products',
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

    public function test_cannot_access_products_without_authentication(): void
    {
        $response = $this->getJson('/api/v1/products');

        $response->assertStatus(401);
    }

    public function test_user_without_products_view_permission_is_forbidden(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);

        $response = $this->authenticate($user)
            ->getJson('/api/v1/products');

        $response->assertStatus(403);
    }

    public function test_can_list_products_with_dynamic_stock_calculation(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Product 1: In 100, Out 20 => current_stock = 80 (IN_STOCK)
        $p1 = Product::create([
            'product_code' => 'PRD-TEST-001',
            'name' => 'Thuốc Paracetamol 500mg',
            'unit' => 'Hộp',
            'minimum_stock' => 50,
            'status' => 'ACTIVE',
        ]);
        InventoryTransaction::create([
            'product_id' => $p1->id,
            'transaction_type' => 'IN',
            'quantity' => 100,
            'transaction_date' => now()->subDays(2),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(2),
        ]);
        InventoryTransaction::create([
            'product_id' => $p1->id,
            'transaction_type' => 'OUT',
            'quantity' => 20,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // Product 2: In 30, Out 25 => current_stock = 5 <= minimum_stock 10 (LOW_STOCK)
        $p2 = Product::create([
            'product_code' => 'PRD-TEST-002',
            'name' => 'Kháng sinh Amoxicillin 500mg',
            'unit' => 'Vỉ',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);
        InventoryTransaction::create([
            'product_id' => $p2->id,
            'transaction_type' => 'IN',
            'quantity' => 30,
            'transaction_date' => now()->subDays(2),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(2),
        ]);
        InventoryTransaction::create([
            'product_id' => $p2->id,
            'transaction_type' => 'OUT',
            'quantity' => 25,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // Product 3: In 15, Out 15 => current_stock = 0 (OUT_OF_STOCK)
        $p3 = Product::create([
            'product_code' => 'PRD-TEST-003',
            'name' => 'Băng gạc y tế vô trùng',
            'unit' => 'Cuộn',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);
        InventoryTransaction::create([
            'product_id' => $p3->id,
            'transaction_type' => 'IN',
            'quantity' => 15,
            'transaction_date' => now()->subDays(3),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(3),
        ]);
        InventoryTransaction::create([
            'product_id' => $p3->id,
            'transaction_type' => 'OUT',
            'quantity' => 15,
            'transaction_date' => now()->subDays(1),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(1),
        ]);

        $response = $this->authenticate($admin)
            ->getJson('/api/v1/products');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Lấy danh mục sản phẩm thành công.',
            ])
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'product_code',
                        'name',
                        'unit',
                        'minimum_stock',
                        'current_stock',
                        'stock_status',
                        'is_low_stock',
                        'status',
                    ],
                ],
                'meta' => ['current_page', 'per_page', 'total'],
            ]);

        $items = collect($response->json('data'));
        $item1 = $items->firstWhere('id', $p1->id);
        $item2 = $items->firstWhere('id', $p2->id);
        $item3 = $items->firstWhere('id', $p3->id);

        $this->assertEquals(80.0, $item1['current_stock']);
        $this->assertEquals('IN_STOCK', $item1['stock_status']);
        $this->assertFalse($item1['is_low_stock']);

        $this->assertEquals(5.0, $item2['current_stock']);
        $this->assertEquals('LOW_STOCK', $item2['stock_status']);
        $this->assertTrue($item2['is_low_stock']);

        $this->assertEquals(0.0, $item3['current_stock']);
        $this->assertEquals('OUT_OF_STOCK', $item3['stock_status']);
        $this->assertTrue($item3['is_low_stock']);
    }

    public function test_can_filter_products_by_low_stock_only(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Normal stock
        $pNormal = Product::create([
            'product_code' => 'PRD-NORM',
            'name' => 'Sản phẩm đủ tồn',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);
        InventoryTransaction::create([
            'product_id' => $pNormal->id,
            'transaction_type' => 'IN',
            'quantity' => 100,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        // Low stock
        $pLow = Product::create([
            'product_code' => 'PRD-LOW',
            'name' => 'Sản phẩm sắp hết',
            'unit' => 'Hộp',
            'minimum_stock' => 15,
            'status' => 'ACTIVE',
        ]);
        InventoryTransaction::create([
            'product_id' => $pLow->id,
            'transaction_type' => 'IN',
            'quantity' => 12,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->getJson('/api/v1/products?low_stock_only=1');

        $response->assertStatus(200);
        $data = $response->json('data');

        $ids = collect($data)->pluck('id')->all();
        $this->assertContains($pLow->id, $ids);
        $this->assertNotContains($pNormal->id, $ids);
    }

    public function test_can_search_products_by_code_and_name(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        Product::create([
            'product_code' => 'PRD-ALPHA',
            'name' => 'Kháng sinh Ciprofloxacin',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        Product::create([
            'product_code' => 'PRD-BETA',
            'name' => 'Dung dịch sát khuẩn Betadine',
            'unit' => 'Chai',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        // Search by keyword in name
        $response1 = $this->authenticate($admin)
            ->getJson('/api/v1/products?search=Betadine');
        $response1->assertStatus(200);
        $this->assertCount(1, $response1->json('data'));
        $this->assertEquals('PRD-BETA', $response1->json('data.0.product_code'));

        // Search by product_code
        $response2 = $this->authenticate($admin)
            ->getJson('/api/v1/products?search=PRD-ALPHA');
        $response2->assertStatus(200);
        $this->assertCount(1, $response2->json('data'));
        $this->assertEquals('PRD-ALPHA', $response2->json('data.0.product_code'));
    }

    public function test_can_filter_products_by_status(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        Product::create([
            'product_code' => 'PRD-ACT',
            'name' => 'Sản phẩm đang bán',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        Product::create([
            'product_code' => 'PRD-INACT',
            'name' => 'Sản phẩm ngừng sử dụng',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'INACTIVE',
        ]);

        $responseActive = $this->authenticate($admin)
            ->getJson('/api/v1/products?status=ACTIVE');
        $responseActive->assertStatus(200);
        $this->assertTrue(collect($responseActive->json('data'))->every(fn ($item) => $item['status'] === 'ACTIVE'));

        $responseInactive = $this->authenticate($admin)
            ->getJson('/api/v1/products?status=INACTIVE');
        $responseInactive->assertStatus(200);
        $this->assertTrue(collect($responseInactive->json('data'))->every(fn ($item) => $item['status'] === 'INACTIVE'));
    }

    public function test_can_create_product_with_custom_code_and_initial_stock(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $payload = [
            'product_code' => 'PRD-CUSTOM-001',
            'name' => 'Vitamin C 500mg',
            'unit' => 'Lọ',
            'minimum_stock' => 20.0,
            'initial_stock' => 150.0,
            'status' => 'ACTIVE',
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/products', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tạo sản phẩm mới thành công.',
                'data' => [
                    'product_code' => 'PRD-CUSTOM-001',
                    'name' => 'Vitamin C 500mg',
                    'unit' => 'Lọ',
                    'minimum_stock' => 20.0,
                    'current_stock' => 150.0,
                    'stock_status' => 'IN_STOCK',
                    'is_low_stock' => false,
                    'status' => 'ACTIVE',
                ],
            ]);

        $productId = $response->json('data.id');

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'product_code' => 'PRD-CUSTOM-001',
            'name' => 'Vitamin C 500mg',
        ]);

        $this->assertDatabaseHas('inventory_transactions', [
            'product_id' => $productId,
            'transaction_type' => 'IN',
            'quantity' => 150.0,
            'reference_type' => 'INITIAL_STOCK',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'products',
            'action' => 'create',
            'record_id' => (string) $productId,
        ]);
    }

    public function test_can_create_product_with_auto_generated_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Pre-create some product to test auto-generation
        Product::create([
            'product_code' => 'PRD-001',
            'name' => 'Mặt hàng 1',
            'unit' => 'Cái',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        $payload = [
            'name' => 'Bơm tiêm tự động sinh mã',
            'unit' => 'Hộp',
            'minimum_stock' => 30,
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/products', $payload);

        $response->assertStatus(201);
        $productCode = $response->json('data.product_code');
        $this->assertMatchesRegularExpression('/^PRD-\d+$/', $productCode);
        $this->assertEquals('PRD-002', $productCode);
    }

    public function test_create_product_validates_required_fields(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/products', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'unit']);
    }

    public function test_create_product_validates_unique_product_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        Product::create([
            'product_code' => 'PRD-EXISTING',
            'name' => 'Sản phẩm đã có',
            'unit' => 'Hộp',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/products', [
                'product_code' => 'PRD-EXISTING',
                'name' => 'Sản phẩm trùng mã',
                'unit' => 'Hộp',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['product_code']);
    }

    public function test_can_show_single_product_details(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $product = Product::create([
            'product_code' => 'PRD-SHOW-01',
            'name' => 'Cồn sát trùng 70 độ',
            'unit' => 'Chai',
            'minimum_stock' => 15,
            'status' => 'ACTIVE',
        ]);

        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/products/{$product->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $product->id,
                    'product_code' => 'PRD-SHOW-01',
                    'name' => 'Cồn sát trùng 70 độ',
                    'current_stock' => 50.0,
                    'stock_status' => 'IN_STOCK',
                ],
            ]);
    }

    public function test_show_non_existent_product_returns_404(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)
            ->getJson('/api/v1/products/999999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Không tìm thấy thông tin sản phẩm.',
            ]);
    }

    public function test_can_update_product(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $product = Product::create([
            'product_code' => 'PRD-UPD-01',
            'name' => 'Tên ban đầu',
            'unit' => 'Gói',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->putJson("/api/v1/products/{$product->id}", [
                'name' => 'Tên đã cập nhật mới',
                'unit' => 'Hộp',
                'minimum_stock' => 25.0,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật sản phẩm thành công.',
                'data' => [
                    'id' => $product->id,
                    'name' => 'Tên đã cập nhật mới',
                    'unit' => 'Hộp',
                    'minimum_stock' => 25.0,
                ],
            ]);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Tên đã cập nhật mới',
            'unit' => 'Hộp',
            'minimum_stock' => 25.0,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'products',
            'action' => 'update',
            'record_id' => (string) $product->id,
        ]);
    }

    public function test_can_update_product_status(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $product = Product::create([
            'product_code' => 'PRD-STAT-01',
            'name' => 'Sản phẩm đổi trạng thái',
            'unit' => 'Ống',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->patchJson("/api/v1/products/{$product->id}/status", [
                'status' => 'INACTIVE',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cập nhật trạng thái sản phẩm thành công.',
                'data' => [
                    'id' => $product->id,
                    'status' => 'INACTIVE',
                ],
            ]);

        $this->assertEquals('INACTIVE', $product->fresh()->status);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'products',
            'action' => 'update_status',
            'record_id' => (string) $product->id,
        ]);
    }

    public function test_cannot_delete_product_with_inventory_transactions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $product = Product::create([
            'product_code' => 'PRD-DEL-FAIL',
            'name' => 'Sản phẩm có biến động kho',
            'unit' => 'Chai',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 10,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->deleteJson("/api/v1/products/{$product->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    public function test_can_delete_product_without_inventory_transactions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $product = Product::create([
            'product_code' => 'PRD-DEL-OK',
            'name' => 'Sản phẩm chưa có phát sinh kho',
            'unit' => 'Hộp',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        $response = $this->authenticate($admin)
            ->deleteJson("/api/v1/products/{$product->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Xóa sản phẩm thành công.',
            ]);

        $this->assertDatabaseMissing('products', ['id' => $product->id]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'products',
            'action' => 'delete',
            'record_id' => (string) $product->id,
        ]);
    }

    public function test_stock_calculation_with_adjust_transactions(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $product = Product::create([
            'product_code' => 'PRD-ADJUST-TEST',
            'name' => 'Sản phẩm kiểm kê điều chỉnh',
            'unit' => 'Gói',
            'minimum_stock' => 20,
            'status' => 'ACTIVE',
        ]);

        // IN 50
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => now()->subDays(3),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(3),
        ]);

        // OUT 10
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'OUT',
            'quantity' => 10,
            'transaction_date' => now()->subDays(2),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(2),
        ]);

        // ADJUST +5 (e.g., found 5 extra during inventory count)
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'ADJUST',
            'quantity' => 5,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/products/{$product->id}");

        $response->assertStatus(200);
        // 50 - 10 + 5 = 45
        $this->assertEquals(45.0, $response->json('data.current_stock'));
        $this->assertEquals('IN_STOCK', $response->json('data.stock_status'));
    }
}
