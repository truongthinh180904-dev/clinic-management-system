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
            DemoCatalogSeeder::class,
        ]);

        $adminRole = Role::where('name', 'ADMIN')->first();

        if (app()->isProduction()) {
            $adminInitialPassword = env('ADMIN_INITIAL_PASSWORD');
            if ($adminInitialPassword) {
                $adminUser = User::firstOrCreate(
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
            $adminUser = User::firstOrCreate(
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
        }
    }
}
