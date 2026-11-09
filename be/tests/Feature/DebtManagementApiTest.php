<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DebtManagementApiTest extends TestCase
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
            'username' => 'debt_user_'.fake()->unique()->lexify('??????'),
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
            'username' => 'debt_perm_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'CUSTOM_DEBT_ROLE_'.fake()->unique()->numerify('####'),
            'description' => 'Custom role for debt testing',
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
            'full_name' => 'Bệnh nhân '.fake()->unique()->name(),
            'date_of_birth' => '1990-01-01',
            'gender' => 'MALE',
            'phone' => '09'.fake()->unique()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create an invoice.
     */
    protected function createInvoice(array $overrides = []): Invoice
    {
        $patientId = $overrides['patient_id'] ?? $this->createPatient()->id;
        $subtotal = $overrides['subtotal_amount'] ?? 1000000.00;
        $discount = $overrides['discount_amount'] ?? 0.00;
        $total = $overrides['total_amount'] ?? ($subtotal - $discount);
        $paid = $overrides['paid_amount'] ?? 0.00;
        $remaining = $overrides['remaining_amount'] ?? ($total - $paid);
        $status = $overrides['status'] ?? ($remaining == 0.0 ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID'));

        return Invoice::create(array_merge([
            'invoice_code' => 'INV-'.fake()->unique()->numerify('######'),
            'patient_id' => $patientId,
            'subtotal_amount' => $subtotal,
            'discount_amount' => $discount,
            'total_amount' => $total,
            'paid_amount' => $paid,
            'remaining_amount' => $remaining,
            'status' => $status,
            'issued_at' => now(),
        ], $overrides));
    }

    public function test_guest_cannot_access_debt_endpoints(): void
    {
        $this->getJson('/api/v1/debts/summary')->assertStatus(401);
        $this->getJson('/api/v1/debts/patients')->assertStatus(401);
        $this->getJson('/api/v1/patients/1/debts')->assertStatus(401);
    }

    public function test_user_without_permission_cannot_access_debt_endpoints(): void
    {
        $user = $this->createUserWithPermissions(['services.view']);
        $patient = $this->createPatient();

        $this->authenticate($user)->getJson('/api/v1/debts/summary')->assertStatus(403);
        $this->authenticate($user)->getJson('/api/v1/debts/patients')->assertStatus(403);
        $this->authenticate($user)->getJson("/api/v1/patients/{$patient->id}/debts")->assertStatus(403);
    }

    public function test_user_with_debts_view_permission_can_access(): void
    {
        $user = $this->createUserWithPermissions(['debts.view']);

        $response = $this->authenticate($user)->getJson('/api/v1/debts/summary');
        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_debts_summary_calculates_correct_totals_and_aging_buckets(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patientA = $this->createPatient(['full_name' => 'Nguyễn Văn A']);
        $patientB = $this->createPatient(['full_name' => 'Trần Thị B']);
        $patientC = $this->createPatient(['full_name' => 'Lê Văn C']);
        $patientD = $this->createPatient(['full_name' => 'Phạm Thị D']);

        // Invoice 1: Age 2 days -> 0-7 days group
        $this->createInvoice([
            'patient_id' => $patientA->id,
            'subtotal_amount' => 1000000,
            'total_amount' => 1000000,
            'paid_amount' => 0,
            'remaining_amount' => 1000000,
            'status' => 'UNPAID',
            'issued_at' => now()->subDays(2),
        ]);

        // Invoice 2: Age 14 days -> 8-30 days group
        $this->createInvoice([
            'patient_id' => $patientB->id,
            'subtotal_amount' => 2000000,
            'total_amount' => 2000000,
            'paid_amount' => 500000,
            'remaining_amount' => 1500000,
            'status' => 'PARTIAL',
            'issued_at' => now()->subDays(14),
        ]);

        // Invoice 3: Age 45 days -> > 30 days group
        $this->createInvoice([
            'patient_id' => $patientC->id,
            'subtotal_amount' => 3000000,
            'total_amount' => 3000000,
            'paid_amount' => 0,
            'remaining_amount' => 3000000,
            'status' => 'UNPAID',
            'issued_at' => now()->subDays(45),
        ]);

        // Invoice 4: Fully paid -> no remaining debt
        $this->createInvoice([
            'patient_id' => $patientC->id,
            'subtotal_amount' => 500000,
            'total_amount' => 500000,
            'paid_amount' => 500000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => now()->subDays(10),
        ]);

        // Invoice 5: Cancelled -> must be excluded
        $this->createInvoice([
            'patient_id' => $patientD->id,
            'subtotal_amount' => 800000,
            'total_amount' => 800000,
            'paid_amount' => 0,
            'remaining_amount' => 800000,
            'status' => 'CANCELLED',
            'issued_at' => now()->subDays(5),
        ]);

        $response = $this->getJson('/api/v1/debts/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_invoiced' => 6500000.0,
                    'total_collected' => 1000000.0,
                    'total_remaining_debt' => 5500000.0,
                    'debtor_patients_count' => 3,
                    'unpaid_invoices_count' => 2,
                    'partial_invoices_count' => 1,
                    'paid_invoices_count' => 1,
                    'aging' => [
                        '0_to_7_days' => [
                            'amount' => 1000000.0,
                            'count' => 1,
                        ],
                        '8_to_30_days' => [
                            'amount' => 1500000.0,
                            'count' => 1,
                        ],
                        'over_30_days' => [
                            'amount' => 3000000.0,
                            'count' => 1,
                        ],
                    ],
                ],
            ]);
    }

    public function test_debts_patients_returns_debtor_patients_ordered_by_debt_descending(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patientA = $this->createPatient(['full_name' => 'Bệnh nhân Nhất', 'phone' => '0911000001', 'patient_code' => 'BN000001']);
        $patientB = $this->createPatient(['full_name' => 'Bệnh nhân Nhì', 'phone' => '0911000002', 'patient_code' => 'BN000002']);
        $patientC = $this->createPatient(['full_name' => 'Bệnh nhân Ba', 'phone' => '0911000003', 'patient_code' => 'BN000003']);
        $patientZero = $this->createPatient(['full_name' => 'Bệnh nhân Hết Nợ', 'phone' => '0911000004', 'patient_code' => 'BN000004']);

        // Patient A owes 1,000,000
        $this->createInvoice([
            'patient_id' => $patientA->id,
            'total_amount' => 1000000,
            'paid_amount' => 0,
            'remaining_amount' => 1000000,
            'status' => 'UNPAID',
        ]);

        // Patient B owes 1,500,000
        $this->createInvoice([
            'patient_id' => $patientB->id,
            'total_amount' => 2000000,
            'paid_amount' => 500000,
            'remaining_amount' => 1500000,
            'status' => 'PARTIAL',
        ]);

        // Patient C owes 3,000,000 (highest debt)
        $this->createInvoice([
            'patient_id' => $patientC->id,
            'total_amount' => 3000000,
            'paid_amount' => 0,
            'remaining_amount' => 3000000,
            'status' => 'UNPAID',
        ]);

        // Patient Zero owes 0
        $this->createInvoice([
            'patient_id' => $patientZero->id,
            'total_amount' => 500000,
            'paid_amount' => 500000,
            'remaining_amount' => 0,
            'status' => 'PAID',
        ]);

        $response = $this->getJson('/api/v1/debts/patients');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertCount(3, $data);

        // Ordered by total_remaining_debt descending: C (3,000,000) > B (1,500,000) > A (1,000,000)
        $this->assertEquals($patientC->id, $data[0]['patient_id']);
        $this->assertEquals(3000000.0, $data[0]['total_remaining_debt']);
        $this->assertEquals(1, $data[0]['debt_invoices_count']);

        $this->assertEquals($patientB->id, $data[1]['patient_id']);
        $this->assertEquals(1500000.0, $data[1]['total_remaining_debt']);

        $this->assertEquals($patientA->id, $data[2]['patient_id']);
        $this->assertEquals(1000000.0, $data[2]['total_remaining_debt']);
    }

    public function test_debts_patients_search_by_name_phone_or_code(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patient1 = $this->createPatient(['full_name' => 'Nguyễn Minh Kha', 'phone' => '0933111222', 'patient_code' => 'BN777001']);
        $patient2 = $this->createPatient(['full_name' => 'Trịnh Hồng Hoa', 'phone' => '0977888999', 'patient_code' => 'BN777002']);

        $this->createInvoice(['patient_id' => $patient1->id, 'remaining_amount' => 500000, 'total_amount' => 500000]);
        $this->createInvoice(['patient_id' => $patient2->id, 'remaining_amount' => 800000, 'total_amount' => 800000]);

        // Search by name
        $response1 = $this->getJson('/api/v1/debts/patients?search=Minh Kha');
        $response1->assertStatus(200);
        $this->assertCount(1, $response1->json('data'));
        $this->assertEquals($patient1->id, $response1->json('data.0.patient_id'));

        // Search by phone
        $response2 = $this->getJson('/api/v1/debts/patients?search=0977888999');
        $response2->assertStatus(200);
        $this->assertCount(1, $response2->json('data'));
        $this->assertEquals($patient2->id, $response2->json('data.0.patient_id'));

        // Search by code
        $response3 = $this->getJson('/api/v1/debts/patients?search=BN777001');
        $response3->assertStatus(200);
        $this->assertCount(1, $response3->json('data'));
        $this->assertEquals($patient1->id, $response3->json('data.0.patient_id'));
    }

    public function test_patient_debts_ledger_returns_all_invoices_and_payment_history(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $patient = $this->createPatient(['full_name' => 'Đặng Văn Lâm']);

        $inv1 = $this->createInvoice([
            'patient_id' => $patient->id,
            'subtotal_amount' => 1200000,
            'total_amount' => 1200000,
            'paid_amount' => 400000,
            'remaining_amount' => 800000,
            'status' => 'PARTIAL',
            'issued_at' => now()->subDays(5),
        ]);

        $inv2 = $this->createInvoice([
            'patient_id' => $patient->id,
            'subtotal_amount' => 500000,
            'total_amount' => 500000,
            'paid_amount' => 500000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => now()->subDays(20),
        ]);

        // Access via /api/v1/patients/{patient}/debts
        $response = $this->getJson("/api/v1/patients/{$patient->id}/debts");
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient.id', $patient->id)
            ->assertJsonPath('data.summary.total_invoiced', 1700000)
            ->assertJsonPath('data.summary.total_paid', 900000)
            ->assertJsonPath('data.summary.total_remaining_debt', 800000)
            ->assertJsonPath('data.summary.total_invoices_count', 2)
            ->assertJsonPath('data.summary.debt_invoices_count', 1);

        $this->assertCount(2, $response->json('data.invoices'));

        // Access via alias /api/v1/debts/patients/{patient}
        $responseAlias = $this->getJson("/api/v1/debts/patients/{$patient->id}");
        $responseAlias->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.patient.id', $patient->id);
    }

    public function test_reconciliation_before_and_after_payment_installment(): void
    {
        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier);

        $patient = $this->createPatient(['full_name' => 'Võ Hoàng Yến']);

        $invoice = $this->createInvoice([
            'patient_id' => $patient->id,
            'subtotal_amount' => 2000000,
            'total_amount' => 2000000,
            'paid_amount' => 0,
            'remaining_amount' => 2000000,
            'status' => 'UNPAID',
            'issued_at' => now(),
        ]);

        // Phase 1: Before payment
        $summary1 = $this->getJson('/api/v1/debts/summary');
        $summary1->assertStatus(200)
            ->assertJsonPath('data.total_invoiced', 2000000)
            ->assertJsonPath('data.total_collected', 0)
            ->assertJsonPath('data.total_remaining_debt', 2000000)
            ->assertJsonPath('data.debtor_patients_count', 1)
            ->assertJsonPath('data.unpaid_invoices_count', 1)
            ->assertJsonPath('data.partial_invoices_count', 0);

        // Phase 2: Make partial payment of 800,000
        $payRes1 = $this->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 800000,
            'payment_method' => 'CASH',
            'notes' => 'Thu đợt 1',
        ]);
        $payRes1->assertStatus(201);

        $summary2 = $this->getJson('/api/v1/debts/summary');
        $summary2->assertStatus(200)
            ->assertJsonPath('data.total_invoiced', 2000000)
            ->assertJsonPath('data.total_collected', 800000)
            ->assertJsonPath('data.total_remaining_debt', 1200000)
            ->assertJsonPath('data.debtor_patients_count', 1)
            ->assertJsonPath('data.unpaid_invoices_count', 0)
            ->assertJsonPath('data.partial_invoices_count', 1);

        $patientDebts2 = $this->getJson("/api/v1/patients/{$patient->id}/debts");
        $patientDebts2->assertStatus(200)
            ->assertJsonPath('data.summary.total_paid', 800000)
            ->assertJsonPath('data.summary.total_remaining_debt', 1200000)
            ->assertJsonPath('data.summary.partial_invoices_count', 1);
        $this->assertCount(1, $patientDebts2->json('data.payments'));
        $this->assertEquals(800000.0, $patientDebts2->json('data.payments.0.amount'));

        // Phase 3: Settle the remaining 1,200,000
        $payRes2 = $this->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 1200000,
            'payment_method' => 'BANK_TRANSFER',
            'reference_code' => 'TXN-998811',
            'notes' => 'Tất toán toàn bộ',
        ]);
        $payRes2->assertStatus(201);

        // Check summary after settlement
        $summary3 = $this->getJson('/api/v1/debts/summary');
        $summary3->assertStatus(200)
            ->assertJsonPath('data.total_invoiced', 2000000)
            ->assertJsonPath('data.total_collected', 2000000)
            ->assertJsonPath('data.total_remaining_debt', 0)
            ->assertJsonPath('data.debtor_patients_count', 0)
            ->assertJsonPath('data.unpaid_invoices_count', 0)
            ->assertJsonPath('data.partial_invoices_count', 0)
            ->assertJsonPath('data.paid_invoices_count', 1);

        // Check debtor patients list is now empty
        $patientsList = $this->getJson('/api/v1/debts/patients');
        $patientsList->assertStatus(200);
        $this->assertCount(0, $patientsList->json('data'));

        // Check patient ledger after settlement
        $patientDebts3 = $this->getJson("/api/v1/patients/{$patient->id}/debts");
        $patientDebts3->assertStatus(200)
            ->assertJsonPath('data.summary.total_remaining_debt', 0)
            ->assertJsonPath('data.summary.debt_invoices_count', 0)
            ->assertJsonPath('data.summary.paid_invoices_count', 1);
        $this->assertCount(2, $patientDebts3->json('data.payments'));
    }

    public function test_patient_debts_returns_404_for_non_existent_patient(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $this->getJson('/api/v1/patients/999999/debts')->assertStatus(404);
    }

    public function test_accountant_and_cashier_can_access_debt_endpoints(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $this->authenticate($accountant)->getJson('/api/v1/debts/summary')->assertStatus(200);
        $this->authenticate($accountant)->getJson('/api/v1/debts/patients')->assertStatus(200);

        $cashier = $this->createUserWithRole('CASHIER');
        $this->authenticate($cashier)->getJson('/api/v1/debts/summary')->assertStatus(200);
        $this->authenticate($cashier)->getJson('/api/v1/debts/patients')->assertStatus(200);
    }

    public function test_debts_summary_supports_date_range_filtering(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patient = $this->createPatient();

        // Invoice within range (today)
        $this->createInvoice([
            'patient_id' => $patient->id,
            'total_amount' => 1000000,
            'remaining_amount' => 1000000,
            'issued_at' => now(),
        ]);

        // Invoice outside range (60 days ago)
        $this->createInvoice([
            'patient_id' => $patient->id,
            'total_amount' => 2000000,
            'remaining_amount' => 2000000,
            'issued_at' => now()->subDays(60),
        ]);

        $from = now()->subDays(7)->format('Y-m-d');
        $to = now()->addDay()->format('Y-m-d');

        $response = $this->getJson("/api/v1/debts/summary?start_date={$from}&end_date={$to}");
        $response->assertStatus(200)
            ->assertJsonPath('data.total_invoiced', 1000000)
            ->assertJsonPath('data.total_remaining_debt', 1000000);
    }

    public function test_patient_debts_accessible_via_all_route_variants(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $this->authenticate($admin);

        $patient = $this->createPatient();
        $this->createInvoice([
            'patient_id' => $patient->id,
            'total_amount' => 500000,
            'remaining_amount' => 500000,
        ]);

        // Variant 1: /api/v1/patients/{patient}/debts
        $res1 = $this->getJson("/api/v1/patients/{$patient->id}/debts");
        $res1->assertStatus(200)->assertJsonPath('data.patient.id', $patient->id);

        // Variant 2: /api/v1/debts/patients/{patient}
        $res2 = $this->getJson("/api/v1/debts/patients/{$patient->id}");
        $res2->assertStatus(200)->assertJsonPath('data.patient.id', $patient->id);

        // Variant 3: /api/v1/debts/patients/{patient}/debts
        $res3 = $this->getJson("/api/v1/debts/patients/{$patient->id}/debts");
        $res3->assertStatus(200)->assertJsonPath('data.patient.id', $patient->id);
    }
}
