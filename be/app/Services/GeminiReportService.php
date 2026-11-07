<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\KpiTarget;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Service;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiReportService
{
    /**
     * Fallback models hierarchy in order of preference.
     *
     * @var array<int, string>
     */
    protected array $modelCandidates = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
    ];

    /**
     * Get live, accurate clinic data snapshot to ground the AI responses.
     *
     * @return array<string, mixed>
     */
    public function getClinicDataSnapshot(): array
    {
        $now = Carbon::now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd = $now->copy()->endOfDay();
        $monthStart = $now->copy()->startOfMonth()->startOfDay();
        $monthEnd = $now->copy()->endOfMonth()->endOfDay();

        // 1. FINANCIAL METRICS
        $todayCollected = (float) Payment::whereBetween('payment_date', [$todayStart, $todayEnd])
            ->orWhere(fn ($q) => $q->whereNull('payment_date')->whereBetween('created_at', [$todayStart, $todayEnd]))
            ->sum('amount');

        $todayInvoicesCount = Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($todayStart, $todayEnd) {
                $q->whereBetween('issued_at', [$todayStart, $todayEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$todayStart, $todayEnd]));
            })->count();

        $todayExpenses = (float) Expense::where('approval_status', 'APPROVED')
            ->where(function ($q) use ($todayStart, $todayEnd) {
                $q->whereBetween('expense_date', [$todayStart, $todayEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('expense_date')->whereBetween('created_at', [$todayStart, $todayEnd]));
            })->sum('amount');

        // Month to date
        $monthInvoicesQuery = Invoice::where('status', '!=', 'CANCELLED')
            ->where(function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('issued_at', [$monthStart, $monthEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('issued_at')->whereBetween('created_at', [$monthStart, $monthEnd]));
            });

        $monthInvoicedAmount = (float) (clone $monthInvoicesQuery)->sum('total_amount');
        $monthInvoicesCount = (clone $monthInvoicesQuery)->count();
        $monthUnpaidDebt = (float) (clone $monthInvoicesQuery)->sum('remaining_amount');

        $monthCollected = (float) Payment::where(function ($q) use ($monthStart, $monthEnd) {
            $q->whereBetween('payment_date', [$monthStart, $monthEnd])
                ->orWhere(fn ($sq) => $sq->whereNull('payment_date')->whereBetween('created_at', [$monthStart, $monthEnd]));
        })->sum('amount');

        $monthExpenses = (float) Expense::where('approval_status', 'APPROVED')
            ->where(function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('expense_date', [$monthStart, $monthEnd])
                    ->orWhere(fn ($sq) => $sq->whereNull('expense_date')->whereBetween('created_at', [$monthStart, $monthEnd]));
            })->sum('amount');

        $monthNetProfit = $monthCollected - $monthExpenses;

        // Total outstanding debt across all invoices
        $totalOutstandingDebt = (float) Invoice::where('status', '!=', 'CANCELLED')
            ->where('remaining_amount', '>', 0)
            ->sum('remaining_amount');

        $totalDebtorsCount = Invoice::where('status', '!=', 'CANCELLED')
            ->where('remaining_amount', '>', 0)
            ->distinct('patient_id')
            ->count('patient_id');

        // Cash flow by method this month
        $cashTotal = (float) Payment::where(function ($q) use ($monthStart, $monthEnd) {
            $q->whereBetween('payment_date', [$monthStart, $monthEnd])
                ->orWhere(fn ($sq) => $sq->whereNull('payment_date')->whereBetween('created_at', [$monthStart, $monthEnd]));
        })->where('payment_method', 'CASH')->sum('amount');

        $bankTransferTotal = (float) Payment::where(function ($q) use ($monthStart, $monthEnd) {
            $q->whereBetween('payment_date', [$monthStart, $monthEnd])
                ->orWhere(fn ($sq) => $sq->whereNull('payment_date')->whereBetween('created_at', [$monthStart, $monthEnd]));
        })->where('payment_method', 'BANK_TRANSFER')->sum('amount');

        // 2. CLINICAL & PATIENT METRICS
        $totalPatients = Patient::count();
        $newPatientsThisMonth = Patient::whereBetween('created_at', [$monthStart, $monthEnd])->count();

        $todayVisitsTotal = Visit::whereDate('visit_date', $todayStart)->count();
        $todayVisitsWaiting = Visit::whereDate('visit_date', $todayStart)->where('status', 'WAITING')->count();
        $todayVisitsInProgress = Visit::whereDate('visit_date', $todayStart)->where('status', 'IN_PROGRESS')->count();
        $todayVisitsCompleted = Visit::whereDate('visit_date', $todayStart)->where('status', 'COMPLETED')->count();
        $todayVisitsCancelled = Visit::whereDate('visit_date', $todayStart)->where('status', 'CANCELLED')->count();

        $todayAppointmentsTotal = Appointment::whereDate('appointment_date', $todayStart)->count();
        $todayAppointmentsConfirmed = Appointment::whereDate('appointment_date', $todayStart)->where('status', 'CONFIRMED')->count();
        $todayAppointmentsPending = Appointment::whereDate('appointment_date', $todayStart)->where('status', 'PENDING')->count();
        $todayAppointmentsCompleted = Appointment::whereDate('appointment_date', $todayStart)->where('status', 'COMPLETED')->count();

        // 3. INVENTORY & PHARMACY METRICS
        $productsWithStock = Product::withCurrentStock()->get();
        $totalProducts = $productsWithStock->count();
        $lowStockProducts = [];
        $outOfStockCount = 0;
        $lowStockCount = 0;

        foreach ($productsWithStock as $prod) {
            $curStock = (float) ($prod->current_stock ?? 0);
            $minStock = (float) ($prod->minimum_stock ?? 0);

            if ($curStock <= 0) {
                $outOfStockCount++;
                if (count($lowStockProducts) < 15) {
                    $lowStockProducts[] = [
                        'code' => $prod->product_code,
                        'name' => $prod->name,
                        'unit' => $prod->unit,
                        'current_stock' => $curStock,
                        'minimum_stock' => $minStock,
                        'status' => 'HẾT HÀNG (Cần nhập khẩn cấp)',
                    ];
                }
            } elseif ($curStock <= $minStock) {
                $lowStockCount++;
                if (count($lowStockProducts) < 15) {
                    $lowStockProducts[] = [
                        'code' => $prod->product_code,
                        'name' => $prod->name,
                        'unit' => $prod->unit,
                        'current_stock' => $curStock,
                        'minimum_stock' => $minStock,
                        'status' => 'SẮP HẾT (Dưới định mức)',
                    ];
                }
            }
        }

        // 4. STAFF & KPI METRICS
        $totalEmployees = Employee::where('status', 'ACTIVE')->count();
        $employeesByDepartment = Employee::where('status', 'ACTIVE')
            ->selectRaw('department, count(*) as count')
            ->groupBy('department')
            ->pluck('count', 'department')
            ->toArray();

        // Doctors KPI targets in recent period
        $activeKpis = KpiTarget::with('employee')
            ->where('period_end', '>=', $todayStart)
            ->limit(10)
            ->get();

        $kpiSummaries = [];
        foreach ($activeKpis as $kpi) {
            $perf = $kpi->calculatePerformance();
            $kpiSummaries[] = [
                'doctor_name' => $kpi->employee->full_name ?? 'N/A',
                'department' => $kpi->employee->department ?? 'N/A',
                'target_revenue' => (float) $kpi->target_revenue,
                'actual_revenue' => (float) ($perf['actual_revenue'] ?? 0),
                'revenue_rate_pct' => (float) ($perf['revenue_rate'] ?? 0),
                'target_visits' => (int) $kpi->target_visits,
                'actual_visits' => (int) ($perf['actual_visits'] ?? 0),
                'visits_rate_pct' => (float) ($perf['visits_rate'] ?? 0),
                'assessment' => $perf['assessment'] ?? 'N/A',
            ];
        }

        return [
            'report_timestamp' => $now->toDateTimeString(),
            'current_date' => $now->format('d/m/Y'),
            'current_time' => $now->format('H:i'),
            'financial' => [
                'today' => [
                    'collected_revenue' => $todayCollected,
                    'invoices_count' => $todayInvoicesCount,
                    'approved_expenses' => $todayExpenses,
                    'net_today' => $todayCollected - $todayExpenses,
                ],
                'this_month' => [
                    'invoiced_revenue' => $monthInvoicedAmount,
                    'collected_revenue' => $monthCollected,
                    'invoices_count' => $monthInvoicesCount,
                    'unpaid_debt_this_month' => $monthUnpaidDebt,
                    'approved_expenses' => $monthExpenses,
                    'estimated_net_profit' => $monthNetProfit,
                    'payment_methods' => [
                        'cash' => $cashTotal,
                        'bank_transfer' => $bankTransferTotal,
                    ],
                ],
                'outstanding_debt' => [
                    'total_amount' => $totalOutstandingDebt,
                    'debtors_count' => $totalDebtorsCount,
                ],
            ],
            'clinical' => [
                'total_patients' => $totalPatients,
                'new_patients_this_month' => $newPatientsThisMonth,
                'today_visits' => [
                    'total' => $todayVisitsTotal,
                    'waiting' => $todayVisitsWaiting,
                    'in_progress' => $todayVisitsInProgress,
                    'completed' => $todayVisitsCompleted,
                    'cancelled' => $todayVisitsCancelled,
                ],
                'today_appointments' => [
                    'total' => $todayAppointmentsTotal,
                    'confirmed' => $todayAppointmentsConfirmed,
                    'pending' => $todayAppointmentsPending,
                    'completed' => $todayAppointmentsCompleted,
                ],
            ],
            'inventory' => [
                'total_products' => $totalProducts,
                'out_of_stock_count' => $outOfStockCount,
                'low_stock_count' => $lowStockCount,
                'items_needing_restock' => $lowStockProducts,
            ],
            'staff_and_kpi' => [
                'total_active_employees' => $totalEmployees,
                'departments' => $employeesByDepartment,
                'doctor_kpis' => $kpiSummaries,
            ],
        ];
    }

    /**
     * Process chat prompt from user, ground with live database data, and call Gemini API.
     *
     * @param string $userMessage
     * @param array<int, array{role: string, content: string}> $history
     * @return array{success: bool, reply: string, model: string, error?: string}
     */
    public function chat(string $userMessage, array $history = []): array
    {
        $apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');

        // Check if API key is not configured or still placeholder
        if (empty($apiKey) || $apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            return [
                'success' => true,
                'reply' => "### ⚠️ Chưa thiết lập Gemini API Key\n\n"
                    . "Chào Sếp! Tính năng **Trợ lý Điều hành AI** đã được thiết lập hoàn tất và kết nối sẵn sàng với cơ sở dữ liệu phòng khám.\n\n"
                    . "Để kích hoạt trò chuyện trực tiếp với Google Gemini:\n"
                    . "1. Mở tệp `be/.env` trong thư mục backend.\n"
                    . "2. Điền API Key của bạn vào dòng: `GEMINI_API_KEY=AIzaSy...`\n"
                    . "3. Lưu lại và bắt đầu hỏi đáp ngay lập tức!\n\n"
                    . "> [!TIP]\n"
                    . "> Tôi đã chuẩn bị sẵn bộ nạp dữ liệu CSDL thời gian thực (Doanh thu hôm nay, Ca khám, Tồn kho cảnh báo hết thuốc, Công nợ, KPI bác sĩ). Khi có key, tôi sẽ phản hồi chuẩn xác 100% trong vòng chưa đầy 1 giây!",
                'model' => 'system-not-configured',
            ];
        }

        // Get snapshot of database data
        $snapshot = $this->getClinicDataSnapshot();
        $snapshotJson = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        // System prompt instructing the model
        $systemInstruction = "Bạn là Trợ lý Điều hành AI Cấp cao của Phòng khám Chuyên nghiệp (Clinic Management System - QLPK). "
            . "Nhiệm vụ của bạn là phục vụ Giám đốc / Ban Lãnh đạo phòng khám (gọi người dùng là 'Sếp' hoặc 'Ban Lãnh đạo' một cách tôn trọng, lịch sự và chuyên nghiệp).\n\n"
            . "QUY TẮC BẮT BUỘC VỀ DỮ LIỆU (GROUND TRUTH):\n"
            . "1. Dưới đây là BẢN DỮ LIỆU THỰC TẾ ĐƯỢC TRÍCH XUẤT TRỰC TIẾP TỪ CƠ SỞ DỮ LIỆU PHÒNG KHÁM TẠI THỜI ĐIỂM HIỆN TẠI:\n"
            . "```json\n" . $snapshotJson . "\n```\n\n"
            . "2. ĐỘ CHÍNH XÁC TUYỆT ĐỐI: Bạn CHỈ ĐƯỢC báo cáo và trả lời dựa trên các số liệu thực tế trong bản dữ liệu trên. Tuyệt đối KHÔNG tự suy diễn, KHÔNG tự bịa đặt hay làm tròn sai lệch số tiền, số lượng.\n"
            . "3. ĐỊNH DẠNG: \n"
            . "   - Định dạng tiền tệ tiếng Việt: ví dụ 15.000.000 đ, 500.000 đ (ngăn cách hàng nghìn bằng dấu chấm, có chữ đ).\n"
            . "   - Định dạng ngày: dd/mm/yyyy, giờ: HH:mm.\n"
            . "   - Trình bày trực quan, sang trọng, khoa học: Dùng tiêu đề Markdown rõ ràng, bullet points, in đậm các chỉ số trọng yếu, dùng bảng (Markdown table) khi so sánh nhiều nhân sự/thuốc/chỉ số.\n"
            . "   - Khi sếp hỏi về cảnh báo thuốc: Nêu rõ tên thuốc, số lượng tồn thực tế và định mức tối thiểu.\n"
            . "   - Khi sếp hỏi về KPI: Phân tích khách quan tỷ lệ hoàn thành (Doanh thu & Số ca khám), nêu bật bác sĩ xuất sắc.\n"
            . "   - Cuối câu trả lời, hãy đưa ra 1-2 nhận định ngắn gọn hoặc đề xuất quản trị hữu ích nếu phù hợp.";

        // Build contents payload
        $contents = [];

        // Add history (max 6 recent messages to keep context lean and cheap)
        $trimmedHistory = array_slice($history, -6);
        foreach ($trimmedHistory as $item) {
            $role = ($item['role'] === 'user' || $item['role'] === 'human') ? 'user' : 'model';
            $content = (string) ($item['content'] ?? '');
            if (!empty($content)) {
                $contents[] = [
                    'role' => $role,
                    'parts' => [['text' => $content]],
                ];
            }
        }

        // Add the current user prompt
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $userMessage]],
        ];

        // Determine candidate models
        $preferredModel = config('services.gemini.model') ?: env('GEMINI_MODEL', 'gemini-2.5-flash');
        $modelsToTry = array_unique(array_merge([$preferredModel], $this->modelCandidates));

        $lastError = null;
        foreach ($modelsToTry as $model) {
            try {
                $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

                $payload = [
                    'contents' => $contents,
                    'systemInstruction' => [
                        'parts' => [['text' => $systemInstruction]],
                    ],
                    'generationConfig' => [
                        'temperature' => 0.2, // Low temperature for factual precision
                        'topK' => 40,
                        'topP' => 0.95,
                        'maxOutputTokens' => 2048,
                    ],
                ];

                $response = Http::withoutVerifying()
                    ->withHeaders([
                        'Content-Type' => 'application/json',
                    ])
                    ->timeout(25)
                    ->post($endpoint, $payload);

                if ($response->successful()) {
                    $data = $response->json();
                    $reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

                    if (!empty($reply)) {
                        Log::info("Gemini AI answered successfully using model: {$model}");
                        return [
                            'success' => true,
                            'reply' => $reply,
                            'model' => $model,
                        ];
                    }
                }

                // If model not found (404), log and try next model
                $statusCode = $response->status();
                $errBody = $response->body();
                Log::warning("Gemini model {$model} returned status {$statusCode}: {$errBody}");
                $lastError = "HTTP {$statusCode}: {$errBody}";

                if ($statusCode === 400 && str_contains($errBody, 'API_KEY_INVALID')) {
                    return [
                        'success' => false,
                        'reply' => "### ❌ Gemini API Key không hợp lệ\n\nGoogle Gemini báo lỗi: API Key không đúng hoặc chưa được cấp quyền truy cập. Sếp vui lòng kiểm tra lại mã API key trong `be/.env` nhé!",
                        'model' => $model,
                        'error' => 'API_KEY_INVALID',
                    ];
                }

                if ($statusCode === 429) {
                    return [
                        'success' => false,
                        'reply' => "### ⏳ Vượt hạn mức gọi API (Rate Limit / Quota Exceeded)\n\nTài khoản Gemini API tạm thời đạt giới hạn yêu cầu trên phút. Sếp vui lòng đợi khoảng 30 giây rồi thử gửi lại câu hỏi nhé!",
                        'model' => $model,
                        'error' => 'RATE_LIMIT_EXCEEDED',
                    ];
                }
            } catch (\Throwable $e) {
                Log::error("Gemini API connection error with model {$model}: " . $e->getMessage());
                $lastError = $e->getMessage();
            }
        }

        return [
            'success' => false,
            'reply' => "### ⚠️ Không thể kết nối với dịch vụ Gemini AI\n\nHệ thống gặp sự cố kết nối tới máy chủ Google AI: " . ($lastError ?? 'Lỗi không xác định') . ".\n\nSếp vui lòng kiểm tra kết nối mạng Internet hoặc cấu hình API Key trong file `.env`.",
            'model' => $preferredModel,
            'error' => $lastError,
        ];
    }
}
