<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceApiTest extends TestCase
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
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Nguyễn Văn Test',
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a doctor and service for visits.
     */
    protected function createDoctorAndService(): array
    {
        $doctor = Employee::create([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác Sĩ Test',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'department' => 'Khoa Khám Bệnh',
            'position' => 'Bác sĩ chuyên khoa',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'SRV-'.fake()->unique()->numerify('#####'),
            'name' => 'Khám tổng quát',
            'price' => 300000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        return [$doctor, $service];
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/invoices')->assertStatus(401);
        $this->postJson('/api/v1/invoices', [])->assertStatus(401);
        $this->getJson('/api/v1/invoices/1')->assertStatus(401);
        $this->putJson('/api/v1/invoices/1', [])->assertStatus(401);
        $this->patchJson('/api/v1/invoices/1/cancel')->assertStatus(401);
    }

    public function test_unauthorized_users_are_forbidden(): void
    {
        // User with no invoice permissions
        $user = $this->createUserWithPermissions(['patients.view']);
        $patient = $this->createPatient();

        $this->authenticate($user)
            ->getJson('/api/v1/invoices')
            ->assertStatus(403);

        $this->authenticate($user)
            ->postJson('/api/v1/invoices', [
                'patient_id' => $patient->id,
                'subtotal_amount' => 500000,
            ])
            ->assertStatus(403);
    }

    public function test_can_list_invoices_with_pagination_and_filters(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patient1 = $this->createPatient(['full_name' => 'Trần Văn A', 'phone' => '0911222333']);
        $patient2 = $this->createPatient(['full_name' => 'Lê Thị B', 'phone' => '0944555666']);

        $inv1 = Invoice::create([
            'invoice_code' => 'INV-000001',
            'patient_id' => $patient1->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 50000,
            'total_amount' => 450000,
            'paid_amount' => 0,
            'remaining_amount' => 450000,
            'status' => 'UNPAID',
            'issued_at' => now()->subDays(2),
            'created_by' => $admin->id,
        ]);

        $inv2 = Invoice::create([
            'invoice_code' => 'INV-000002',
            'patient_id' => $patient2->id,
            'subtotal_amount' => 1000000,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'paid_amount' => 1000000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => now(),
            'created_by' => $admin->id,
        ]);

        // 1. List all
        $response = $this->getJson('/api/v1/invoices');
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 2);

        // 2. Filter by status PAID
        $this->getJson('/api/v1/invoices?status=PAID')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.invoice_code', 'INV-000002');

        // 3. Filter by patient_id
        $this->getJson('/api/v1/invoices?patient_id='.$patient1->id)
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.invoice_code', 'INV-000001');

        // 4. Search by keyword
        $this->getJson('/api/v1/invoices?search=0911222333')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.patient.full_name', 'Trần Văn A');

        // 5. Filter by date range
        $today = now()->format('Y-m-d');
        $this->getJson('/api/v1/invoices?start_date='.$today.'&end_date='.$today)
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.invoice_code', 'INV-000002');
    }

    public function test_can_create_invoice_directly_for_patient(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $patient = $this->createPatient();

        $payload = [
            'patient_id' => $patient->id,
            'subtotal_amount' => 600000,
            'discount_amount' => 100000,
        ];

        $response = $this->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.subtotal_amount', 600000)
            ->assertJsonPath('data.discount_amount', 100000)
            ->assertJsonPath('data.total_amount', 500000)
            ->assertJsonPath('data.paid_amount', 0)
            ->assertJsonPath('data.remaining_amount', 500000)
            ->assertJsonPath('data.status', 'UNPAID')
            ->assertJsonPath('data.patient.id', $patient->id);

        $invoiceCode = $response->json('data.invoice_code');
        $this->assertStringStartsWith('INV-', $invoiceCode);

        $this->assertDatabaseHas('invoices', [
            'invoice_code' => $invoiceCode,
            'patient_id' => $patient->id,
            'total_amount' => 500000,
            'status' => 'UNPAID',
            'created_by' => $cashier->id,
        ]);

        // Audit log created
        $this->assertDatabaseHas('audit_logs', [
            'module' => 'invoices',
            'action' => 'create_invoice',
            'table_name' => 'invoices',
            'user_id' => $cashier->id,
        ]);
    }

    public function test_can_create_invoice_with_explicit_code(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $response = $this->postJson('/api/v1/invoices', [
            'invoice_code' => 'INV-CUSTOM-999',
            'patient_id' => $patient->id,
            'subtotal_amount' => 200000,
            'discount_amount' => 0,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.invoice_code', 'INV-CUSTOM-999');
    }

    public function test_can_create_invoice_with_zero_total_amount_marks_as_paid(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $response = $this->postJson('/api/v1/invoices', [
            'patient_id' => $patient->id,
            'subtotal_amount' => 300000,
            'discount_amount' => 300000,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.total_amount', 0)
            ->assertJsonPath('data.remaining_amount', 0)
            ->assertJsonPath('data.status', 'PAID');
    }

    public function test_can_create_invoice_from_visit_and_syncs_visit_payment_status(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $patient = $this->createPatient();
        [$doctor, $service] = $this->createDoctorAndService();

        $visit = Visit::create([
            'visit_code' => 'VIS000099',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'payment_status' => 'UNPAID',
            'status' => 'COMPLETED',
            'created_by' => $cashier->id,
        ]);

        $response = $this->postJson('/api/v1/invoices', [
            'visit_id' => $visit->id,
            'subtotal_amount' => 300000,
            'discount_amount' => 50000,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.visit_id', $visit->id)
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.total_amount', 250000)
            ->assertJsonPath('data.status', 'UNPAID');

        $this->assertEquals('UNPAID', $visit->fresh()->payment_status);
    }

    public function test_can_create_invoice_from_patient_package(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $patient = $this->createPatient();
        $pkg = ServicePackage::create([
            'package_code' => 'PKG001',
            'name' => 'Gói niềng răng',
            'price' => 20000000,
            'total_sessions' => 10,
            'validity_days' => 365,
            'status' => 'ACTIVE',
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $pkg->id,
            'purchase_date' => today(),
            'total_sessions' => 10,
            'used_sessions' => 0,
            'remaining_sessions' => 10,
            'price' => 20000000,
            'status' => 'ACTIVE',
        ]);

        $response = $this->postJson('/api/v1/invoices', [
            'patient_package_id' => $patientPackage->id,
            'subtotal_amount' => 20000000,
            'discount_amount' => 2000000,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.patient_package_id', $patientPackage->id)
            ->assertJsonPath('data.patient_id', $patient->id)
            ->assertJsonPath('data.total_amount', 18000000);
    }

    public function test_cannot_create_invoice_with_invalid_amounts(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        // Discount > Subtotal
        $this->postJson('/api/v1/invoices', [
            'patient_id' => $patient->id,
            'subtotal_amount' => 100000,
            'discount_amount' => 150000,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['discount_amount']);

        // Negative subtotal
        $this->postJson('/api/v1/invoices', [
            'patient_id' => $patient->id,
            'subtotal_amount' => -50000,
            'discount_amount' => 0,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['subtotal_amount']);

        // Negative discount
        $this->postJson('/api/v1/invoices', [
            'patient_id' => $patient->id,
            'subtotal_amount' => 100000,
            'discount_amount' => -10000,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['discount_amount']);
    }

    public function test_cannot_create_invoice_without_patient_or_visit(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $this->postJson('/api/v1/invoices', [
            'subtotal_amount' => 100000,
            'discount_amount' => 0,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['patient_id']);
    }

    public function test_can_show_invoice_details(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);
        $patient = $this->createPatient();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000100',
            'patient_id' => $patient->id,
            'subtotal_amount' => 700000,
            'discount_amount' => 50000,
            'total_amount' => 650000,
            'paid_amount' => 0,
            'remaining_amount' => 650000,
            'status' => 'UNPAID',
            'issued_at' => now(),
            'created_by' => $admin->id,
        ]);

        $response = $this->getJson('/api/v1/invoices/'.$invoice->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $invoice->id)
            ->assertJsonPath('data.invoice_code', 'INV-000100')
            ->assertJsonPath('data.patient.id', $patient->id);
    }

    public function test_can_update_invoice_discount_and_recalculates_status(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000200',
            'patient_id' => $patient->id,
            'subtotal_amount' => 1000000,
            'discount_amount' => 100000,
            'total_amount' => 900000,
            'paid_amount' => 300000,
            'remaining_amount' => 600000,
            'status' => 'PARTIAL',
            'issued_at' => now(),
            'created_by' => $cashier->id,
        ]);

        // Increase discount to 200,000 -> new total = 800,000 -> remaining = 500,000
        $response = $this->putJson('/api/v1/invoices/'.$invoice->id, [
            'discount_amount' => 200000,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.subtotal_amount', 1000000)
            ->assertJsonPath('data.discount_amount', 200000)
            ->assertJsonPath('data.total_amount', 800000)
            ->assertJsonPath('data.remaining_amount', 500000)
            ->assertJsonPath('data.status', 'PARTIAL');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'total_amount' => 800000,
            'remaining_amount' => 500000,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'invoices',
            'action' => 'update_invoice',
            'record_id' => (string) $invoice->id,
        ]);
    }

    public function test_cannot_update_invoice_if_new_total_less_than_paid_amount(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000300',
            'patient_id' => $patient->id,
            'subtotal_amount' => 1000000,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'paid_amount' => 700000,
            'remaining_amount' => 300000,
            'status' => 'PARTIAL',
            'issued_at' => now(),
            'created_by' => $cashier->id,
        ]);

        // Attempt discount of 500,000 -> new total = 500,000 < paid_amount (700,000)
        $this->putJson('/api/v1/invoices/'.$invoice->id, [
            'discount_amount' => 500000,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['discount_amount']);
    }

    public function test_cannot_update_cancelled_invoice(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000400',
            'patient_id' => $patient->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'paid_amount' => 0,
            'remaining_amount' => 0,
            'status' => 'CANCELLED',
            'issued_at' => now(),
            'created_by' => $cashier->id,
        ]);

        $this->putJson('/api/v1/invoices/'.$invoice->id, [
            'discount_amount' => 50000,
        ])->assertStatus(422);
    }

    public function test_can_cancel_unpaid_invoice(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $patient = $this->createPatient();
        [$doctor, $service] = $this->createDoctorAndService();

        $visit = Visit::create([
            'visit_code' => 'VIS000401',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => 'UNPAID',
            'status' => 'SCHEDULED',
            'created_by' => $cashier->id,
        ]);

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000500',
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'paid_amount' => 0,
            'remaining_amount' => 500000,
            'status' => 'UNPAID',
            'issued_at' => now(),
            'created_by' => $cashier->id,
        ]);

        $response = $this->patchJson('/api/v1/invoices/'.$invoice->id.'/cancel', [
            'reason' => 'Bệnh nhân đổi ý',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'CANCELLED')
            ->assertJsonPath('data.remaining_amount', 0);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'status' => 'CANCELLED',
            'remaining_amount' => 0,
        ]);

        $this->assertEquals('UNPAID', $visit->fresh()->payment_status);

        $this->assertDatabaseHas('audit_logs', [
            'module' => 'invoices',
            'action' => 'cancel_invoice',
            'record_id' => (string) $invoice->id,
        ]);
    }

    public function test_cannot_cancel_invoice_with_payments(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000600',
            'patient_id' => $patient->id,
            'subtotal_amount' => 800000,
            'discount_amount' => 0,
            'total_amount' => 800000,
            'paid_amount' => 300000,
            'remaining_amount' => 500000,
            'status' => 'PARTIAL',
            'issued_at' => now(),
            'created_by' => $cashier->id,
        ]);

        $this->patchJson('/api/v1/invoices/'.$invoice->id.'/cancel')
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertEquals('PARTIAL', $invoice->fresh()->status);
    }

    public function test_cannot_cancel_already_cancelled_invoice(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);
        $patient = $this->createPatient();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-000700',
            'patient_id' => $patient->id,
            'subtotal_amount' => 800000,
            'discount_amount' => 0,
            'total_amount' => 800000,
            'paid_amount' => 0,
            'remaining_amount' => 0,
            'status' => 'CANCELLED',
            'issued_at' => now(),
            'created_by' => $cashier->id,
        ]);

        $this->patchJson('/api/v1/invoices/'.$invoice->id.'/cancel')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }
}
