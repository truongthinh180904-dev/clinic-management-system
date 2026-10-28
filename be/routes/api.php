<?php

use App\Http\Controllers\Api\V1\AlertRuleController;
use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\ApprovalRequestController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashTransactionController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DebtController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\ExportController;
use App\Http\Controllers\Api\V1\ImportController;
use App\Http\Controllers\Api\V1\InventoryTransactionController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\KpiTargetController;
use App\Http\Controllers\Api\V1\MedicalRecordController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PackageServiceController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PatientPackageController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\ServicePackageController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VisitController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'success' => true,
            'message' => 'QLPK API is healthy.',
            'data' => [
                'service' => 'qlpk-backend-api',
                'version' => 'v1',
                'status' => 'ok',
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    })->name('api.v1.health');

    Route::prefix('auth')->group(function (): void {
        Route::post('/login', [AuthController::class, 'login'])->name('api.v1.auth.login');

        Route::middleware(['auth:sanctum', 'active_user'])->group(function (): void {
            Route::get('/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
            Route::post('/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        });
    });

    Route::middleware(['auth:sanctum', 'active_user'])->group(function (): void {
        // Dashboard Overview
        Route::prefix('dashboard')->group(function (): void {
            Route::get('/summary', [DashboardController::class, 'summary'])
                ->name('api.v1.dashboard.summary');

            Route::get('/revenue-chart', [DashboardController::class, 'revenueChart'])
                ->name('api.v1.dashboard.revenue-chart');

            Route::get('/visit-trends', [DashboardController::class, 'visitTrends'])
                ->name('api.v1.dashboard.visit-trends');

            Route::get('/top-performers', [DashboardController::class, 'topPerformers'])
                ->name('api.v1.dashboard.top-performers');
        });

        // RBAC Management
        Route::get('/roles', [RolePermissionController::class, 'roles'])
            ->middleware('permission:roles.view')
            ->name('api.v1.roles.index');

        Route::get('/permissions', [RolePermissionController::class, 'permissions'])
            ->middleware('permission:permissions.view|roles.view')
            ->name('api.v1.permissions.index');

        Route::put('/roles/{role}/permissions', [RolePermissionController::class, 'updateRolePermissions'])
            ->middleware('permission:roles.manage')
            ->name('api.v1.roles.permissions.update');

        Route::put('/users/{user}/roles', [RolePermissionController::class, 'updateUserRoles'])
            ->middleware('permission:roles.manage')
            ->name('api.v1.users.roles.update');

        // User Management
        Route::prefix('users')->group(function (): void {
            Route::get('/', [UserController::class, 'index'])
                ->middleware('permission:users.view')
                ->name('api.v1.users.index');

            Route::post('/', [UserController::class, 'store'])
                ->middleware('permission:users.create')
                ->name('api.v1.users.store');

            Route::patch('/{user}/status', [UserController::class, 'updateStatus'])
                ->middleware('permission:users.update')
                ->name('api.v1.users.status.update');

            Route::match(['put', 'post'], '/{user}/password', [UserController::class, 'changePassword'])
                ->middleware('permission:users.update')
                ->name('api.v1.users.password.update');

            Route::post('/{user}/change-password', [UserController::class, 'changePassword'])
                ->middleware('permission:users.update')
                ->name('api.v1.users.password.change');

            Route::get('/{user}', [UserController::class, 'show'])
                ->middleware('permission:users.view')
                ->name('api.v1.users.show');

            Route::match(['put', 'patch'], '/{user}', [UserController::class, 'update'])
                ->middleware('permission:users.update')
                ->name('api.v1.users.update');

            Route::delete('/{user}', [UserController::class, 'destroy'])
                ->middleware('permission:users.delete|users.update')
                ->name('api.v1.users.destroy');
        });

        // Employee Management
        Route::prefix('employees')->group(function (): void {
            Route::get('/', [EmployeeController::class, 'index'])
                ->middleware('permission:employees.view')
                ->name('api.v1.employees.index');

            Route::post('/', [EmployeeController::class, 'store'])
                ->middleware('permission:employees.create')
                ->name('api.v1.employees.store');

            Route::patch('/{employee}/status', [EmployeeController::class, 'updateStatus'])
                ->middleware('permission:employees.update')
                ->name('api.v1.employees.status.update');

            Route::get('/{employee}', [EmployeeController::class, 'show'])
                ->middleware('permission:employees.view')
                ->name('api.v1.employees.show');

            Route::match(['put', 'patch'], '/{employee}', [EmployeeController::class, 'update'])
                ->middleware('permission:employees.update')
                ->name('api.v1.employees.update');

            Route::delete('/{employee}', [EmployeeController::class, 'destroy'])
                ->middleware('permission:employees.delete|employees.update')
                ->name('api.v1.employees.destroy');
        });

        // Patient Management
        Route::prefix('patients')->group(function (): void {
            Route::post('/check-duplicates', [PatientController::class, 'checkDuplicates'])
                ->middleware('permission:patients.view|patients.create')
                ->name('api.v1.patients.check-duplicates');

            Route::get('/', [PatientController::class, 'index'])
                ->middleware('permission:patients.view')
                ->name('api.v1.patients.index');

            Route::post('/', [PatientController::class, 'store'])
                ->middleware('permission:patients.create')
                ->name('api.v1.patients.store');

            Route::patch('/{patient}/status', [PatientController::class, 'updateStatus'])
                ->middleware('permission:patients.update')
                ->name('api.v1.patients.status.update');

            Route::get('/{patient}', [PatientController::class, 'show'])
                ->middleware('permission:patients.view')
                ->name('api.v1.patients.show');

            Route::match(['put', 'patch'], '/{patient}', [PatientController::class, 'update'])
                ->middleware('permission:patients.update')
                ->name('api.v1.patients.update');

            Route::delete('/{patient}', [PatientController::class, 'destroy'])
                ->middleware('permission:patients.delete|patients.update')
                ->name('api.v1.patients.destroy');

            // Patient Packages Assignment & History
            Route::get('/{patient}/packages', [PatientPackageController::class, 'indexByPatient'])
                ->middleware('permission:patient_packages.view|patients.view')
                ->name('api.v1.patients.packages.index');

            Route::post('/{patient}/packages', [PatientPackageController::class, 'store'])
                ->middleware('permission:patient_packages.assign|patients.update')
                ->name('api.v1.patients.packages.store');

            // Patient Debts Ledger
            Route::get('/{patient}/debts', [DebtController::class, 'patientDebts'])
                ->middleware('permission:debts.view|invoices.view')
                ->name('api.v1.patients.debts');
        });

        // Patient Packages Management
        Route::prefix('patient-packages')->group(function (): void {
            Route::get('/', [PatientPackageController::class, 'index'])
                ->middleware('permission:patient_packages.view|patients.view')
                ->name('api.v1.patient-packages.index');

            Route::get('/{patient_package}', [PatientPackageController::class, 'show'])
                ->middleware('permission:patient_packages.view|patients.view')
                ->name('api.v1.patient-packages.show');

            Route::patch('/{patient_package}/status', [PatientPackageController::class, 'updateStatus'])
                ->middleware('permission:patient_packages.assign|patients.update')
                ->name('api.v1.patient-packages.status.update');
        });

        // Service Catalog Management
        Route::prefix('services')->group(function (): void {
            Route::get('/', [ServiceController::class, 'index'])
                ->middleware('permission:services.view')
                ->name('api.v1.services.index');

            Route::post('/', [ServiceController::class, 'store'])
                ->middleware('permission:services.create')
                ->name('api.v1.services.store');

            Route::patch('/{service}/status', [ServiceController::class, 'updateStatus'])
                ->middleware('permission:services.update')
                ->name('api.v1.services.status.update');

            Route::get('/{service}', [ServiceController::class, 'show'])
                ->middleware('permission:services.view')
                ->name('api.v1.services.show');

            Route::match(['put', 'patch'], '/{service}', [ServiceController::class, 'update'])
                ->middleware('permission:services.update')
                ->name('api.v1.services.update');

            Route::delete('/{service}', [ServiceController::class, 'destroy'])
                ->middleware('permission:services.delete|services.update')
                ->name('api.v1.services.destroy');
        });

        // Service Package Catalog Management
        Route::prefix('service-packages')->group(function (): void {
            Route::get('/', [ServicePackageController::class, 'index'])
                ->middleware('permission:service_packages.view')
                ->name('api.v1.service-packages.index');

            Route::post('/', [ServicePackageController::class, 'store'])
                ->middleware('permission:service_packages.create')
                ->name('api.v1.service-packages.store');

            Route::patch('/{service_package}/status', [ServicePackageController::class, 'updateStatus'])
                ->middleware('permission:service_packages.update')
                ->name('api.v1.service-packages.status.update');

            // Service Package Composition (Package Services)
            Route::prefix('{package}/services')->group(function (): void {
                Route::get('/', [PackageServiceController::class, 'index'])
                    ->middleware('permission:service_packages.view')
                    ->name('api.v1.service-packages.services.index');

                Route::post('/', [PackageServiceController::class, 'store'])
                    ->middleware('permission:service_packages.update|service_packages.create')
                    ->name('api.v1.service-packages.services.store');

                Route::match(['put', 'patch'], '/', [PackageServiceController::class, 'syncOrUpdate'])
                    ->middleware('permission:service_packages.update')
                    ->name('api.v1.service-packages.services.sync-or-update');

                Route::match(['put', 'patch'], '/{service}', [PackageServiceController::class, 'update'])
                    ->middleware('permission:service_packages.update')
                    ->name('api.v1.service-packages.services.update');

                Route::delete('/', [PackageServiceController::class, 'destroy'])
                    ->middleware('permission:service_packages.update|service_packages.delete')
                    ->name('api.v1.service-packages.services.destroy-by-query');

                Route::delete('/{service}', [PackageServiceController::class, 'destroy'])
                    ->middleware('permission:service_packages.update|service_packages.delete')
                    ->name('api.v1.service-packages.services.destroy');
            });

            Route::get('/{service_package}', [ServicePackageController::class, 'show'])
                ->middleware('permission:service_packages.view')
                ->name('api.v1.service-packages.show');

            Route::match(['put', 'patch'], '/{service_package}', [ServicePackageController::class, 'update'])
                ->middleware('permission:service_packages.update')
                ->name('api.v1.service-packages.update');

            Route::delete('/{service_package}', [ServicePackageController::class, 'destroy'])
                ->middleware('permission:service_packages.delete|service_packages.update')
                ->name('api.v1.service-packages.destroy');
        });

        // Appointment Management
        Route::prefix('appointments')->group(function (): void {
            Route::get('/', [AppointmentController::class, 'index'])
                ->middleware('permission:appointments.view')
                ->name('api.v1.appointments.index');

            Route::post('/', [AppointmentController::class, 'store'])
                ->middleware('permission:appointments.create')
                ->name('api.v1.appointments.store');

            Route::get('/{appointment}', [AppointmentController::class, 'show'])
                ->middleware('permission:appointments.view')
                ->name('api.v1.appointments.show');

            Route::match(['put', 'patch'], '/{appointment}', [AppointmentController::class, 'update'])
                ->middleware('permission:appointments.update')
                ->name('api.v1.appointments.update');

            Route::patch('/{appointment}/status', [AppointmentController::class, 'updateStatus'])
                ->middleware('permission:appointments.update|appointments.cancel')
                ->name('api.v1.appointments.status.update');

            Route::post('/{appointment}/cancel', [AppointmentController::class, 'cancel'])
                ->middleware('permission:appointments.cancel|appointments.update')
                ->name('api.v1.appointments.cancel');

            Route::delete('/{appointment}', [AppointmentController::class, 'destroy'])
                ->middleware('permission:appointments.cancel|appointments.update')
                ->name('api.v1.appointments.destroy');
        });

        // Visit Management
        Route::prefix('visits')->group(function (): void {
            Route::get('/', [VisitController::class, 'index'])
                ->middleware('permission:visits.view')
                ->name('api.v1.visits.index');

            Route::post('/', [VisitController::class, 'store'])
                ->middleware('permission:visits.create')
                ->name('api.v1.visits.store');

            Route::get('/{visit}', [VisitController::class, 'show'])
                ->middleware('permission:visits.view')
                ->name('api.v1.visits.show');

            Route::match(['put', 'patch'], '/{visit}', [VisitController::class, 'update'])
                ->middleware('permission:visits.update')
                ->name('api.v1.visits.update');

            Route::patch('/{visit}/status', [VisitController::class, 'updateStatus'])
                ->middleware('permission:visits.update|visits.cancel')
                ->name('api.v1.visits.status.update');

            Route::post('/{visit}/cancel', [VisitController::class, 'cancel'])
                ->middleware('permission:visits.cancel|visits.update')
                ->name('api.v1.visits.cancel');

            Route::delete('/{visit}', [VisitController::class, 'destroy'])
                ->middleware('permission:visits.cancel|visits.update')
                ->name('api.v1.visits.destroy');
        });

        // Medical Record Management
        Route::prefix('visits/{visit}/medical-record')->group(function (): void {
            Route::get('/', [MedicalRecordController::class, 'show'])
                ->middleware('permission:medical_records.view')
                ->name('api.v1.visits.medical-record.show');

            Route::post('/', [MedicalRecordController::class, 'store'])
                ->middleware('permission:medical_records.create')
                ->name('api.v1.visits.medical-record.store');

            Route::match(['put', 'patch'], '/', [MedicalRecordController::class, 'update'])
                ->middleware('permission:medical_records.update')
                ->name('api.v1.visits.medical-record.update');
        });

        Route::prefix('medical-records')->group(function (): void {
            Route::get('/{medical_record}', [MedicalRecordController::class, 'showRecord'])
                ->middleware('permission:medical_records.view')
                ->name('api.v1.medical-records.show');

            Route::match(['put', 'patch'], '/{medical_record}', [MedicalRecordController::class, 'updateRecord'])
                ->middleware('permission:medical_records.update')
                ->name('api.v1.medical-records.update');
        });

        // Invoice Management
        Route::prefix('invoices')->group(function (): void {
            Route::get('/', [InvoiceController::class, 'index'])
                ->middleware('permission:invoices.view')
                ->name('api.v1.invoices.index');

            Route::post('/', [InvoiceController::class, 'store'])
                ->middleware('permission:invoices.create')
                ->name('api.v1.invoices.store');

            Route::get('/{invoice}', [InvoiceController::class, 'show'])
                ->middleware('permission:invoices.view')
                ->name('api.v1.invoices.show');

            Route::match(['put', 'patch'], '/{invoice}', [InvoiceController::class, 'update'])
                ->middleware('permission:invoices.update')
                ->name('api.v1.invoices.update');

            Route::match(['patch', 'post'], '/{invoice}/cancel', [InvoiceController::class, 'cancel'])
                ->middleware('permission:invoices.update')
                ->name('api.v1.invoices.cancel');

            // Record payment for an invoice
            Route::post('/{invoice}/payments', [PaymentController::class, 'store'])
                ->middleware('permission:payments.create')
                ->name('api.v1.invoices.payments.store');
        });

        // Payment Management
        Route::prefix('payments')->group(function (): void {
            Route::get('/', [PaymentController::class, 'index'])
                ->middleware('permission:payments.view')
                ->name('api.v1.payments.index');

            Route::post('/', [PaymentController::class, 'store'])
                ->middleware('permission:payments.create')
                ->name('api.v1.payments.store');

            Route::get('/{payment}', [PaymentController::class, 'show'])
                ->middleware('permission:payments.view')
                ->name('api.v1.payments.show');
        });

        // Debt & Receivable Tracking Management
        Route::prefix('debts')->group(function (): void {
            Route::get('/summary', [DebtController::class, 'summary'])
                ->middleware('permission:debts.view|invoices.view')
                ->name('api.v1.debts.summary');

            Route::get('/patients', [DebtController::class, 'patients'])
                ->middleware('permission:debts.view|invoices.view')
                ->name('api.v1.debts.patients');

            Route::get('/patients/{patient}', [DebtController::class, 'patientDebts'])
                ->middleware('permission:debts.view|invoices.view')
                ->name('api.v1.debts.patient-debts');

            Route::get('/patients/{patient}/debts', [DebtController::class, 'patientDebts'])
                ->middleware('permission:debts.view|invoices.view')
                ->name('api.v1.debts.patient-debts-ledger');
        });

        // Cash Transactions & Cashbook Management
        Route::prefix('cash-transactions')->group(function (): void {
            Route::get('/summary', [CashTransactionController::class, 'summary'])
                ->middleware('permission:cash_transactions.view')
                ->name('api.v1.cash-transactions.summary');

            Route::get('/', [CashTransactionController::class, 'index'])
                ->middleware('permission:cash_transactions.view')
                ->name('api.v1.cash-transactions.index');

            Route::post('/', [CashTransactionController::class, 'store'])
                ->middleware('permission:cash_transactions.create')
                ->name('api.v1.cash-transactions.store');

            Route::get('/{cash_transaction}', [CashTransactionController::class, 'show'])
                ->middleware('permission:cash_transactions.view')
                ->name('api.v1.cash-transactions.show');
        });

        // Alias Cashbook routes
        Route::prefix('cashbook')->group(function (): void {
            Route::get('/summary', [CashTransactionController::class, 'summary'])
                ->middleware('permission:cash_transactions.view')
                ->name('api.v1.cashbook.summary');

            Route::get('/', [CashTransactionController::class, 'index'])
                ->middleware('permission:cash_transactions.view')
                ->name('api.v1.cashbook.index');
        });

        // Expense Categories Management
        Route::prefix('expense-categories')->group(function (): void {
            Route::get('/', [ExpenseCategoryController::class, 'index'])
                ->middleware('permission:expenses.view')
                ->name('api.v1.expense-categories.index');

            Route::post('/', [ExpenseCategoryController::class, 'store'])
                ->middleware('permission:expenses.create|expenses.approve')
                ->name('api.v1.expense-categories.store');

            Route::get('/{expense_category}', [ExpenseCategoryController::class, 'show'])
                ->middleware('permission:expenses.view')
                ->name('api.v1.expense-categories.show');

            Route::match(['put', 'patch'], '/{expense_category}', [ExpenseCategoryController::class, 'update'])
                ->middleware('permission:expenses.create|expenses.approve')
                ->name('api.v1.expense-categories.update');

            Route::delete('/{expense_category}', [ExpenseCategoryController::class, 'destroy'])
                ->middleware('permission:expenses.approve')
                ->name('api.v1.expense-categories.destroy');
        });

        // Expense Vouchers Management
        Route::prefix('expenses')->group(function (): void {
            Route::get('/', [ExpenseController::class, 'index'])
                ->middleware('permission:expenses.view')
                ->name('api.v1.expenses.index');

            Route::post('/', [ExpenseController::class, 'store'])
                ->middleware('permission:expenses.create')
                ->name('api.v1.expenses.store');

            Route::get('/{expense}', [ExpenseController::class, 'show'])
                ->middleware('permission:expenses.view')
                ->name('api.v1.expenses.show');

            Route::match(['put', 'patch'], '/{expense}', [ExpenseController::class, 'update'])
                ->middleware('permission:expenses.create|expenses.approve')
                ->name('api.v1.expenses.update');

            Route::match(['patch', 'post'], '/{expense}/approve', [ExpenseController::class, 'approve'])
                ->middleware('permission:expenses.approve|approvals.manage')
                ->name('api.v1.expenses.approve');

            Route::match(['patch', 'post'], '/{expense}/reject', [ExpenseController::class, 'reject'])
                ->middleware('permission:expenses.approve|approvals.manage')
                ->name('api.v1.expenses.reject');

            Route::delete('/{expense}', [ExpenseController::class, 'destroy'])
                ->middleware('permission:expenses.create|expenses.approve')
                ->name('api.v1.expenses.destroy');
        });

        // Product & Stock Catalog Management
        Route::prefix('products')->group(function (): void {
            Route::get('/', [ProductController::class, 'index'])
                ->middleware('permission:products.view')
                ->name('api.v1.products.index');

            Route::post('/', [ProductController::class, 'store'])
                ->middleware('permission:products.create')
                ->name('api.v1.products.store');

            Route::patch('/{product}/status', [ProductController::class, 'updateStatus'])
                ->middleware('permission:products.update')
                ->name('api.v1.products.status.update');

            Route::get('/{product}', [ProductController::class, 'show'])
                ->middleware('permission:products.view')
                ->name('api.v1.products.show');

            Route::match(['put', 'patch'], '/{product}', [ProductController::class, 'update'])
                ->middleware('permission:products.update')
                ->name('api.v1.products.update');

            Route::delete('/{product}', [ProductController::class, 'destroy'])
                ->middleware('permission:products.delete|products.update')
                ->name('api.v1.products.destroy');
        });

        // Inventory Transactions & Stock Movement Management
        Route::prefix('inventory-transactions')->group(function (): void {
            Route::get('/summary', [InventoryTransactionController::class, 'summary'])
                ->middleware('permission:inventory.view')
                ->name('api.v1.inventory-transactions.summary');

            Route::get('/', [InventoryTransactionController::class, 'index'])
                ->middleware('permission:inventory.view')
                ->name('api.v1.inventory-transactions.index');

            Route::post('/', [InventoryTransactionController::class, 'store'])
                ->middleware('permission:inventory.in|inventory.out|inventory.adjust')
                ->name('api.v1.inventory-transactions.store');

            Route::get('/{inventory_transaction}', [InventoryTransactionController::class, 'show'])
                ->middleware('permission:inventory.view')
                ->name('api.v1.inventory-transactions.show');
        });

        // Warehouse & Stock Summary Alias
        Route::prefix('inventory')->group(function (): void {
            Route::get('/summary', [InventoryTransactionController::class, 'summary'])
                ->middleware('permission:inventory.view')
                ->name('api.v1.inventory.summary');

            Route::get('/transactions', [InventoryTransactionController::class, 'index'])
                ->middleware('permission:inventory.view')
                ->name('api.v1.inventory.transactions');
        });

        // KPI Targets Management
        Route::prefix('kpi-targets')->group(function (): void {
            Route::get('/summary', [KpiTargetController::class, 'summary'])
                ->middleware('permission:kpi_targets.view')
                ->name('api.v1.kpi-targets.summary');

            Route::get('/', [KpiTargetController::class, 'index'])
                ->middleware('permission:kpi_targets.view')
                ->name('api.v1.kpi-targets.index');

            Route::post('/', [KpiTargetController::class, 'store'])
                ->middleware('permission:kpi_targets.manage')
                ->name('api.v1.kpi-targets.store');

            Route::get('/{kpi_target}', [KpiTargetController::class, 'show'])
                ->middleware('permission:kpi_targets.view')
                ->name('api.v1.kpi-targets.show');

            Route::match(['put', 'patch'], '/{kpi_target}', [KpiTargetController::class, 'update'])
                ->middleware('permission:kpi_targets.manage')
                ->name('api.v1.kpi-targets.update');

            Route::delete('/{kpi_target}', [KpiTargetController::class, 'destroy'])
                ->middleware('permission:kpi_targets.manage')
                ->name('api.v1.kpi-targets.destroy');
        });

        Route::get('/employees/{employee}/kpi-targets', [KpiTargetController::class, 'index'])
            ->middleware('permission:kpi_targets.view')
            ->name('api.v1.employees.kpi-targets.index');

        // Management Reports
        Route::prefix('reports')->group(function (): void {
            Route::get('/financial', [ReportController::class, 'financial'])
                ->middleware('permission:reports.view')
                ->name('api.v1.reports.financial');

            Route::get('/clinical', [ReportController::class, 'clinical'])
                ->middleware('permission:reports.view')
                ->name('api.v1.reports.clinical');

            Route::get('/inventory', [ReportController::class, 'inventory'])
                ->middleware('permission:reports.view')
                ->name('api.v1.reports.inventory');
        });

        // Data Import & Batch Tracking
        Route::prefix('imports')->group(function (): void {
            Route::get('/', [ImportController::class, 'index'])
                ->middleware('permission:imports.manage')
                ->name('api.v1.imports.index');

            Route::get('/templates/{module}', [ImportController::class, 'template'])
                ->middleware('permission:imports.manage')
                ->name('api.v1.imports.template');

            Route::get('/{batch}', [ImportController::class, 'show'])
                ->middleware('permission:imports.manage')
                ->name('api.v1.imports.show');

            Route::post('/{module}', [ImportController::class, 'import'])
                ->middleware('permission:imports.manage')
                ->name('api.v1.imports.store');
        });

        // Data Export (CSV UTF-8 BOM)
        Route::prefix('exports')->group(function (): void {
            Route::get('/patients', [ExportController::class, 'patients'])
                ->middleware('permission:exports.view')
                ->name('api.v1.exports.patients');

            Route::get('/invoices', [ExportController::class, 'invoices'])
                ->middleware('permission:exports.view')
                ->name('api.v1.exports.invoices');

            Route::get('/cashbook', [ExportController::class, 'cashbook'])
                ->middleware('permission:exports.view')
                ->name('api.v1.exports.cashbook');

            Route::get('/inventory', [ExportController::class, 'inventory'])
                ->middleware('permission:exports.view')
                ->name('api.v1.exports.inventory');
        });

        // Notifications
        Route::prefix('notifications')->group(function (): void {
            Route::get('/', [NotificationController::class, 'index'])
                ->middleware('permission:notifications.view')
                ->name('api.v1.notifications.index');

            Route::post('/read-all', [NotificationController::class, 'markAllAsRead'])
                ->middleware('permission:notifications.view')
                ->name('api.v1.notifications.read-all');

            Route::patch('/{notification}/read', [NotificationController::class, 'markAsRead'])
                ->middleware('permission:notifications.read|notifications.view')
                ->name('api.v1.notifications.read');

            Route::delete('/{notification}', [NotificationController::class, 'destroy'])
                ->middleware('permission:notifications.view')
                ->name('api.v1.notifications.destroy');
        });

        // Alert Rules
        Route::prefix('alert-rules')->group(function (): void {
            Route::get('/', [AlertRuleController::class, 'index'])
                ->middleware('permission:alert_rules.manage|notifications.view')
                ->name('api.v1.alert-rules.index');

            Route::post('/', [AlertRuleController::class, 'store'])
                ->middleware('permission:alert_rules.manage')
                ->name('api.v1.alert-rules.store');

            Route::get('/{alert_rule}', [AlertRuleController::class, 'show'])
                ->middleware('permission:alert_rules.manage|notifications.view')
                ->name('api.v1.alert-rules.show');

            Route::match(['put', 'patch'], '/{alert_rule}', [AlertRuleController::class, 'update'])
                ->middleware('permission:alert_rules.manage')
                ->name('api.v1.alert-rules.update');

            Route::delete('/{alert_rule}', [AlertRuleController::class, 'destroy'])
                ->middleware('permission:alert_rules.manage')
                ->name('api.v1.alert-rules.destroy');

            Route::post('/scan', [AlertRuleController::class, 'scan'])
                ->middleware('permission:alert_rules.manage')
                ->name('api.v1.alert-rules.scan');
        });

        // Alerts Scanning Trigger
        Route::prefix('alerts')->group(function (): void {
            Route::post('/scan', [AlertRuleController::class, 'scan'])
                ->middleware('permission:alert_rules.manage')
                ->name('api.v1.alerts.scan');
        });

        // Approval Requests Workflow Management
        Route::prefix('approval-requests')->group(function (): void {
            Route::get('/', [ApprovalRequestController::class, 'index'])
                ->middleware('permission:approvals.view|approvals.manage')
                ->name('api.v1.approval-requests.index');

            Route::post('/', [ApprovalRequestController::class, 'store'])
                ->middleware('permission:approvals.view|approvals.manage|expenses.create')
                ->name('api.v1.approval-requests.store');

            Route::get('/{approvalRequest}', [ApprovalRequestController::class, 'show'])
                ->middleware('permission:approvals.view|approvals.manage')
                ->name('api.v1.approval-requests.show');

            Route::match(['post', 'patch'], '/{approvalRequest}/approve', [ApprovalRequestController::class, 'approve'])
                ->middleware('permission:approvals.manage')
                ->name('api.v1.approval-requests.approve');

            Route::match(['post', 'patch'], '/{approvalRequest}/reject', [ApprovalRequestController::class, 'reject'])
                ->middleware('permission:approvals.manage')
                ->name('api.v1.approval-requests.reject');
        });
    });
});
