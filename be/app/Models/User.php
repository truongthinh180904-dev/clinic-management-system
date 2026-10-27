<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

#[Fillable(['employee_id', 'username', 'email', 'password_hash', 'status', 'last_login_at'])]
#[Hidden(['password_hash'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The column name of the password field used for authentication.
     *
     * @var string
     */
    protected $authPasswordName = 'password_hash';

    /**
     * Get the name of the password attribute for the user.
     */
    public function getAuthPasswordName(): string
    {
        return $this->authPasswordName;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password_hash' => 'hashed',
            'last_login_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles', 'user_id', 'role_id')
            ->using(UserRole::class)
            ->withPivot('created_at');
    }

    public function userRoles(): HasMany
    {
        return $this->hasMany(UserRole::class, 'user_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }

    public function uploadedPatientFiles(): HasMany
    {
        return $this->hasMany(PatientFile::class, 'uploaded_by');
    }

    public function createdAppointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'created_by');
    }

    public function createdVisits(): HasMany
    {
        return $this->hasMany(Visit::class, 'created_by');
    }

    public function createdInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'created_by');
    }

    public function receivedPayments(): HasMany
    {
        return $this->hasMany(Payment::class, 'received_by');
    }

    public function createdExpenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'created_by');
    }

    public function approvedExpenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'approved_by');
    }

    public function cashTransactions(): HasMany
    {
        return $this->hasMany(CashTransaction::class, 'created_by');
    }

    public function createdKpiTargets(): HasMany
    {
        return $this->hasMany(KpiTarget::class, 'created_by');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    public function requestedApprovals(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class, 'requested_by');
    }

    public function approvedRequests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class, 'approved_by');
    }

    public function inventoryTransactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'created_by');
    }

    public function importBatches(): HasMany
    {
        return $this->hasMany(ImportBatch::class, 'imported_by');
    }

    public function updatedSystemSettings(): HasMany
    {
        return $this->hasMany(SystemSetting::class, 'updated_by');
    }

    /**
     * Create a new personal API token for the user.
     *
     * @param  list<string>  $abilities
     */
    public function createToken(string $name = 'auth-token', array $abilities = ['*']): object
    {
        $plainToken = Str::random(64);
        $hashedToken = hash('sha256', $plainToken);

        Cache::put('auth_token:'.$hashedToken, $this->id, now()->addDays(7));

        return new class($plainToken)
        {
            public function __construct(public string $plainTextToken) {}
        };
    }

    /**
     * Get the access token currently associated with the request.
     */
    public function currentAccessToken(): ?object
    {
        $token = request()->bearerToken();
        if (! $token) {
            return null;
        }

        return new class($token)
        {
            public function __construct(protected string $token) {}

            public function delete(): bool
            {
                Cache::forget('auth_token:'.hash('sha256', $this->token));

                return true;
            }
        };
    }

    /**
     * Check if the user has any of the given roles.
     *
     * @param  string|list<string>  $roles
     */
    public function hasRole(string|array $roles): bool
    {
        $roleList = is_array($roles) ? $roles : func_get_args();

        if ($this->relationLoaded('roles')) {
            return $this->roles->pluck('name')->intersect($roleList)->isNotEmpty();
        }

        return $this->roles()->whereIn('name', $roleList)->exists();
    }

    /**
     * Get all unique permissions granted to the user through their roles.
     *
     * @return Collection<int, Permission>
     */
    public function permissions(): Collection
    {
        if ($this->relationLoaded('roles')) {
            return $this->roles->flatMap(function (Role $role) {
                return $role->relationLoaded('permissions') ? $role->permissions : $role->permissions()->get();
            })->unique('id')->values();
        }

        return Permission::whereHas('roles', function ($query) {
            $query->whereIn('roles.id', $this->roles()->pluck('roles.id'));
        })->get();
    }

    /**
     * Check if the user has a specific permission.
     */
    public function hasPermission(string $permissionKey): bool
    {
        if ($this->hasRole('ADMIN')) {
            return true;
        }

        return $this->permissions()->contains('permission_key', $permissionKey);
    }
}
