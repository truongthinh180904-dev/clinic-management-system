<?php

namespace App\Http\Resources;

use App\Models\Employee;
use App\Services\DataMaskingService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Employee
 */
class EmployeeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $canBypass = DataMaskingService::canBypassMasking($user)
            || ($user && $user->employee_id === $this->id)
            || ($user && $user->hasPermission('employees.manage'))
            || ($user && $user->hasPermission('employees.update'));

        return [
            'id' => $this->id,
            'employee_code' => $this->employee_code,
            'full_name' => $this->full_name,
            'phone' => $canBypass ? $this->phone : DataMaskingService::maskPhone($this->phone),
            'email' => $this->email,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender,
            'position' => $this->position,
            'department' => $this->department,
            'hire_date' => $this->hire_date?->format('Y-m-d'),
            'status' => $this->status,
            'notes' => $this->notes,
            'user' => $this->whenLoaded('user', function () {
                return $this->user ? [
                    'id' => $this->user->id,
                    'username' => $this->user->username,
                    'email' => $this->user->email,
                    'status' => $this->user->status,
                ] : null;
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
