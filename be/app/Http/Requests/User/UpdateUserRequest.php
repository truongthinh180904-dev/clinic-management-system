<?php

namespace App\Http\Requests\User;

use App\Models\Role;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateUserRequest extends FormRequest
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
        $userId = $this->getTargetUserId();

        return [
            'username' => ['sometimes', 'string', 'min:3', 'max:50', 'unique:users,username,'.$userId],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:users,email,'.$userId],
            'employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id', 'unique:users,employee_id,'.$userId],
            'status' => ['sometimes', 'string', 'in:ACTIVE,INACTIVE,LOCKED'],
            'roles' => ['sometimes', 'array'],
            'role_ids' => ['sometimes', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'role_names' => ['sometimes', 'array'],
            'role_names.*' => ['string', 'exists:roles,name'],
        ];
    }

    /**
     * Custom message for validation errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'username.min' => 'Tên đăng nhập phải có ít nhất 3 ký tự.',
            'username.max' => 'Tên đăng nhập không được vượt quá 50 ký tự.',
            'username.unique' => 'Tên đăng nhập đã tồn tại trên hệ thống.',
            'email.email' => 'Địa chỉ email không đúng định dạng.',
            'email.unique' => 'Địa chỉ email đã được sử dụng.',
            'employee_id.exists' => 'Hồ sơ nhân viên liên kết không tồn tại.',
            'employee_id.unique' => 'Nhân viên này đã được liên kết với một tài khoản khác.',
            'status.in' => 'Trạng thái tài khoản không hợp lệ (ACTIVE, INACTIVE, LOCKED).',
            'role_ids.*.exists' => 'Một hoặc nhiều vai trò không tồn tại trong hệ thống.',
            'role_names.*.exists' => 'Một hoặc nhiều tên vai trò không tồn tại trong hệ thống.',
        ];
    }

    /**
     * Handle a failed validation attempt.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.',
            'errors' => $validator->errors(),
        ], 422));
    }

    /**
     * Get the ID of the user being updated.
     */
    protected function getTargetUserId(): ?int
    {
        $userParam = $this->route('user');
        if (is_numeric($userParam)) {
            return (int) $userParam;
        }

        if ($userParam instanceof User) {
            return (int) $userParam->id;
        }

        if (is_string($userParam)) {
            $user = User::where('username', $userParam)->first();

            return $user ? (int) $user->id : null;
        }

        return null;
    }

    /**
     * Resolve roles input into a clean array of role IDs, or null if roles not sent.
     *
     * @return list<int>|null
     */
    public function getResolvedRoleIds(): ?array
    {
        if (! $this->has('roles') && ! $this->has('role_ids') && ! $this->has('role_names')) {
            return null;
        }

        if ($this->has('role_ids')) {
            return array_values(array_map('intval', (array) $this->input('role_ids', [])));
        }

        if ($this->has('role_names')) {
            $names = (array) $this->input('role_names', []);
            if (empty($names)) {
                return [];
            }

            return array_values(Role::whereIn('name', $names)->pluck('id')->all());
        }

        if ($this->has('roles')) {
            $raw = (array) $this->input('roles', []);
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
                $ids = array_merge($ids, Role::whereIn('name', $names)->pluck('id')->all());
            }

            return array_values(array_unique($ids));
        }

        return [];
    }
}
