<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'package_code',
    'name',
    'description',
    'price',
    'total_sessions',
    'validity_days',
    'status',
])]
class ServicePackage extends Model
{
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'total_sessions' => 'integer',
            'validity_days' => 'integer',
        ];
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'package_services', 'package_id', 'service_id')
            ->using(PackageService::class)
            ->withPivot(['quantity', 'created_at']);
    }

    public function packageServices(): HasMany
    {
        return $this->hasMany(PackageService::class, 'package_id');
    }

    public function patientPackages(): HasMany
    {
        return $this->hasMany(PatientPackage::class, 'package_id');
    }
}
