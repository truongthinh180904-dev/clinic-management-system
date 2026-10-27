<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlertRuleResource;
use App\Models\AlertRule;
use App\Models\AuditLog;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Notification;
use App\Models\PatientPackage;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertRuleController extends Controller
{
    /**
     * Display a listing of alert rules.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AlertRule::query();

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('alert_type')) {
            $query->where('alert_type', (string) $request->input('alert_type'));
        }

        $rules = $query->orderBy('id', 'asc')->get();

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh sách quy tắc cảnh báo thành công.',
            'data' => AlertRuleResource::collection($rules),
        ]);
    }

    /**
     * Store a newly created alert rule.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'alert_type' => 'required|string|max:50',
            'threshold_value' => 'nullable|numeric|min:0',
            'threshold_days' => 'nullable|integer|min:0',
            'threshold_sessions' => 'nullable|integer|min:0',
            'status' => 'nullable|in:ACTIVE,INACTIVE',
        ]);

        $validated['status'] = $validated['status'] ?? 'ACTIVE';

        $rule = AlertRule::create($validated);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'alert_rules',
            'action' => 'create',
            'table_name' => 'alert_rules',
            'record_id' => (string) $rule->id,
            'old_values' => null,
            'new_values' => $rule->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tạo quy tắc cảnh báo thành công.',
            'data' => new AlertRuleResource($rule),
        ], 201);
    }

    /**
     * Display the specified alert rule.
     */
    public function show(AlertRule $alertRule): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết quy tắc cảnh báo thành công.',
            'data' => new AlertRuleResource($alertRule),
        ]);
    }

    /**
     * Update the specified alert rule.
     */
    public function update(Request $request, AlertRule $alertRule): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'alert_type' => 'sometimes|required|string|max:50',
            'threshold_value' => 'nullable|numeric|min:0',
            'threshold_days' => 'nullable|integer|min:0',
            'threshold_sessions' => 'nullable|integer|min:0',
            'status' => 'nullable|in:ACTIVE,INACTIVE',
        ]);

        $oldValues = $alertRule->toArray();
        $alertRule->update($validated);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'alert_rules',
            'action' => 'update',
            'table_name' => 'alert_rules',
            'record_id' => (string) $alertRule->id,
            'old_values' => $oldValues,
            'new_values' => $alertRule->fresh()->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật quy tắc cảnh báo thành công.',
            'data' => new AlertRuleResource($alertRule->fresh()),
        ]);
    }

    /**
     * Remove the specified alert rule.
     */
    public function destroy(Request $request, AlertRule $alertRule): JsonResponse
    {
        $oldValues = $alertRule->toArray();
        $id = $alertRule->id;
        $alertRule->delete();

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'alert_rules',
            'action' => 'delete',
            'table_name' => 'alert_rules',
            'record_id' => (string) $id,
            'old_values' => $oldValues,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Xóa quy tắc cảnh báo thành công.',
        ]);
    }

    /**
     * Scan active alert rules and automatically generate notifications without unread duplicates.
     */
    public function scan(Request $request): JsonResponse
    {
        $activeRules = AlertRule::where('status', 'ACTIVE')->get();

        // Target recipients: Admins, Managers, users with notifications.view, and current active user
        $targetUsers = User::where('status', 'ACTIVE')
            ->whereHas('roles', function ($rq) {
                $rq->whereIn('name', ['ADMIN', 'MANAGER'])
                    ->orWhereHas('permissions', function ($pq) {
                        $pq->where('permission_key', 'notifications.view');
                    });
            })
            ->get();

        $currentUser = $request->user() ?? auth()->user();

        if ($targetUsers->isEmpty() && $currentUser) {
            $targetUsers = collect([$currentUser]);
        }

        if ($currentUser && ! $targetUsers->contains('id', $currentUser->id)) {
            $targetUsers->push($currentUser);
        }

        $targetUsers = $targetUsers->unique('id')->values();

        $createdCount = 0;
        $details = [
            'low_stock_alerts' => 0,
            'package_expiring_alerts' => 0,
            'overdue_invoice_alerts' => 0,
        ];

        foreach ($activeRules as $rule) {
            if ($rule->alert_type === 'LOW_STOCK') {
                $products = Product::where('status', 'ACTIVE')->get();

                foreach ($products as $product) {
                    $currentStock = (float) InventoryTransaction::where('product_id', $product->id)
                        ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as total")
                        ->value('total');

                    $threshold = $rule->threshold_value !== null
                        ? (float) $rule->threshold_value
                        : (float) ($product->minimum_stock ?? 0);

                    if ($currentStock <= $threshold) {
                        foreach ($targetUsers as $targetUser) {
                            $exists = Notification::where('user_id', $targetUser->id)
                                ->where('type', 'LOW_STOCK')
                                ->where('reference_type', 'Product')
                                ->where('reference_id', $product->id)
                                ->where('is_read', false)
                                ->exists();

                            if (! $exists) {
                                Notification::create([
                                    'user_id' => $targetUser->id,
                                    'type' => 'LOW_STOCK',
                                    'title' => 'Cảnh báo tồn kho thấp: '.$product->name,
                                    'message' => "Sản phẩm {$product->name} ({$product->product_code}) hiện có tồn kho {$currentStock} {$product->unit}, đã đạt hoặc dưới định mức tối thiểu ({$threshold} {$product->unit}).",
                                    'reference_type' => 'Product',
                                    'reference_id' => $product->id,
                                    'is_read' => false,
                                    'created_at' => now(),
                                ]);
                                $createdCount++;
                                $details['low_stock_alerts']++;
                            }
                        }
                    }
                }
            } elseif ($rule->alert_type === 'PACKAGE_EXPIRING') {
                $thresholdDays = $rule->threshold_days;
                $thresholdSessions = $rule->threshold_sessions;

                $packages = PatientPackage::where('status', PatientPackage::STATUS_ACTIVE)
                    ->with(['patient', 'package'])
                    ->get();

                foreach ($packages as $pkg) {
                    $isExpiring = false;

                    if ($thresholdDays !== null && $pkg->expiry_date) {
                        $daysUntilExpiry = now()->startOfDay()->diffInDays($pkg->expiry_date, false);
                        if ($daysUntilExpiry <= $thresholdDays) {
                            $isExpiring = true;
                        }
                    }

                    if ($thresholdSessions !== null && $pkg->remaining_sessions !== null) {
                        if ($pkg->remaining_sessions <= $thresholdSessions) {
                            $isExpiring = true;
                        }
                    }

                    if ($isExpiring) {
                        $pkgName = $pkg->package?->name ?? "Gói #{$pkg->id}";
                        $patientName = $pkg->patient?->full_name ?? "Bệnh nhân #{$pkg->patient_id}";
                        $expiryStr = $pkg->expiry_date ? $pkg->expiry_date->format('d/m/Y') : 'Không thời hạn';

                        foreach ($targetUsers as $targetUser) {
                            $exists = Notification::where('user_id', $targetUser->id)
                                ->where('type', 'PACKAGE_EXPIRING')
                                ->where('reference_type', 'PatientPackage')
                                ->where('reference_id', $pkg->id)
                                ->where('is_read', false)
                                ->exists();

                            if (! $exists) {
                                Notification::create([
                                    'user_id' => $targetUser->id,
                                    'type' => 'PACKAGE_EXPIRING',
                                    'title' => "Cảnh báo gói dịch vụ sắp hết hạn: {$pkgName}",
                                    'message' => "Gói dịch vụ '{$pkgName}' của bệnh nhân {$patientName} sắp hết hạn (còn {$pkg->remaining_sessions} buổi, hạn dùng: {$expiryStr}).",
                                    'reference_type' => 'PatientPackage',
                                    'reference_id' => $pkg->id,
                                    'is_read' => false,
                                    'created_at' => now(),
                                ]);
                                $createdCount++;
                                $details['package_expiring_alerts']++;
                            }
                        }
                    }
                }
            } elseif ($rule->alert_type === 'OVERDUE_INVOICE') {
                $thresholdDays = $rule->threshold_days;
                $thresholdValue = $rule->threshold_value;

                $invoiceQuery = Invoice::whereIn('status', ['UNPAID', 'PARTIAL'])
                    ->where('remaining_amount', '>', 0);

                if ($thresholdValue !== null && (float) $thresholdValue > 0) {
                    $invoiceQuery->where('remaining_amount', '>=', (float) $thresholdValue);
                }

                if ($thresholdDays !== null && (int) $thresholdDays >= 0) {
                    $invoiceQuery->where('issued_at', '<=', now()->subDays((int) $thresholdDays));
                }

                $invoices = $invoiceQuery->with('patient')->get();

                foreach ($invoices as $invoice) {
                    $patientName = $invoice->patient?->full_name ?? "Bệnh nhân #{$invoice->patient_id}";
                    $formattedDebt = number_format((float) $invoice->remaining_amount, 0, ',', '.');

                    foreach ($targetUsers as $targetUser) {
                        $exists = Notification::where('user_id', $targetUser->id)
                            ->where('type', 'OVERDUE_INVOICE')
                            ->where('reference_type', 'Invoice')
                            ->where('reference_id', $invoice->id)
                            ->where('is_read', false)
                            ->exists();

                        if (! $exists) {
                            Notification::create([
                                'user_id' => $targetUser->id,
                                'type' => 'OVERDUE_INVOICE',
                                'title' => "Cảnh báo hóa đơn công nợ quá hạn: {$invoice->invoice_code}",
                                'message' => "Hóa đơn {$invoice->invoice_code} của bệnh nhân {$patientName} còn nợ {$formattedDebt} VNĐ quá hạn thanh toán.",
                                'reference_type' => 'Invoice',
                                'reference_id' => $invoice->id,
                                'is_read' => false,
                                'created_at' => now(),
                            ]);
                            $createdCount++;
                            $details['overdue_invoice_alerts']++;
                        }
                    }
                }
            }
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'alert_rules',
            'action' => 'scan',
            'table_name' => 'alert_rules',
            'record_id' => 'scan_job',
            'old_values' => null,
            'new_values' => [
                'scanned_rules_count' => $activeRules->count(),
                'created_notifications_count' => $createdCount,
                'details' => $details,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Quét và đồng bộ cảnh báo tự động thành công.',
            'data' => [
                'scanned_rules_count' => $activeRules->count(),
                'created_notifications_count' => $createdCount,
                'details' => $details,
            ],
        ]);
    }
}
