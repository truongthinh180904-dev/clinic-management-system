<?php

namespace App\Models;

use Carbon\Carbon;
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
    public const STATUS_ACTIVE = 'ACTIVE';

    public const STATUS_COMPLETED = 'COMPLETED';

    public const STATUS_EXPIRED = 'EXPIRED';

    public const STATUS_CANCELLED = 'CANCELLED';

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

    /**
     * Check if package is active.
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Check if package has expired on given date (defaults to today).
     */
    public function isExpiredOn(string|Carbon|null $date = null): bool
    {
        if ($this->status === self::STATUS_EXPIRED) {
            return true;
        }

        if (! $this->expiry_date) {
            return false;
        }

        $checkDate = $date ? Carbon::parse($date)->startOfDay() : Carbon::today();
        $expiry = Carbon::parse($this->expiry_date)->startOfDay();

        return $expiry->lt($checkDate);
    }
}
