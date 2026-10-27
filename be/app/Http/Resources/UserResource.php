<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'username' => $this->username,
            'email' => $this->email,
            'status' => $this->status,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'employee' => $this->employee ? [
                'id' => $this->employee->id,
                'employee_code' => $this->employee->employee_code,
                'full_name' => $this->employee->full_name,
                'phone' => $this->employee->phone,
                'email' => $this->employee->email,
                'position' => $this->employee->position,
                'department' => $this->employee->department,
                'status' => $this->employee->status,
            ] : null,
            'roles' => $this->roles->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'description' => $role->description,
                ];
            })->values(),
            'permissions' => $this->permissions()->pluck('permission_key')->values(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
