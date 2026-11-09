<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GeminiReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiAssistantController extends Controller
{
    public function __construct(
        protected GeminiReportService $geminiService
    ) {}

    /**
     * Check AI Assistant status and configuration.
     * GET /api/v1/ai/reports/status
     */
    public function status(): JsonResponse
    {
        $apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
        $isConfigured = !empty($apiKey) && $apiKey !== 'YOUR_GEMINI_API_KEY_HERE';
        $model = config('services.gemini.model') ?: env('GEMINI_MODEL', 'gemini-2.5-flash');

        $payload = [
            'configured' => $isConfigured,
            'model' => $model,
            'provider' => 'Google Gemini AI',
            'version' => '2.5 Flash Optimized',
        ];

        return response()->json([
            'success' => true,
            'message' => 'Lấy trạng thái AI thành công.',
            'data' => $payload,
            'configured' => $isConfigured,
            'model' => $model,
            'provider' => 'Google Gemini AI',
            'version' => '2.5 Flash Optimized',
        ]);
    }

    /**
     * Get real-time quick insights snapshot for dashboard display.
     * GET /api/v1/ai/reports/quick-insights
     */
    public function quickInsights(): JsonResponse
    {
        $snapshot = $this->geminiService->getClinicDataSnapshot();

        return response()->json([
            'success' => true,
            'message' => 'Lấy dữ liệu chỉ số nhanh thành công.',
            'data' => $snapshot,
        ]);
    }

    /**
     * Chat with the Gemini Executive Assistant grounded with live clinic data.
     * POST /api/v1/ai/reports/chat
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:3000',
            'history' => 'nullable|array',
            'history.*.role' => 'nullable|string|in:user,model,human,assistant',
            'history.*.content' => 'nullable|string',
        ]);

        $message = (string) $request->input('message');
        $history = (array) $request->input('history', []);

        $result = $this->geminiService->chat($message, $history);

        return response()->json([
            'success' => $result['success'] ?? true,
            'message' => ($result['success'] ?? true) ? 'Phản hồi từ AI thành công.' : 'Xử lý yêu cầu AI thất bại.',
            'data' => $result,
            'reply' => $result['reply'] ?? '',
            'model' => $result['model'] ?? 'gemini-2.5-flash',
            'error' => $result['error'] ?? null,
        ]);
    }
}
