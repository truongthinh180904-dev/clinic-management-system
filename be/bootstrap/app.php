<?php

use App\Http\Middleware\CheckActiveUser;
use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\CheckRole;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\RequestGuard;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->alias([
            'active_user' => CheckActiveUser::class,
            'permission' => CheckPermission::class,
            'role' => CheckRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
                    'errors' => null,
                ], 401);
            }
        });
    })
    ->booted(function (): void {
        JsonResource::withoutWrapping();

        Auth::extend('token_bearer', function ($app, $name, array $config) {
            $guard = new class(function (Request $request) {
                $token = $request->bearerToken();
                if (! $token) {
                    return null;
                }

                $userId = Cache::get('auth_token:'.hash('sha256', $token));
                if (! $userId) {
                    return null;
                }

                return User::with(['roles.permissions', 'employee'])->find($userId);
            },
                $app['request'],
                $app['auth']->createUserProvider($config['provider'] ?? null)
            ) extends RequestGuard {
                public function user()
                {
                    $token = $this->request->bearerToken();
                    if (! $token) {
                        return $this->user;
                    }

                    if (! is_null($this->user)) {
                        $cachedUserId = Cache::get('auth_token:'.hash('sha256', $token));
                        if ($cachedUserId && (int) $this->user->getAuthIdentifier() === (int) $cachedUserId) {
                            return $this->user;
                        }

                        $this->user = null;
                    }

                    return parent::user();
                }

                public function setRequest(Request $request)
                {
                    if ($request->bearerToken()) {
                        $this->user = null;
                    }

                    return parent::setRequest($request);
                }
            };

            $app->refresh('request', $guard, 'setRequest');

            return $guard;
        });
    })
    ->create();
