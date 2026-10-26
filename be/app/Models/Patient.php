<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'patient_code',
    'full_name',
    'date_of_birth',
    'gender',
    'phone',
    'email',
    'address',
    'emergency_contact_name',
    'emergency_contact_phone',
    'first_visit_date',
    'last_visit_date',
    'status',
    'notes',
])]
class Patient extends Model
{
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'first_visit_date' => 'date',
            'last_visit_date' => 'date',
        ];
    }

    public function files(): HasMany
    {
        return $this->hasMany(PatientFile::class, 'patient_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'patient_id');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'patient_id');
    }

    public function patientPackages(): HasMany
    {
        return $this->hasMany(PatientPackage::class, 'patient_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'patient_id');
    }
}
