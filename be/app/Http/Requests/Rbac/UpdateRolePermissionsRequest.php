<?php

namespace App\Http\Requests\Rbac;

use App\Models\Permission;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

class UpdateRolePermissionsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'permissions' => ['sometimes', 'array'],
            'permission_ids' => ['sometimes', 'array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
            'permission_keys' => ['sometimes', 'array'],
            'permission_keys.*' => ['string', 'exists:permissions,permission_key'],
        ];
    }

    /**
     * Resolve permissions array into a clean array of permission IDs.
     *
     * @return list<int>
     */
    public function getResolvedPermissionIds(): array
    {
        if ($this->has('permission_ids')) {
            return array_values(array_map('intval', (array) $this->input('permission_ids', [])));
        }

        if ($this->has('permission_keys')) {
            $keys = (array) $this->input('permission_keys', []);
            if (empty($keys)) {
                return [];
            }

            return array_values(Permission::whereIn('permission_key', $keys)->pluck('id')->all());
        }

        if ($this->has('permissions')) {
            $raw = (array) $this->input('permissions', []);
            if (empty($raw)) {
                return [];
            }

            $ids = [];
            $keys = [];

            foreach ($raw as $item) {
                if (is_numeric($item)) {
                    $ids[] = (int) $item;
                } elseif (is_string($item)) {
                    $keys[] = $item;
                }
            }

            if (! empty($keys)) {
                $foundIds = Permission::whereIn('permission_key', $keys)->pluck('id')->all();
                if (count($foundIds) !== count(array_unique($keys))) {
                    throw ValidationException::withMessages([
                        'permissions' => ['Một hoặc nhiều mã quyền không hợp lệ trong hệ thống.'],
                    ]);
                }
                $ids = array_merge($ids, $foundIds);
            }

            if (! empty($ids)) {
                $uniqueIds = array_values(array_unique($ids));
                $count = Permission::whereIn('id', $uniqueIds)->count();
                if ($count !== count($uniqueIds)) {
                    throw ValidationException::withMessages([
                        'permissions' => ['Một hoặc nhiều ID quyền không tồn tại trong hệ thống.'],
                    ]);
                }

                return $uniqueIds;
            }

            return [];
        }

        throw ValidationException::withMessages([
            'permissions' => ['Vui lòng cung cấp danh sách quyền (permissions, permission_ids hoặc permission_keys).'],
        ]);
    }
}
