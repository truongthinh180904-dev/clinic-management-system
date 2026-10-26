<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'patient_id',
    'package_id',
    'purchase_date',
    'expiry_date',
    'total_sessions',
    'used_sessions',
    'remaining_sessions',
    'price',
    'status',
])]
class PatientPackage extends Model
{
    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'expiry_date' => 'date',
            'total_sessions' => 'integer',
            'used_sessions' => 'integer',
            'remaining_sessions' => 'integer',
            'price' => 'decimal:2',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(ServicePackage::class, 'package_id');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'patient_package_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'patient_package_id');
    }
}
