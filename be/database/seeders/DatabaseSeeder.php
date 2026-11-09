<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
        ]);

        $adminRole = Role::where('name', 'ADMIN')->first();

        if (app()->isProduction()) {
            $adminInitialPassword = env('ADMIN_INITIAL_PASSWORD');
            if ($adminInitialPassword) {
                $adminUser = User::updateOrCreate(
                    ['username' => 'admin'],
                    [
                        'email' => env('ADMIN_INITIAL_EMAIL', 'admin@clinic.local'),
                        'password_hash' => Hash::make($adminInitialPassword),
                        'status' => 'ACTIVE',
                    ]
                );

                if ($adminRole) {
                    $adminUser->roles()->syncWithoutDetaching([$adminRole->id => ['created_at' => now()]]);
                }
            }
        } else {
            $adminUser = User::updateOrCreate(
                ['username' => 'admin'],
                [
                    'email' => 'admin@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );

            if ($adminRole) {
                $adminUser->roles()->syncWithoutDetaching([$adminRole->id => ['created_at' => now()]]);
            }

            // Demo Doctor Account
            $doctorRole = Role::where('name', 'DOCTOR')->first();
            $doctorUser = User::updateOrCreate(
                ['username' => 'doctor'],
                [
                    'email' => 'doctor@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($doctorRole) {
                $doctorUser->roles()->syncWithoutDetaching([$doctorRole->id => ['created_at' => now()]]);
            }

            // Demo Receptionist Account
            $receptionRole = Role::where('name', 'RECEPTIONIST')->first();
            $receptionUser = User::updateOrCreate(
                ['username' => 'receptionist'],
                [
                    'email' => 'receptionist@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($receptionRole) {
                $receptionUser->roles()->syncWithoutDetaching([$receptionRole->id => ['created_at' => now()]]);
            }

            // Demo Manager Account
            $managerRole = Role::where('name', 'MANAGER')->first();
            $managerUser = User::updateOrCreate(
                ['username' => 'manager'],
                [
                    'email' => 'manager@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($managerRole) {
                $managerUser->roles()->syncWithoutDetaching([$managerRole->id => ['created_at' => now()]]);
            }

            // Demo Nurse Account
            $nurseRole = Role::where('name', 'NURSE')->first();
            $nurseUser = User::updateOrCreate(
                ['username' => 'nurse'],
                [
                    'email' => 'nurse@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($nurseRole) {
                $nurseUser->roles()->syncWithoutDetaching([$nurseRole->id => ['created_at' => now()]]);
            }

            // Demo Cashier Account
            $cashierRole = Role::where('name', 'CASHIER')->first();
            $cashierUser = User::updateOrCreate(
                ['username' => 'cashier'],
                [
                    'email' => 'cashier@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($cashierRole) {
                $cashierUser->roles()->syncWithoutDetaching([$cashierRole->id => ['created_at' => now()]]);
            }

            // Demo Accountant Account
            $accountantRole = Role::where('name', 'ACCOUNTANT')->first();
            $accountantUser = User::updateOrCreate(
                ['username' => 'accountant'],
                [
                    'email' => 'accountant@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($accountantRole) {
                $accountantUser->roles()->syncWithoutDetaching([$accountantRole->id => ['created_at' => now()]]);
            }

            // Demo Basic Employee Account
            $employeeRole = Role::where('name', 'EMPLOYEE')->first();
            $employeeUser = User::updateOrCreate(
                ['username' => 'employee'],
                [
                    'email' => 'employee@example.com',
                    'password_hash' => Hash::make('Admin@123456'),
                    'status' => 'ACTIVE',
                ]
            );
            if ($employeeRole) {
                $employeeUser->roles()->syncWithoutDetaching([$employeeRole->id => ['created_at' => now()]]);
            }
        }

        $this->call([
            DemoCatalogSeeder::class,
        ]);
    }
}
