<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
                'errors' => null,
            ], 401);
        }

        if ($user->status !== 'ACTIVE') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
                'errors' => null,
            ], 403);
        }

        if (empty($permissions)) {
            return $next($request);
        }

        if ($user->hasRole('ADMIN')) {
            return $next($request);
        }

        $requiredKeys = [];
        foreach ($permissions as $permission) {
            foreach (explode('|', $permission) as $item) {
                $trimmed = trim($item);
                if ($trimmed !== '') {
                    $requiredKeys[] = $trimmed;
                }
            }
        }

        if (empty($requiredKeys) || $user->hasPermission($requiredKeys)) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Bạn không có quyền thực hiện thao tác này.',
            'errors' => [
                'required_permissions' => $requiredKeys,
            ],
        ], 403);
    }
}
