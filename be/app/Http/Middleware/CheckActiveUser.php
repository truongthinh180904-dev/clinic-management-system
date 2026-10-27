<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckActiveUser
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->status !== 'ACTIVE') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.',
                'errors' => null,
            ], 403);
        }

        return $next($request);
    }
}
