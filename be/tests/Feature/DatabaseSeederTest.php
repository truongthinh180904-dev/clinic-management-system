<?php

namespace Tests\Feature;

use App\Models\ExpenseCategory;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoCatalogSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Seed a given database connection, ensuring --force is passed for production simulation.
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

    public function test_role_permission_seeder_creates_eight_roles_and_expected_matrix(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $expectedRoles = [
            'ADMIN',
            'MANAGER',
            'DOCTOR',
            'NURSE',
            'RECEPTIONIST',
            'CASHIER',
            'ACCOUNTANT',
            'EMPLOYEE',
            'VIEWER',
        ];

        $this->assertSame(9, Role::count());

        foreach ($expectedRoles as $roleName) {
            $this->assertDatabaseHas('roles', ['name' => $roleName]);
        }

        $allPermissions = Permission::all();
        $this->assertGreaterThanOrEqual(30, $allPermissions->count());

        // 1. ADMIN has all permissions
        $adminRole = Role::where('name', 'ADMIN')->firstOrFail();
        $this->assertCount($allPermissions->count(), $adminRole->permissions);

        // 2. DOCTOR has medical records permissions but no cashier/payment permissions
        $doctorRole = Role::where('name', 'DOCTOR')->firstOrFail();
        $doctorPermissions = $doctorRole->permissions->pluck('permission_key')->all();

        $this->assertContains('medical_records.view', $doctorPermissions);
        $this->assertContains('medical_records.create', $doctorPermissions);
        $this->assertContains('medical_records.update', $doctorPermissions);
        $this->assertContains('visits.view', $doctorPermissions);
        $this->assertContains('visits.update', $doctorPermissions);
        $this->assertNotContains('payments.create', $doctorPermissions);
        $this->assertNotContains('invoices.create', $doctorPermissions);
        $this->assertNotContains('users.create', $doctorPermissions);

        // 3. RECEPTIONIST has patient/appointment/visit permissions but strictly NO medical records permissions
        $receptionistRole = Role::where('name', 'RECEPTIONIST')->firstOrFail();
        $receptionistPermissions = $receptionistRole->permissions->pluck('permission_key')->all();

        $this->assertContains('patients.create', $receptionistPermissions);
        $this->assertContains('appointments.create', $receptionistPermissions);
        $this->assertContains('visits.create', $receptionistPermissions);
        $this->assertNotContains('medical_records.view', $receptionistPermissions);
        $this->assertNotContains('medical_records.create', $receptionistPermissions);
        $this->assertNotContains('medical_records.update', $receptionistPermissions);
        $this->assertNotContains('payments.create', $receptionistPermissions);

        // 4. CASHIER has invoice/payment permissions but strictly NO medical records permissions
        $cashierRole = Role::where('name', 'CASHIER')->firstOrFail();
        $cashierPermissions = $cashierRole->permissions->pluck('permission_key')->all();

        $this->assertContains('invoices.create', $cashierPermissions);
        $this->assertContains('payments.create', $cashierPermissions);
        $this->assertNotContains('medical_records.view', $cashierPermissions);
        $this->assertNotContains('appointments.create', $cashierPermissions);

        // 5. VIEWER has only read-only permissions, zero mutating actions
        $viewerRole = Role::where('name', 'VIEWER')->firstOrFail();
        $viewerPermissions = $viewerRole->permissions->pluck('permission_key')->all();

        $this->assertNotEmpty($viewerPermissions);
        foreach ($viewerPermissions as $key) {
            $this->assertStringEndsWith('.view', $key);
            $this->assertStringNotContainsString('create', $key);
            $this->assertStringNotContainsString('update', $key);
            $this->assertStringNotContainsString('delete', $key);
        }

        // 6. NURSE has patient_files upload/view, but strictly NO medical records permissions
        $nurseRole = Role::where('name', 'NURSE')->firstOrFail();
        $nursePermissions = $nurseRole->permissions->pluck('permission_key')->all();

        $this->assertContains('patient_files.view', $nursePermissions);
        $this->assertContains('patient_files.upload', $nursePermissions);
        $this->assertNotContains('medical_records.view', $nursePermissions);
        $this->assertNotContains('medical_records.create', $nursePermissions);
        $this->assertNotContains('medical_records.update', $nursePermissions);
    }

    public function test_demo_catalog_seeder_populates_services_and_packages_safely(): void
    {
        $this->seed(DemoCatalogSeeder::class);

        $this->assertSame(8, Service::count());
        $this->assertSame(3, ServicePackage::count());
        $this->assertSame(3, ExpenseCategory::count());

        $package1 = ServicePackage::where('package_code', 'PKG-001')->firstOrFail();
        $this->assertCount(4, $package1->services);

        $package2 = ServicePackage::where('package_code', 'PKG-002')->firstOrFail();
        $this->assertCount(1, $package2->services);
        $this->assertSame(3, $package2->services->first()->pivot->quantity);

        // Crucial safety check: demo catalog must never seed real or fake patients
        $this->assertSame(0, Patient::count());
    }

    public function test_database_seeder_is_fully_idempotent(): void
    {
        // Run seeders first time
        $this->seed(DatabaseSeeder::class);

        $initialRolesCount = Role::count();
        $initialPermissionsCount = Permission::count();
        $initialRolePermissionsCount = RolePermission::count();
        $initialServicesCount = Service::count();
        $initialPackagesCount = ServicePackage::count();
        $initialUsersCount = User::count();

        $this->assertSame(9, $initialRolesCount);
        $this->assertSame(1, $initialUsersCount);

        $adminUser = User::where('username', 'admin')->firstOrFail();
        $this->assertTrue($adminUser->roles->contains(fn ($r) => $r->name === 'ADMIN'));
        $this->assertTrue(Hash::check('Admin@123456', $adminUser->password_hash));

        // Run seeders second time — must not throw duplicate key errors or multiply records
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($initialRolesCount, Role::count());
        $this->assertSame($initialPermissionsCount, Permission::count());
        $this->assertSame($initialRolePermissionsCount, RolePermission::count());
        $this->assertSame($initialServicesCount, Service::count());
        $this->assertSame($initialPackagesCount, ServicePackage::count());
        $this->assertSame($initialUsersCount, User::count());
    }

    public function test_demo_catalog_and_default_admin_behave_safely_in_production(): void
    {
        $originalEnv = $this->app['env'];
        $this->app['env'] = 'production';

        try {
            $this->assertTrue(app()->isProduction());

            // 1. DemoCatalogSeeder should skip seeding demo catalog in production
            $this->seed(DemoCatalogSeeder::class);
            $this->assertSame(0, Service::count());
            $this->assertSame(0, ServicePackage::count());

            // 2. DatabaseSeeder in production without ADMIN_INITIAL_PASSWORD must not seed weak default admin
            $this->seed(DatabaseSeeder::class);
            $this->assertSame(0, User::count());
            $this->assertSame(9, Role::count());

            // 3. DatabaseSeeder in production with ADMIN_INITIAL_PASSWORD seeds the configured admin safely
            putenv('ADMIN_INITIAL_PASSWORD=Secr3t!P@ssword');
            $_ENV['ADMIN_INITIAL_PASSWORD'] = 'Secr3t!P@ssword';

            $this->seed(DatabaseSeeder::class);
            $this->assertSame(1, User::count());
            $adminUser = User::where('username', 'admin')->first();
            $this->assertNotNull($adminUser);
            $this->assertTrue(Hash::check('Secr3t!P@ssword', $adminUser->password_hash));
        } finally {
            putenv('ADMIN_INITIAL_PASSWORD');
            unset($_ENV['ADMIN_INITIAL_PASSWORD']);
            $this->app['env'] = $originalEnv;
        }
    }
}
