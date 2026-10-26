<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'batch_id',
    'row_number',
    'column_name',
    'error_message',
    'raw_data',
    'created_at',
])]
class ImportError extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'row_number' => 'integer',
            'raw_data' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class, 'batch_id');
    }
}
