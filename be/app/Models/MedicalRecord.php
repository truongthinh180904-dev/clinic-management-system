<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'visit_id',
    'doctor_id',
    'medical_history',
    'diagnosis',
    'indication',
    'result',
    'treatment',
    'follow_up_date',
])]
class MedicalRecord extends Model
{
    protected function casts(): array
    {
        return [
            'follow_up_date' => 'date',
        ];
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class, 'visit_id');
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }
}
