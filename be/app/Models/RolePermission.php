<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

#[Fillable(['role_id', 'permission_id', 'created_at'])]
class RolePermission extends Pivot
{
    public const UPDATED_AT = null;

    public $timestamps = false;

    protected $table = 'role_permissions';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function getUpdatedAtColumn(): ?string
    {
        return null;
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function permission(): BelongsTo
    {
        return $this->belongsTo(Permission::class, 'permission_id');
    }
}
