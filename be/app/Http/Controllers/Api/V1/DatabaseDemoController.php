<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DatabaseDemoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DatabaseDemoController extends Controller
{
    public function __construct(
        protected DatabaseDemoService $demoService
    ) {}

    /**
     * Lấy danh sách toàn bộ các đối tượng Quản lý thông tin SQL (có thể lọc theo module).
     * GET /api/v1/database-demo/objects
     */
    public function index(Request $request): JsonResponse
    {
        $module = $request->query('module');
        if ($module) {
            $objects = $this->demoService->getObjectsByModule($module);
        } else {
            $objects = $this->demoService->getAllObjects();
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy danh mục đối tượng SQL thành công.',
            'data' => $objects,
            'meta' => [
                'total' => count($objects),
                'procedures_count' => count(array_filter($objects, fn ($o) => $o['type'] === 'PROCEDURE')),
                'triggers_count' => count(array_filter($objects, fn ($o) => $o['type'] === 'TRIGGER')),
                'functions_count' => count(array_filter($objects, fn ($o) => $o['type'] === 'FUNCTION')),
                'cursors_count' => count(array_filter($objects, fn ($o) => $o['type'] === 'CURSOR')),
            ],
        ]);
    }

    /**
     * Lấy chi tiết một đối tượng SQL theo tên hoặc ID.
     * GET /api/v1/database-demo/objects/{name}
     */
    public function show(string $name): JsonResponse
    {
        $object = $this->demoService->getObjectByName($name);

        if (!$object) {
            return response()->json([
                'success' => false,
                'message' => "Không tìm thấy đối tượng SQL '{$name}'.",
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Lấy chi tiết đối tượng SQL thành công.',
            'data' => $object,
        ]);
    }

    /**
     * Thực thi thử nghiệm DEMO cho một đối tượng SQL (chế độ kiểm thử an toàn).
     * POST /api/v1/database-demo/execute
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate([
            'object_name' => 'required|string',
            'params' => 'nullable|array',
        ]);

        $objectName = (string) $request->input('object_name');
        $params = (array) $request->input('params', []);
        $userId = $request->user()?->id ?: 1;

        $result = $this->demoService->executeDemo($objectName, $params, $userId);

        return response()->json([
            'success' => $result['success'] ?? true,
            'message' => $result['message'] ?? 'Thực thi câu lệnh SQL hoàn tất.',
            'data' => $result,
        ]);
    }

    /**
     * Lấy lịch sử theo dõi thay đổi dữ liệu (Audit Logs).
     * GET /api/v1/database-demo/history
     */
    public function history(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 50);
        $logs = $this->demoService->getAuditHistory($limit);

        return response()->json([
            'success' => true,
            'message' => 'Lấy lịch sử thay đổi dữ liệu thành công.',
            'data' => $logs,
            'meta' => [
                'total' => count($logs),
            ],
        ]);
    }

    /**
     * Lấy thống kê tổng quan các đối tượng SQL và tình hình kiểm thử.
     * GET /api/v1/database-demo/stats
     */
    public function stats(): JsonResponse
    {
        $all = $this->demoService->getAllObjects();
        $history = $this->demoService->getAuditHistory(10);

        return response()->json([
            'success' => true,
            'data' => [
                'total_objects' => count($all),
                'procedures' => 5,
                'triggers' => 5,
                'functions' => 3,
                'cursors' => 2,
                'total_executions' => count($history),
                'last_execution' => $history[0] ?? null,
                'modules_distribution' => [
                    'appointments' => count($this->demoService->getObjectsByModule('appointments')),
                    'patients' => count($this->demoService->getObjectsByModule('patients')),
                    'invoices' => count($this->demoService->getObjectsByModule('invoices')),
                    'inventory' => count($this->demoService->getObjectsByModule('inventory')),
                    'reports' => count($this->demoService->getObjectsByModule('reports')),
                ],
            ],
        ]);
    }
}
