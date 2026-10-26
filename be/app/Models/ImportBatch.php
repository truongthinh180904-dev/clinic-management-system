<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'module',
    'file_name',
    'total_rows',
    'success_rows',
    'error_rows',
    'status',
    'imported_by',
    'created_at',
    'completed_at',
])]
class ImportBatch extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'success_rows' => 'integer',
            'error_rows' => 'integer',
            'created_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function errors(): HasMany
    {
        return $this->hasMany(ImportError::class, 'batch_id');
    }
}
