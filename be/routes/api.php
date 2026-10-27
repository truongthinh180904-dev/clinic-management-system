<?php

use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\MedicalRecordController;
use App\Http\Controllers\Api\V1\PackageServiceController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PatientPackageController;
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
    });
});
