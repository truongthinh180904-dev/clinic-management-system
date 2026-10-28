<?php

namespace App\Providers;

use App\Models\Appointment;
use App\Models\ApprovalRequest;
use App\Models\CashTransaction;
use App\Models\Expense;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Visit;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Relation::morphMap([
            'Payment' => Payment::class,
            'payment' => Payment::class,
            'Expense' => Expense::class,
            'expense' => Expense::class,
            'Invoice' => Invoice::class,
            'invoice' => Invoice::class,
            'ApprovalRequest' => ApprovalRequest::class,
            'approval_request' => ApprovalRequest::class,
            'CashTransaction' => CashTransaction::class,
            'cash_transaction' => CashTransaction::class,
            'InventoryTransaction' => InventoryTransaction::class,
            'inventory_transaction' => InventoryTransaction::class,
            'Product' => Product::class,
            'product' => Product::class,
            'Patient' => Patient::class,
            'patient' => Patient::class,
            'PatientPackage' => PatientPackage::class,
            'patient_package' => PatientPackage::class,
            'Visit' => Visit::class,
            'visit' => Visit::class,
            'Appointment' => Appointment::class,
            'appointment' => Appointment::class,
        ]);

        // -----------------------------------------------------------------
        // Rate Limiting Configuration for Sensitive Endpoints (Phase 3 P3-024)
        // -----------------------------------------------------------------
        RateLimiter::for('login', function (Request $request) {
            $key = Str::lower((string) $request->input('username', 'guest')).'|'.$request->ip();

            return Limit::perMinute(5)->by($key)->response(function (Request $request, array $headers) {
                $retryAfter = $headers['Retry-After'] ?? 60;

                return response()->json([
                    'success' => false,
                    'message' => "Bạn đã gửi quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau {$retryAfter} giây.",
                    'errors' => null,
                    'retry_after' => (int) $retryAfter,
                ], 429, $headers);
            });
        });

        RateLimiter::for('export', function (Request $request) {
            $key = (string) ($request->user()?->id ?: $request->ip());

            return Limit::perMinute(10)->by($key)->response(function (Request $request, array $headers) {
                $retryAfter = $headers['Retry-After'] ?? 60;

                return response()->json([
                    'success' => false,
                    'message' => "Bạn đã vượt quá giới hạn tải xuất dữ liệu (tối đa 10 lần/phút). Vui lòng thử lại sau {$retryAfter} giây.",
                    'errors' => null,
                    'retry_after' => (int) $retryAfter,
                ], 429, $headers);
            });
        });

        RateLimiter::for('upload', function (Request $request) {
            $key = (string) ($request->user()?->id ?: $request->ip());

            return Limit::perMinute(20)->by($key)->response(function (Request $request, array $headers) {
                $retryAfter = $headers['Retry-After'] ?? 60;

                return response()->json([
                    'success' => false,
                    'message' => "Bạn đã vượt quá giới hạn tải lên tệp tin (tối đa 20 lần/phút). Vui lòng thử lại sau {$retryAfter} giây.",
                    'errors' => null,
                    'retry_after' => (int) $retryAfter,
                ], 429, $headers);
            });
        });
    }
}
