<?php

namespace Tests\Feature;

use App\Models\AlertRule;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use Database\Seeders\DemoCatalogSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Tests\TestCase;

class Phase2PermissionSeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Seed a given database connection.
     *
     * @param  list<string>|class-string<Seeder>|string  $class
     * @return $this
     */
    public function seed($class = 'Database\\Seeders\\DatabaseSeeder')
    {
        foreach (Arr::wrap($class) as $seederClass) {
            $this->artisan('db:seed', [
                '--class' => $seederClass,
                '--no-interaction' => true,
                '--force' => true,
            ]);
        }

        return $this;
    }

    public function test_role_permission_seeder_creates_all_phase_two_permissions(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $expectedPhase2Keys = [
            'debts.view',
            'cash_transactions.view',
            'cash_transactions.create',
            'products.view',
            'products.create',
            'products.update',
            'products.delete',
            'inventory.view',
            'inventory.in',
            'inventory.out',
            'inventory.adjust',
            'kpi_targets.view',
            'kpi_targets.manage',
            'imports.manage',
            'exports.view',
            'notifications.view',
            'approvals.view',
            'approvals.manage',
            'alert_rules.manage',
        ];

        foreach ($expectedPhase2Keys as $key) {
            $this->assertDatabaseHas('permissions', ['permission_key' => $key]);
        }
    }

    public function test_roles_receive_correct_phase_two_permissions(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $allPermissions = Permission::all();
        $totalPermissionCount = $allPermissions->count();

        // 1. ADMIN has 100% of all permissions
        $admin = Role::where('name', 'ADMIN')->firstOrFail();
        $this->assertCount($totalPermissionCount, $admin->permissions);

        // 2. MANAGER has operational Phase 2 permissions
        $manager = Role::where('name', 'MANAGER')->firstOrFail();
        $managerPerms = $manager->permissions->pluck('permission_key')->all();

        $this->assertContains('debts.view', $managerPerms);
        $this->assertContains('cash_transactions.view', $managerPerms);
        $this->assertContains('cash_transactions.create', $managerPerms);
        $this->assertContains('products.view', $managerPerms);
        $this->assertContains('products.create', $managerPerms);
        $this->assertContains('products.update', $managerPerms);
        $this->assertContains('products.delete', $managerPerms);
        $this->assertContains('inventory.view', $managerPerms);
        $this->assertContains('inventory.in', $managerPerms);
        $this->assertContains('inventory.out', $managerPerms);
        $this->assertContains('inventory.adjust', $managerPerms);
        $this->assertContains('kpi_targets.view', $managerPerms);
        $this->assertContains('kpi_targets.manage', $managerPerms);
        $this->assertContains('imports.manage', $managerPerms);
        $this->assertContains('exports.view', $managerPerms);
        $this->assertContains('notifications.view', $managerPerms);
        $this->assertContains('approvals.view', $managerPerms);
        $this->assertContains('approvals.manage', $managerPerms);
        $this->assertContains('alert_rules.manage', $managerPerms);
        // MANAGER must not have system-level destructive / security permissions
        $this->assertNotContains('roles.manage', $managerPerms);
        $this->assertNotContains('settings.update', $managerPerms);

        // 3. CASHIER has invoice, payment, debts.view, cash_transactions.view
        $cashier = Role::where('name', 'CASHIER')->firstOrFail();
        $cashierPerms = $cashier->permissions->pluck('permission_key')->all();

        $this->assertContains('invoices.view', $cashierPerms);
        $this->assertContains('invoices.create', $cashierPerms);
        $this->assertContains('payments.view', $cashierPerms);
        $this->assertContains('payments.create', $cashierPerms);
        $this->assertContains('debts.view', $cashierPerms);
        $this->assertContains('cash_transactions.view', $cashierPerms);
        $this->assertNotContains('cash_transactions.create', $cashierPerms);
        $this->assertNotContains('inventory.in', $cashierPerms);
        $this->assertNotContains('products.create', $cashierPerms);
        $this->assertNotContains('approvals.manage', $cashierPerms);

        // 4. ACCOUNTANT has invoices, payments, debts, expenses, cash_transactions, reports, exports, inventory.view, products.view
        $accountant = Role::where('name', 'ACCOUNTANT')->firstOrFail();
        $accountantPerms = $accountant->permissions->pluck('permission_key')->all();

        $this->assertContains('invoices.view', $accountantPerms);
        $this->assertContains('payments.view', $accountantPerms);
        $this->assertContains('debts.view', $accountantPerms);
        $this->assertContains('expenses.view', $accountantPerms);
        $this->assertContains('expenses.create', $accountantPerms);
        $this->assertContains('expenses.approve', $accountantPerms);
        $this->assertContains('cash_transactions.view', $accountantPerms);
        $this->assertContains('cash_transactions.create', $accountantPerms);
        $this->assertContains('reports.view', $accountantPerms);
        $this->assertContains('exports.view', $accountantPerms);
        $this->assertContains('inventory.view', $accountantPerms);
        $this->assertContains('products.view', $accountantPerms);
        $this->assertNotContains('inventory.in', $accountantPerms);
        $this->assertNotContains('inventory.out', $accountantPerms);
        $this->assertNotContains('products.create', $accountantPerms);
        $this->assertNotContains('products.delete', $accountantPerms);

        // 5. VIEWER has only .view permissions, strictly zero mutating actions
        $viewer = Role::where('name', 'VIEWER')->firstOrFail();
        $viewerPerms = $viewer->permissions->pluck('permission_key')->all();

        $this->assertNotEmpty($viewerPerms);
        $forbiddenKeywords = ['create', 'update', 'delete', 'manage', 'in', 'out', 'adjust', 'approve'];

        foreach ($viewerPerms as $permKey) {
            $this->assertStringEndsWith('.view', $permKey, "Permission {$permKey} must end with .view");
            foreach ($forbiddenKeywords as $forbidden) {
                $actionPart = explode('.', $permKey)[1] ?? '';
                $this->assertNotSame($forbidden, $actionPart, "Viewer must not have action {$forbidden} in {$permKey}");
            }
        }
    }

    public function test_demo_catalog_seeder_populates_products_and_alert_rules(): void
    {
        $this->seed(DemoCatalogSeeder::class);

        $this->assertSame(5, Product::count());
        $this->assertSame(3, AlertRule::count());

        $expectedProducts = ['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005'];
        foreach ($expectedProducts as $code) {
            $this->assertDatabaseHas('products', [
                'product_code' => $code,
                'status' => 'ACTIVE',
            ]);
        }

        $expectedAlertTypes = ['LOW_STOCK', 'PACKAGE_EXPIRING', 'OVERDUE_INVOICE'];
        foreach ($expectedAlertTypes as $type) {
            $this->assertDatabaseHas('alert_rules', [
                'alert_type' => $type,
                'status' => 'ACTIVE',
            ]);
        }

        // Verify specific threshold values
        $lowStockRule = AlertRule::where('alert_type', 'LOW_STOCK')->firstOrFail();
        $this->assertEquals(10.00, (float) $lowStockRule->threshold_value);

        $packageExpiringRule = AlertRule::where('alert_type', 'PACKAGE_EXPIRING')->firstOrFail();
        $this->assertSame(30, $packageExpiringRule->threshold_days);

        $overdueInvoiceRule = AlertRule::where('alert_type', 'OVERDUE_INVOICE')->firstOrFail();
        $this->assertSame(15, $overdueInvoiceRule->threshold_days);
    }

    public function test_demo_catalog_seeder_phase_two_is_idempotent(): void
    {
        $this->seed(DemoCatalogSeeder::class);

        $initialProductsCount = Product::count();
        $initialAlertRulesCount = AlertRule::count();

        $this->assertSame(5, $initialProductsCount);
        $this->assertSame(3, $initialAlertRulesCount);

        // Run second time — count must remain identical
        $this->seed(DemoCatalogSeeder::class);

        $this->assertSame($initialProductsCount, Product::count());
        $this->assertSame($initialAlertRulesCount, AlertRule::count());
    }

    public function test_demo_catalog_phase_two_skips_in_production(): void
    {
        $originalEnv = $this->app['env'];
        $this->app['env'] = 'production';

        try {
            $this->assertTrue(app()->isProduction());

            $this->seed(DemoCatalogSeeder::class);

            $this->assertSame(0, Product::count());
            $this->assertSame(0, AlertRule::count());
        } finally {
            $this->app['env'] = $originalEnv;
        }
    }
}
