<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['module', 'action', 'permission_key', 'description'])]
class Permission extends Model
{
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permissions', 'permission_id', 'role_id')
            ->using(RolePermission::class)
            ->withPivot('created_at');
    }

    public function rolePermissions(): HasMany
    {
        return $this->hasMany(RolePermission::class, 'permission_id');
    }
}
