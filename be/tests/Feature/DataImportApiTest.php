<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\ImportBatch;
use App\Models\ImportError;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class DataImportApiTest extends TestCase
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
            'username' => 'import_user_'.fake()->unique()->lexify('??????'),
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

        $permIds = Permission::whereIn('permission_key', $permissionKeys)->pluck('id');
        $user->permissions()->attach($permIds, ['created_at' => now()]);

        return $user;
    }

    /**
     * Authenticate a user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/imports')->assertUnauthorized();
        $this->get('/api/v1/imports/templates/patients')->assertUnauthorized();
        $this->getJson('/api/v1/imports/1')->assertUnauthorized();
        $this->postJson('/api/v1/imports/patients')->assertUnauthorized();
    }

    public function test_user_without_permission_is_forbidden(): void
    {
        $user = $this->createUserWithRole('VIEWER');
        $this->authenticate($user);

        $this->getJson('/api/v1/imports')->assertForbidden();
        $this->get('/api/v1/imports/templates/patients')->assertForbidden();
        $this->postJson('/api/v1/imports/patients')->assertForbidden();
    }

    public function test_can_download_templates_for_supported_modules(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        // Patients template
        $response = $this->get('/api/v1/imports/templates/patients');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('patient_code', $response->getContent());
        $this->assertStringContainsString('full_name', $response->getContent());

        // Services template
        $response = $this->get('/api/v1/imports/templates/services');
        $response->assertOk();
        $this->assertStringContainsString('service_code', $response->getContent());
        $this->assertStringContainsString('price', $response->getContent());

        // Products template
        $response = $this->get('/api/v1/imports/templates/products');
        $response->assertOk();
        $this->assertStringContainsString('product_code', $response->getContent());
        $this->assertStringContainsString('unit', $response->getContent());

        // Unsupported module
        $this->get('/api/v1/imports/templates/unsupported')->assertStatus(422);
    }

    public function test_import_patients_successfully_from_csv(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $csv = "patient_code,full_name,date_of_birth,gender,phone,email,address\n"
            ."BN100001,Nguyễn Văn An,1990-05-15,MALE,0901234567,an@example.com,Hà Nội\n"
            ."BN100002,Trần Thị Bình,1995-10-20,FEMALE,0912345678,binh@example.com,Đà Nẵng\n";

        $file = UploadedFile::fake()->createWithContent('patients.csv', $csv);

        $response = $this->postJson('/api/v1/imports/patients', [
            'file' => $file,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.module', 'patients')
            ->assertJsonPath('data.total_rows', 2)
            ->assertJsonPath('data.success_rows', 2)
            ->assertJsonPath('data.error_rows', 0)
            ->assertJsonPath('data.status', 'COMPLETED');

        $this->assertDatabaseHas('patients', [
            'patient_code' => 'BN100001',
            'full_name' => 'Nguyễn Văn An',
            'gender' => 'MALE',
            'phone' => '0901234567',
        ]);

        $this->assertDatabaseHas('patients', [
            'patient_code' => 'BN100002',
            'full_name' => 'Trần Thị Bình',
            'gender' => 'FEMALE',
            'phone' => '0912345678',
        ]);

        $this->assertDatabaseHas('import_batches', [
            'module' => 'patients',
            'total_rows' => 2,
            'success_rows' => 2,
            'error_rows' => 0,
            'status' => 'COMPLETED',
        ]);
    }

    public function test_import_patients_with_validation_errors_records_import_errors(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        // Row 1: Valid
        // Row 2: Missing full_name
        // Row 3: Invalid phone
        $csv = "patient_code,full_name,date_of_birth,gender,phone\n"
            ."BN200001,Hoàng Văn Cường,1988-01-01,MALE,0987654321\n"
            .",,1990-01-01,FEMALE,0988776655\n"
            ."BN200003,Lê Thị Dung,1992-02-02,FEMALE,invalid_phone_abc\n";

        $file = UploadedFile::fake()->createWithContent('patients_with_errors.csv', $csv);

        $response = $this->postJson('/api/v1/imports/patients', [
            'file' => $file,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_rows', 3)
            ->assertJsonPath('data.success_rows', 1)
            ->assertJsonPath('data.error_rows', 2)
            ->assertJsonPath('data.status', 'COMPLETED_WITH_ERRORS');

        $batchId = $response->json('data.id');

        $this->assertDatabaseHas('patients', [
            'patient_code' => 'BN200001',
            'full_name' => 'Hoàng Văn Cường',
        ]);

        $this->assertDatabaseHas('import_errors', [
            'batch_id' => $batchId,
            'row_number' => 3,
            'column_name' => 'full_name',
        ]);

        $this->assertDatabaseHas('import_errors', [
            'batch_id' => $batchId,
            'row_number' => 4,
            'column_name' => 'phone',
        ]);
    }

    public function test_import_services_with_negative_price_fails_row_and_logs_error(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $csv = "service_code,name,price,duration_minutes\n"
            ."DV900001,Khám nội tổng quát,150000,30\n"
            ."DV900002,Dịch vụ sai giá,-50000,20\n";

        $file = UploadedFile::fake()->createWithContent('services.csv', $csv);

        $response = $this->postJson('/api/v1/imports/services', [
            'file' => $file,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.total_rows', 2)
            ->assertJsonPath('data.success_rows', 1)
            ->assertJsonPath('data.error_rows', 1)
            ->assertJsonPath('data.status', 'COMPLETED_WITH_ERRORS');

        $this->assertDatabaseHas('services', [
            'service_code' => 'DV900001',
            'name' => 'Khám nội tổng quát',
        ]);

        $this->assertDatabaseMissing('services', [
            'service_code' => 'DV900002',
        ]);

        $batchId = $response->json('data.id');
        $this->assertDatabaseHas('import_errors', [
            'batch_id' => $batchId,
            'row_number' => 3,
            'column_name' => 'price',
        ]);
    }

    public function test_import_products_creates_initial_inventory_transaction(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $csv = "product_code,name,unit,minimum_stock,initial_stock\n"
            ."PRD-991,Thuốc giảm đau Paracetamol 500mg,Hộp,10,100\n"
            ."PRD-992,Nước muối sinh lý 500ml,Chai,20,50\n";

        $file = UploadedFile::fake()->createWithContent('products.csv', $csv);

        $response = $this->postJson('/api/v1/imports/products', [
            'file' => $file,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.success_rows', 2)
            ->assertJsonPath('data.error_rows', 0)
            ->assertJsonPath('data.status', 'COMPLETED');

        $product1 = Product::where('product_code', 'PRD-991')->firstOrFail();
        $this->assertEquals(100, $product1->current_stock);

        $this->assertDatabaseHas('inventory_transactions', [
            'product_id' => $product1->id,
            'transaction_type' => 'IN',
            'quantity' => 100,
            'reference_type' => 'INITIAL_STOCK',
        ]);
    }

    public function test_import_duplicate_code_is_rejected_or_updated_based_on_flag(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        Service::create([
            'service_code' => 'DV111222',
            'name' => 'Dịch vụ ban đầu',
            'price' => 100000,
            'duration_minutes' => 15,
            'status' => 'ACTIVE',
        ]);

        // 1. Without update_existing: duplicate code generates error
        $csv = "service_code,name,price,duration_minutes\n"
            ."DV111222,Dịch vụ cập nhật,200000,45\n";

        $file = UploadedFile::fake()->createWithContent('duplicate.csv', $csv);

        $response = $this->postJson('/api/v1/imports/services', [
            'file' => $file,
            'update_existing' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.success_rows', 0)
            ->assertJsonPath('data.error_rows', 1)
            ->assertJsonPath('data.status', 'COMPLETED_WITH_ERRORS');

        $batchId = $response->json('data.id');
        $this->assertDatabaseHas('import_errors', [
            'batch_id' => $batchId,
            'column_name' => 'service_code',
        ]);

        // 2. With update_existing: updates the existing service
        $file2 = UploadedFile::fake()->createWithContent('update.csv', $csv);
        $response2 = $this->postJson('/api/v1/imports/services', [
            'file' => $file2,
            'update_existing' => true,
        ]);

        $response2->assertOk()
            ->assertJsonPath('data.success_rows', 1)
            ->assertJsonPath('data.error_rows', 0)
            ->assertJsonPath('data.status', 'COMPLETED');

        $this->assertDatabaseHas('services', [
            'service_code' => 'DV111222',
            'name' => 'Dịch vụ cập nhật',
            'price' => 200000,
            'duration_minutes' => 45,
        ]);
    }

    public function test_can_view_import_history_and_batch_details(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $batch = ImportBatch::create([
            'module' => 'patients',
            'file_name' => 'history_test.csv',
            'total_rows' => 5,
            'success_rows' => 4,
            'error_rows' => 1,
            'status' => 'COMPLETED_WITH_ERRORS',
            'imported_by' => $admin->id,
            'created_at' => now(),
            'completed_at' => now(),
        ]);

        $error = ImportError::create([
            'batch_id' => $batch->id,
            'row_number' => 3,
            'column_name' => 'phone',
            'error_message' => 'Số điện thoại không hợp lệ.',
            'raw_data' => ['name' => 'Test', 'phone' => '123'],
            'created_at' => now(),
        ]);

        // List history
        $listResponse = $this->getJson('/api/v1/imports');
        $listResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $batch->id);

        // Get batch details
        $detailResponse = $this->getJson('/api/v1/imports/'.$batch->id);
        $detailResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $batch->id)
            ->assertJsonPath('data.file_name', 'history_test.csv')
            ->assertJsonPath('data.errors.0.column_name', 'phone')
            ->assertJsonPath('data.errors.0.row_number', 3);
    }

    public function test_import_with_direct_rows_array_payload(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $rows = [
            [
                'name' => 'Nội soi tai mũi họng',
                'price' => 200000,
                'duration_minutes' => 20,
            ],
            [
                'name' => 'Đo điện tim ECG',
                'price' => 80000,
                'duration_minutes' => 15,
            ],
        ];

        $response = $this->postJson('/api/v1/imports/services', [
            'rows' => $rows,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.total_rows', 2)
            ->assertJsonPath('data.success_rows', 2)
            ->assertJsonPath('data.error_rows', 0)
            ->assertJsonPath('data.status', 'COMPLETED');

        $this->assertDatabaseHas('services', [
            'name' => 'Nội soi tai mũi họng',
            'price' => 200000,
        ]);

        $this->assertDatabaseHas('services', [
            'name' => 'Đo điện tim ECG',
            'price' => 80000,
        ]);
    }
}
