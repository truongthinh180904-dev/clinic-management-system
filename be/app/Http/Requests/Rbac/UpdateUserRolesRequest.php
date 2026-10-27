<?php

namespace App\Http\Requests\Rbac;

use App\Models\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

class UpdateUserRolesRequest extends FormRequest
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
            'roles' => ['sometimes', 'array'],
            'role_ids' => ['sometimes', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'role_names' => ['sometimes', 'array'],
            'role_names.*' => ['string', 'exists:roles,name'],
        ];
    }

    /**
     * Resolve roles input into a clean array of role IDs.
     *
     * @return list<int>
     */
    public function getResolvedRoleIds(): array
    {
        if ($this->has('role_ids')) {
            $ids = array_values(array_map('intval', (array) $this->input('role_ids', [])));
            if (empty($ids)) {
                throw ValidationException::withMessages([
                    'role_ids' => ['Tài khoản người dùng phải có ít nhất một vai trò.'],
                ]);
            }

            return $ids;
        }

        if ($this->has('role_names')) {
            $names = (array) $this->input('role_names', []);
            if (empty($names)) {
                throw ValidationException::withMessages([
                    'role_names' => ['Tài khoản người dùng phải có ít nhất một vai trò.'],
                ]);
            }

            $ids = Role::whereIn('name', $names)->pluck('id')->all();
            if (count($ids) !== count(array_unique($names))) {
                throw ValidationException::withMessages([
                    'role_names' => ['Một hoặc nhiều tên vai trò không hợp lệ.'],
                ]);
            }

            return array_values($ids);
        }

        if ($this->has('roles')) {
            $raw = (array) $this->input('roles', []);
            if (empty($raw)) {
                throw ValidationException::withMessages([
                    'roles' => ['Tài khoản người dùng phải có ít nhất một vai trò.'],
                ]);
            }

            $ids = [];
            $names = [];

            foreach ($raw as $item) {
                if (is_numeric($item)) {
                    $ids[] = (int) $item;
                } elseif (is_string($item)) {
                    $names[] = $item;
                }
            }

            if (! empty($names)) {
                $foundIds = Role::whereIn('name', $names)->pluck('id')->all();
                if (count($foundIds) !== count(array_unique($names))) {
                    throw ValidationException::withMessages([
                        'roles' => ['Một hoặc nhiều tên vai trò không hợp lệ.'],
                    ]);
                }
                $ids = array_merge($ids, $foundIds);
            }

            if (! empty($ids)) {
                $uniqueIds = array_values(array_unique($ids));
                $count = Role::whereIn('id', $uniqueIds)->count();
                if ($count !== count($uniqueIds)) {
                    throw ValidationException::withMessages([
                        'roles' => ['Một hoặc nhiều ID vai trò không tồn tại.'],
                    ]);
                }

                return $uniqueIds;
            }

            throw ValidationException::withMessages([
                'roles' => ['Tài khoản người dùng phải có ít nhất một vai trò.'],
            ]);
        }

        throw ValidationException::withMessages([
            'roles' => ['Vui lòng cung cấp danh sách vai trò (roles, role_ids hoặc role_names).'],
        ]);
    }
}
