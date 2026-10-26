<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

#[Fillable(['package_id', 'service_id', 'quantity', 'created_at'])]
class PackageService extends Pivot
{
    public const UPDATED_AT = null;

    public $timestamps = false;

    protected $table = 'package_services';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function getUpdatedAtColumn(): ?string
    {
        return null;
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(ServicePackage::class, 'package_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }
}
