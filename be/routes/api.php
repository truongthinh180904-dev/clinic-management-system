<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\RolePermissionController;
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
    });
});
