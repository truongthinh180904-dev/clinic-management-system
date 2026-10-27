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

class InventoryTransactionApiTest extends TestCase
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
            'username' => 'inv_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'perm_inv_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ROLE_INV_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for inventory',
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
     * Helper to create a test product.
     */
    protected function createProduct(array $attributes = []): Product
    {
        return Product::create(array_merge([
            'product_code' => 'PRD-'.fake()->unique()->numerify('####'),
            'name' => 'Vật tư '.fake()->words(2, true),
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    public function test_cannot_access_inventory_transactions_without_authentication(): void
    {
        $response = $this->getJson('/api/v1/inventory-transactions');
        $response->assertStatus(401);

        $responseSummary = $this->getJson('/api/v1/inventory/summary');
        $responseSummary->assertStatus(401);

        $responseStore = $this->postJson('/api/v1/inventory-transactions', [
            'product_id' => 1,
            'transaction_type' => 'IN',
            'quantity' => 10,
        ]);
        $responseStore->assertStatus(401);
    }

    public function test_user_without_inventory_view_permission_is_forbidden(): void
    {
        $user = $this->createUserWithPermissions(['appointments.view']);

        $response = $this->authenticate($user)
            ->getJson('/api/v1/inventory-transactions');
        $response->assertStatus(403);

        $responseSummary = $this->authenticate($user)
            ->getJson('/api/v1/inventory/summary');
        $responseSummary->assertStatus(403);
    }

    public function test_can_list_inventory_transactions_with_filters_and_pagination(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product1 = $this->createProduct(['name' => 'Paracetamol 500mg', 'product_code' => 'PRD-PARA-001']);
        $product2 = $this->createProduct(['name' => 'Amoxicillin 250mg', 'product_code' => 'PRD-AMOX-002']);

        // Transactions for product 1
        InventoryTransaction::create([
            'product_id' => $product1->id,
            'transaction_type' => 'IN',
            'quantity' => 100,
            'transaction_date' => now()->subDays(3),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(3),
        ]);
        InventoryTransaction::create([
            'product_id' => $product1->id,
            'transaction_type' => 'OUT',
            'quantity' => 20,
            'transaction_date' => now()->subDays(2),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(2),
        ]);

        // Transactions for product 2
        InventoryTransaction::create([
            'product_id' => $product2->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);
        InventoryTransaction::create([
            'product_id' => $product2->id,
            'transaction_type' => 'ADJUST',
            'quantity' => -5,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        // 1. Unfiltered list
        $response = $this->authenticate($admin)
            ->getJson('/api/v1/inventory-transactions');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 4);

        // 2. Filter by product_id
        $respProd = $this->authenticate($admin)
            ->getJson("/api/v1/inventory-transactions?product_id={$product1->id}");

        $respProd->assertStatus(200)
            ->assertJsonPath('meta.total', 2);

        // 3. Filter by transaction_type
        $respOut = $this->authenticate($admin)
            ->getJson('/api/v1/inventory-transactions?transaction_type=OUT');

        $respOut->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.transaction_type', 'OUT')
            ->assertJsonPath('data.0.quantity', 20);

        // 4. Search by keyword
        $respSearch = $this->authenticate($admin)
            ->getJson('/api/v1/inventory-transactions?search=Amoxicillin');

        $respSearch->assertStatus(200)
            ->assertJsonPath('meta.total', 2);

        // 5. Filter by date range
        $respDate = $this->authenticate($admin)
            ->getJson('/api/v1/inventory-transactions?start_date='.now()->subDays(2)->toDateString().'&end_date='.now()->toDateString());

        $respDate->assertStatus(200)
            ->assertJsonPath('meta.total', 3);
    }

    public function test_can_show_single_inventory_transaction(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct();

        $tx = InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 85.5,
            'reference_type' => 'PURCHASE_ORDER',
            'reference_id' => 999,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        $response = $this->authenticate($admin)
            ->getJson("/api/v1/inventory-transactions/{$tx->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $tx->id)
            ->assertJsonPath('data.product_id', $product->id)
            ->assertJsonPath('data.product_code', $product->product_code)
            ->assertJsonPath('data.transaction_type', 'IN')
            ->assertJsonPath('data.quantity', 85.5)
            ->assertJsonPath('data.reference_type', 'PURCHASE_ORDER')
            ->assertJsonPath('data.reference_id', 999)
            ->assertJsonPath('data.creator.id', $admin->id);
    }

    public function test_can_get_warehouse_summary_metrics(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Product 1: In 100, Out 20 => current 80 > minimum 20 (IN_STOCK)
        $p1 = $this->createProduct(['minimum_stock' => 20]);
        InventoryTransaction::create([
            'product_id' => $p1->id,
            'transaction_type' => 'IN',
            'quantity' => 100,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);
        InventoryTransaction::create([
            'product_id' => $p1->id,
            'transaction_type' => 'OUT',
            'quantity' => 20,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        // Product 2: In 15, Out 10 => current 5 <= minimum 10 (LOW_STOCK)
        $p2 = $this->createProduct(['minimum_stock' => 10]);
        InventoryTransaction::create([
            'product_id' => $p2->id,
            'transaction_type' => 'IN',
            'quantity' => 15,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);
        InventoryTransaction::create([
            'product_id' => $p2->id,
            'transaction_type' => 'OUT',
            'quantity' => 10,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        // Product 3: In 10, Out 10 => current 0 (OUT_OF_STOCK)
        $p3 = $this->createProduct(['minimum_stock' => 5]);
        InventoryTransaction::create([
            'product_id' => $p3->id,
            'transaction_type' => 'IN',
            'quantity' => 10,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);
        InventoryTransaction::create([
            'product_id' => $p3->id,
            'transaction_type' => 'OUT',
            'quantity' => 10,
            'transaction_date' => now(),
            'created_by' => $admin->id,
            'created_at' => now(),
        ]);

        // Product 4: No transactions => current 0 (OUT_OF_STOCK)
        $p4 = $this->createProduct(['minimum_stock' => 5]);

        $response = $this->authenticate($admin)
            ->getJson('/api/v1/inventory/summary');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_products', 4)
            ->assertJsonPath('data.in_stock_products', 1)
            ->assertJsonPath('data.low_stock_products', 1)
            ->assertJsonPath('data.out_of_stock_products', 2)
            ->assertJsonPath('data.total_transactions', 6)
            ->assertJsonPath('data.total_in_transactions', 3)
            ->assertJsonPath('data.total_out_transactions', 3);

        // Also test alias route
        $responseAlias = $this->authenticate($admin)
            ->getJson('/api/v1/inventory-transactions/summary');

        $responseAlias->assertStatus(200)
            ->assertJsonPath('data.total_products', 4);
    }

    public function test_can_record_stock_in_transaction_successfully(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct(['minimum_stock' => 20]);

        $payload = [
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50.5,
            'reference_type' => 'IMPORT_INVOICE',
            'reference_id' => 1234,
            'transaction_date' => now()->toIso8601String(),
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.product_id', $product->id)
            ->assertJsonPath('data.transaction_type', 'IN')
            ->assertJsonPath('data.quantity', 50.5)
            ->assertJsonPath('current_stock', 50.5)
            ->assertJsonPath('is_low_stock', false);

        $this->assertDatabaseHas('inventory_transactions', [
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50.5,
            'reference_type' => 'IMPORT_INVOICE',
            'reference_id' => 1234,
            'created_by' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'module' => 'inventory',
            'action' => 'inventory_in',
            'table_name' => 'inventory_transactions',
        ]);
    }

    public function test_cannot_record_stock_in_with_invalid_quantity_or_missing_product(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct();

        // 1. Missing product_id
        $respMissing = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'transaction_type' => 'IN',
                'quantity' => 10,
            ]);
        $respMissing->assertStatus(422)
            ->assertJsonValidationErrors(['product_id']);

        // 2. Quantity zero
        $respZero = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'IN',
                'quantity' => 0,
            ]);
        $respZero->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        // 3. Negative quantity
        $respNeg = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'IN',
                'quantity' => -10,
            ]);
        $respNeg->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_can_record_stock_out_transaction_when_sufficient_stock(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct(['minimum_stock' => 10]);

        // Add 50 units initially
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // Out 20 units
        $payload = [
            'product_id' => $product->id,
            'transaction_type' => 'OUT',
            'quantity' => 20,
            'reference_type' => 'PRESCRIPTION',
            'reference_id' => 888,
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.transaction_type', 'OUT')
            ->assertJsonPath('data.quantity', 20)
            ->assertJsonPath('current_stock', 30)
            ->assertJsonPath('is_low_stock', false);

        $this->assertEquals(30, $product->fresh()->current_stock);
    }

    public function test_cannot_record_stock_out_when_insufficient_stock_preventing_negative_stock(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct(['minimum_stock' => 5]);

        // Add 10 units
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 10,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // Attempt to OUT 15 units (exceeds current stock 10)
        $payload = [
            'product_id' => $product->id,
            'transaction_type' => 'OUT',
            'quantity' => 15,
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        // Assert stock remains 10 and no OUT transaction is written
        $this->assertEquals(10, $product->fresh()->current_stock);
        $this->assertDatabaseMissing('inventory_transactions', [
            'product_id' => $product->id,
            'transaction_type' => 'OUT',
        ]);
    }

    public function test_cannot_record_stock_out_when_stock_is_zero(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct(['minimum_stock' => 5]);

        $payload = [
            'product_id' => $product->id,
            'transaction_type' => 'OUT',
            'quantity' => 1,
        ];

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        $this->assertEquals(0, $product->fresh()->current_stock);
    }

    public function test_can_record_adjust_transaction_positive_and_negative(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct(['minimum_stock' => 10]);

        // Initial stock 50
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => now()->subDays(2),
            'created_by' => $admin->id,
            'created_at' => now()->subDays(2),
        ]);

        // Adjust +10 (surplus detected during audit)
        $respSurplus = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'ADJUST',
                'quantity' => 10,
                'reference_type' => 'STOCK_AUDIT',
            ]);

        $respSurplus->assertStatus(201)
            ->assertJsonPath('current_stock', 60);

        // Adjust -25 (loss/damage detected during audit)
        $respDeficit = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'ADJUST',
                'quantity' => -25,
                'reference_type' => 'STOCK_AUDIT',
            ]);

        $respDeficit->assertStatus(201)
            ->assertJsonPath('current_stock', 35);

        $this->assertEquals(35, $product->fresh()->current_stock);
    }

    public function test_cannot_adjust_stock_resulting_in_negative_stock(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct(['minimum_stock' => 10]);

        // Initial stock 15
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 15,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // Adjust -20 would result in -5
        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'ADJUST',
                'quantity' => -20,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        $this->assertEquals(15, $product->fresh()->current_stock);
    }

    public function test_cannot_adjust_with_zero_quantity(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct();

        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'ADJUST',
                'quantity' => 0,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_low_stock_notification_triggered_when_stock_falls_below_or_equal_minimum(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $manager = $this->createUserWithRole('MANAGER');
        $doctor = $this->createUserWithRole('DOCTOR');

        $product = $this->createProduct([
            'name' => 'Khẩu trang N95',
            'product_code' => 'PRD-N95-01',
            'minimum_stock' => 20,
        ]);

        // Initial stock 25
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 25,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // OUT 10 -> current_stock becomes 15 <= minimum_stock 20
        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'OUT',
                'quantity' => 10,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('current_stock', 15)
            ->assertJsonPath('is_low_stock', true);

        // Notifications should be created for ADMIN and MANAGER, but NOT DOCTOR
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

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $doctor->id,
            'type' => 'LOW_STOCK',
        ]);
    }

    public function test_low_stock_notification_not_triggered_when_stock_remains_safe(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $product = $this->createProduct([
            'minimum_stock' => 10,
        ]);

        // Initial stock 50
        InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => now()->subDay(),
            'created_by' => $admin->id,
            'created_at' => now()->subDay(),
        ]);

        // OUT 10 -> current_stock becomes 40 > minimum_stock 10
        $response = $this->authenticate($admin)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'OUT',
                'quantity' => 10,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('current_stock', 40)
            ->assertJsonPath('is_low_stock', false);

        $this->assertDatabaseMissing('notifications', [
            'type' => 'LOW_STOCK',
            'reference_id' => $product->id,
        ]);
    }

    public function test_granular_permissions_enforced_for_in_out_adjust(): void
    {
        $inOnlyUser = $this->createUserWithPermissions(['inventory.view', 'inventory.in']);
        $outOnlyUser = $this->createUserWithPermissions(['inventory.view', 'inventory.out']);

        $product = $this->createProduct(['minimum_stock' => 5]);

        // 1. inOnlyUser can perform IN
        $respIn = $this->authenticate($inOnlyUser)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'IN',
                'quantity' => 30,
            ]);
        $respIn->assertStatus(201);

        // 2. inOnlyUser CANNOT perform OUT -> 403
        $respInOut = $this->authenticate($inOnlyUser)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'OUT',
                'quantity' => 5,
            ]);
        $respInOut->assertStatus(403);

        // 3. inOnlyUser CANNOT perform ADJUST -> 403
        $respInAdj = $this->authenticate($inOnlyUser)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'ADJUST',
                'quantity' => 5,
            ]);
        $respInAdj->assertStatus(403);

        // 4. outOnlyUser CANNOT perform IN -> 403
        $respOutIn = $this->authenticate($outOnlyUser)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'IN',
                'quantity' => 10,
            ]);
        $respOutIn->assertStatus(403);

        // 5. outOnlyUser CAN perform OUT -> 201
        $respOutOut = $this->authenticate($outOnlyUser)
            ->postJson('/api/v1/inventory-transactions', [
                'product_id' => $product->id,
                'transaction_type' => 'OUT',
                'quantity' => 10,
            ]);
        $respOutOut->assertStatus(201);
    }
}
