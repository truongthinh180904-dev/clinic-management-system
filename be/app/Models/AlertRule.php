<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'name',
    'alert_type',
    'threshold_value',
    'threshold_days',
    'threshold_sessions',
    'status',
])]
class AlertRule extends Model
{
    protected function casts(): array
    {
        return [
            'threshold_value' => 'decimal:2',
            'threshold_days' => 'integer',
            'threshold_sessions' => 'integer',
        ];
    }
}
