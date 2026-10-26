<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'employee_code',
    'full_name',
    'phone',
    'email',
    'date_of_birth',
    'gender',
    'position',
    'department',
    'hire_date',
    'status',
    'notes',
])]
class Employee extends Model
{
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'hire_date' => 'date',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'employee_id');
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'employee_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'employee_id');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'employee_id');
    }

    public function medicalRecords(): HasMany
    {
        return $this->hasMany(MedicalRecord::class, 'doctor_id');
    }

    public function kpiTargets(): HasMany
    {
        return $this->hasMany(KpiTarget::class, 'employee_id');
    }
}
