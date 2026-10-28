<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'visit_code',
    'patient_id',
    'employee_id',
    'service_id',
    'patient_package_id',
    'appointment_id',
    'visit_date',
    'quantity',
    'unit_price',
    'discount_amount',
    'total_amount',
    'payment_status',
    'status',
    'notes',
    'created_by',
])]
class Visit extends Model
{
    public const STATUS_SCHEDULED = 'SCHEDULED';

    public const STATUS_WAITING = 'WAITING';

    public const STATUS_IN_PROGRESS = 'IN_PROGRESS';

    public const STATUS_COMPLETED = 'COMPLETED';

    public const STATUS_CANCELLED = 'CANCELLED';

    public const PAYMENT_STATUS_UNPAID = 'UNPAID';

    public const PAYMENT_STATUS_PARTIAL = 'PARTIAL';

    public const PAYMENT_STATUS_PAID = 'PAID';

    public const PAYMENT_STATUS_PACKAGED = 'PACKAGED';

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'payment_status' => self::PAYMENT_STATUS_UNPAID,
        'status' => self::STATUS_SCHEDULED,
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'datetime',
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function patientPackage(): BelongsTo
    {
        return $this->belongsTo(PatientPackage::class, 'patient_package_id');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function medicalRecord(): HasOne
    {
        return $this->hasOne(MedicalRecord::class, 'visit_id');
    }

    public function patientFiles(): HasMany
    {
        return $this->hasMany(PatientFile::class, 'visit_id');
    }

    public function files(): HasMany
    {
        return $this->patientFiles();
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'visit_id');
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }
}
