<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Handle user login request.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $username = (string) $request->input('username');
        $throttleKey = Str::lower($username).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'success' => false,
                'message' => "Bạn đã gửi quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau {$seconds} giây.",
                'errors' => null,
            ], 429);
        }

        $user = User::where('username', $username)
            ->orWhere('email', $username)
            ->first();

        if (! $user || ! Hash::check((string) $request->input('password'), (string) $user->password_hash)) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'success' => false,
                'message' => 'Tên đăng nhập hoặc mật khẩu không chính xác.',
                'errors' => null,
            ], 401);
        }

        if ($user->status !== 'ACTIVE') {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
                'errors' => null,
            ], 403);
        }

        RateLimiter::clear($throttleKey);

        $now = now();
        $user->update(['last_login_at' => $now]);

        AuditLog::create([
            'user_id' => $user->id,
            'module' => 'auth',
            'action' => 'login',
            'table_name' => 'users',
            'record_id' => $user->id,
            'old_values' => null,
            'new_values' => ['last_login_at' => $now->toIso8601String()],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => $now,
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập thành công.',
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer',
                'user' => new UserResource($user->load(['roles.permissions', 'employee'])),
            ],
        ], 200);
    }

    /**
     * Retrieve the currently authenticated user.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing(['roles.permissions', 'employee']);

        return response()->json([
            'success' => true,
            'message' => 'Lấy thông tin người dùng thành công.',
            'data' => new UserResource($user),
        ], 200);
    }

    /**
     * Handle user logout request.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->currentAccessToken()?->delete();
            app('auth')->forgetGuards();

            AuditLog::create([
                'user_id' => $user->id,
                'module' => 'auth',
                'action' => 'logout',
                'table_name' => 'users',
                'record_id' => $user->id,
                'old_values' => null,
                'new_values' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Đăng xuất thành công.',
            'data' => null,
        ], 200);
    }
}
