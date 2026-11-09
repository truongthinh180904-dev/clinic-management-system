<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'service_code',
    'name',
    'description',
    'price',
    'duration_minutes',
    'status',
])]
class Service extends Model
{
    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'duration_minutes' => 30,
        'status' => 'ACTIVE',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'duration_minutes' => 'integer',
        ];
    }

    public function packages(): BelongsToMany
    {
        return $this->belongsToMany(ServicePackage::class, 'package_services', 'service_id', 'package_id')
            ->using(PackageService::class)
            ->withPivot(['quantity', 'created_at']);
    }

    public function packageServices(): HasMany
    {
        return $this->hasMany(PackageService::class, 'service_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'service_id');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'service_id');
    }
}
