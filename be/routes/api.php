<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\ServicePackageController;
use App\Http\Controllers\Api\V1\UserController;
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
    });
});
