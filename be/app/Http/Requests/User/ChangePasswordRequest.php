<?php

namespace App\Http\Requests\User;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class ChangePasswordRequest extends FormRequest
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
            'current_password' => ['nullable', 'string'],
            'password' => ['required_without:new_password', 'nullable', 'string', 'min:6', 'confirmed'],
            'new_password' => ['required_without:password', 'nullable', 'string', 'min:6', 'confirmed'],
            'password_confirmation' => ['nullable', 'string'],
            'new_password_confirmation' => ['nullable', 'string'],
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
            'password.required_without' => 'Vui lòng nhập mật khẩu mới.',
            'new_password.required_without' => 'Vui lòng nhập mật khẩu mới.',
            'password.min' => 'Mật khẩu mới phải có ít nhất 6 ký tự.',
            'new_password.min' => 'Mật khẩu mới phải có ít nhất 6 ký tự.',
            'password.confirmed' => 'Xác nhận mật khẩu mới không khớp.',
            'new_password.confirmed' => 'Xác nhận mật khẩu mới không khớp.',
        ];
    }

    /**
     * Retrieve the validated new password.
     */
    public function getNewPassword(): string
    {
        return (string) ($this->input('new_password') ?? $this->input('password'));
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
}
