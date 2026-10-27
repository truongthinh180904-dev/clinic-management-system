<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CashTransaction;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ExportController extends Controller
{
    /**
     * Parse date range from request.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function parseDateRange(Request $request): array
    {
        $startDateInput = $request->input('start_date') ?? $request->input('from_date');
        $endDateInput = $request->input('end_date') ?? $request->input('to_date');

        $startDate = $startDateInput
            ? Carbon::parse((string) $startDateInput)->startOfDay()
            : now()->startOfMonth()->startOfDay();

        $endDate = $endDateInput
            ? Carbon::parse((string) $endDateInput)->endOfDay()
            : now()->endOfDay();

        if ($startDate > $endDate) {
            [$startDate, $endDate] = [$endDate->copy()->startOfDay(), $startDate->copy()->endOfDay()];
        }

        return [$startDate, $endDate];
    }

    /**
     * Generate UTF-8 BOM CSV response.
     *
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     */
    protected function toCsvResponse(string $filename, array $headers, iterable $rows): Response
    {
        $handle = fopen('php://temp', 'r+');

        // Write UTF-8 BOM for Excel Vietnamese font compatibility
        fwrite($handle, "\xEF\xBB\xBF");

        // Write CSV headers
        fputcsv($handle, $headers);

        // Write CSV data rows
        foreach ($rows as $row) {
            $formattedRow = array_map(function ($value) {
                if ($value === null) {
                    return '';
                }
                if ($value instanceof \DateTimeInterface) {
                    return $value->format('Y-m-d H:i:s');
                }
                if (is_bool($value)) {
                    return $value ? 'Có' : 'Không';
                }

                return (string) $value;
            }, $row);

            fputcsv($handle, $formattedRow);
        }

        rewind($handle);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Export patient directory to UTF-8 BOM CSV.
     * GET /api/v1/exports/patients
     */
    public function patients(Request $request): Response
    {
        $query = Patient::query();

        // Search by keyword across code, name, phone, email, emergency phone
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('patient_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('full_name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('email', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('emergency_contact_phone', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        // Filter by gender
        if ($request->filled('gender')) {
            $query->where('gender', (string) $request->input('gender'));
        }

        // Filter by date range (created_at or first_visit_date)
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('created_at', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('created_at', '<=', (string) $endDate);
        }

        $patients = $query->orderBy('patient_code')->get();

        $headers = [
            'Mã bệnh nhân',
            'Họ và tên',
            'Ngày sinh',
            'Giới tính',
            'Số điện thoại',
            'Email',
            'Địa chỉ',
            'Người liên hệ khẩn cấp',
            'SĐT khẩn cấp',
            'Ngày khám đầu',
            'Ngày khám cuối',
            'Trạng thái',
            'Ghi chú',
            'Ngày tạo',
        ];

        $genderMap = [
            'MALE' => 'Nam',
            'FEMALE' => 'Nữ',
            'OTHER' => 'Khác',
        ];

        $statusMap = [
            'ACTIVE' => 'Hoạt động',
            'INACTIVE' => 'Tạm ngưng',
        ];

        $rows = [];
        foreach ($patients as $p) {
            $rows[] = [
                $p->patient_code,
                $p->full_name,
                $p->date_of_birth?->format('Y-m-d') ?? '',
                $genderMap[strtoupper((string) $p->gender)] ?? $p->gender,
                $p->phone ?? '',
                $p->email ?? '',
                $p->address ?? '',
                $p->emergency_contact_name ?? '',
                $p->emergency_contact_phone ?? '',
                $p->first_visit_date?->format('Y-m-d') ?? '',
                $p->last_visit_date?->format('Y-m-d') ?? '',
                $statusMap[strtoupper((string) $p->status)] ?? $p->status,
                $p->notes ?? '',
                $p->created_at?->format('Y-m-d H:i:s') ?? '',
            ];
        }

        $filename = 'danh_sach_benh_nhan_'.now()->format('Ymd_His').'.csv';

        return $this->toCsvResponse($filename, $headers, $rows);
    }

    /**
     * Export invoices and receivables to UTF-8 BOM CSV.
     * GET /api/v1/exports/invoices
     */
    public function invoices(Request $request): Response
    {
        $query = Invoice::query()->with(['patient', 'creator.employee']);

        // Search by invoice code, patient name, phone, patient code
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('invoice_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhereHas('patient', function ($pq) use ($searchTerm) {
                        $pq->where('full_name', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('phone', 'LIKE', "%{$searchTerm}%")
                            ->orWhere('patient_code', 'LIKE', "%{$searchTerm}%");
                    });
            });
        }

        // Filter by status (UNPAID, PARTIAL, PAID, CANCELLED)
        if ($request->filled('status')) {
            $status = $request->input('status');
            if (is_array($status)) {
                $query->whereIn('status', $status);
            } else {
                $query->where('status', (string) $status);
            }
        }

        // Filter by patient_id
        if ($request->filled('patient_id')) {
            $query->where('patient_id', (int) $request->input('patient_id'));
        }

        // Filter debt only
        if ($request->boolean('debt_only') || $request->input('debt_only') === '1') {
            $query->where('remaining_amount', '>', 0)
                ->where('status', '!=', 'CANCELLED');
        }

        // Filter by date range (issued_at)
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('issued_at', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('issued_at', '<=', (string) $endDate);
        }

        $invoices = $query->orderByDesc('issued_at')->orderByDesc('id')->get();

        $headers = [
            'Mã hóa đơn',
            'Mã bệnh nhân',
            'Tên bệnh nhân',
            'Số điện thoại',
            'Ngày phát hành',
            'Tiền dịch vụ',
            'Giảm giá',
            'Tổng cộng',
            'Đã thanh toán',
            'Còn nợ',
            'Trạng thái',
            'Người tạo',
            'Ngày tạo',
        ];

        $statusMap = [
            'UNPAID' => 'Chưa thanh toán',
            'PARTIAL' => 'Thanh toán 1 phần',
            'PAID' => 'Đã thanh toán đủ',
            'CANCELLED' => 'Đã hủy',
        ];

        $rows = [];
        foreach ($invoices as $inv) {
            $creatorName = $inv->creator?->employee?->full_name ?? $inv->creator?->username ?? '';

            $rows[] = [
                $inv->invoice_code,
                $inv->patient?->patient_code ?? '',
                $inv->patient?->full_name ?? '',
                $inv->patient?->phone ?? '',
                $inv->issued_at?->format('Y-m-d H:i:s') ?? '',
                number_format((float) $inv->subtotal_amount, 2, '.', ''),
                number_format((float) $inv->discount_amount, 2, '.', ''),
                number_format((float) $inv->total_amount, 2, '.', ''),
                number_format((float) $inv->paid_amount, 2, '.', ''),
                number_format((float) $inv->remaining_amount, 2, '.', ''),
                $statusMap[strtoupper((string) $inv->status)] ?? $inv->status,
                $creatorName,
                $inv->created_at?->format('Y-m-d H:i:s') ?? '',
            ];
        }

        $filename = 'hoa_don_cong_no_'.now()->format('Ymd_His').'.csv';

        return $this->toCsvResponse($filename, $headers, $rows);
    }

    /**
     * Export cashbook transactions to UTF-8 BOM CSV.
     * GET /api/v1/exports/cashbook
     */
    public function cashbook(Request $request): Response
    {
        $query = CashTransaction::query()->with(['creator.employee']);

        // Filter by transaction_type (IN, OUT)
        if ($request->filled('transaction_type')) {
            $type = strtoupper(trim((string) $request->input('transaction_type')));
            $query->where('transaction_type', $type);
        }

        // Filter by payment_method (CASH, BANK_TRANSFER, CARD)
        if ($request->filled('payment_method')) {
            $method = strtoupper(trim((string) $request->input('payment_method')));
            $query->where('payment_method', $method);
        }

        // Filter by reference_type
        if ($request->filled('reference_type')) {
            $query->where('reference_type', (string) $request->input('reference_type'));
        }

        // Filter by date range (transaction_date)
        $startDate = $request->input('start_date') ?? $request->input('from_date');
        if ($startDate) {
            $query->whereDate('transaction_date', '>=', (string) $startDate);
        }

        $endDate = $request->input('end_date') ?? $request->input('to_date');
        if ($endDate) {
            $query->whereDate('transaction_date', '<=', (string) $endDate);
        }

        // Search by transaction_code or description
        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        if ($searchTerm !== '') {
            $query->where(function ($q) use ($searchTerm) {
                $q->where('transaction_code', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%");
            });
        }

        $transactions = $query->orderByDesc('transaction_date')->orderByDesc('id')->get();

        $headers = [
            'Mã phiếu',
            'Loại giao dịch',
            'Số tiền',
            'Phương thức thanh toán',
            'Ngày giao dịch',
            'Loại tham chiếu',
            'Mã tham chiếu',
            'Người lập',
            'Nội dung',
            'Ngày ghi sổ',
        ];

        $typeMap = [
            'IN' => 'Phiếu thu',
            'OUT' => 'Phiếu chi',
        ];

        $methodMap = [
            'CASH' => 'Tiền mặt',
            'BANK_TRANSFER' => 'Chuyển khoản',
            'CARD' => 'Thẻ POS',
        ];

        $rows = [];
        foreach ($transactions as $t) {
            $creatorName = $t->creator?->employee?->full_name ?? $t->creator?->username ?? '';

            $rows[] = [
                $t->transaction_code,
                $typeMap[strtoupper((string) $t->transaction_type)] ?? $t->transaction_type,
                number_format((float) $t->amount, 2, '.', ''),
                $methodMap[strtoupper((string) $t->payment_method)] ?? $t->payment_method,
                $t->transaction_date?->format('Y-m-d H:i:s') ?? '',
                $t->reference_type ?? '',
                $t->reference_id ?? '',
                $creatorName,
                $t->description ?? '',
                $t->created_at?->format('Y-m-d H:i:s') ?? '',
            ];
        }

        $filename = 'so_quy_thu_chi_'.now()->format('Ymd_His').'.csv';

        return $this->toCsvResponse($filename, $headers, $rows);
    }

    /**
     * Export inventory stock and movements to UTF-8 BOM CSV.
     * GET /api/v1/exports/inventory
     */
    public function inventory(Request $request): Response
    {
        [$startDate, $endDate] = $this->parseDateRange($request);

        $searchTerm = trim((string) ($request->input('search') ?? $request->input('q', '')));
        $lowStockOnly = filter_var($request->input('low_stock_only', false), FILTER_VALIDATE_BOOLEAN);

        // 1. Fetch products
        $productsQuery = Product::query()
            ->when($searchTerm !== '', function ($q) use ($searchTerm) {
                $q->where(function ($sub) use ($searchTerm) {
                    $sub->where('name', 'LIKE', "%{$searchTerm}%")
                        ->orWhere('product_code', 'LIKE', "%{$searchTerm}%");
                });
            })
            ->orderBy('product_code');

        $products = $productsQuery->get();

        // 2. Opening stock balance prior to startDate
        $openingBalances = InventoryTransaction::where(function ($q) use ($startDate) {
            $q->where('transaction_date', '<', $startDate)
                ->orWhere(fn ($sq) => $sq->whereNull('transaction_date')->where('created_at', '<', $startDate));
        })
            ->selectRaw("product_id, COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity WHEN transaction_type = 'OUT' THEN -quantity WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as balance")
            ->groupBy('product_id')
            ->pluck('balance', 'product_id');

        // 3. In-period inventory movements
        $periodMovements = InventoryTransaction::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('transaction_date', [$startDate, $endDate])
                ->orWhere(fn ($sq) => $sq->whereNull('transaction_date')->whereBetween('created_at', [$startDate, $endDate]));
        })
            ->selectRaw("product_id,
                COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END), 0) as in_qty,
                COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END), 0) as out_qty,
                COALESCE(SUM(CASE WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END), 0) as adjust_qty")
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        $headers = [
            'Mã sản phẩm',
            'Tên sản phẩm',
            'Đơn vị tính',
            'Tồn tối thiểu',
            'Tồn đầu kỳ',
            'Tổng nhập',
            'Tổng xuất',
            'Điều chỉnh',
            'Tồn cuối kỳ',
            'Trạng thái tồn',
        ];

        $rows = [];
        foreach ($products as $product) {
            $openingStock = round((float) ($openingBalances[$product->id] ?? 0), 3);
            $mov = $periodMovements->get($product->id);

            $inQty = round((float) ($mov?->in_qty ?? 0), 3);
            $outQty = round((float) ($mov?->out_qty ?? 0), 3);
            $adjustQty = round((float) ($mov?->adjust_qty ?? 0), 3);
            $closingStock = round($openingStock + $inQty - $outQty + $adjustQty, 3);
            $minStock = (float) ($product->minimum_stock ?? 0);

            $status = 'Còn hàng';
            if ($closingStock <= 0) {
                $status = 'Hết hàng';
            } elseif ($minStock > 0 && $closingStock <= $minStock) {
                $status = 'Sắp hết';
            }

            if ($lowStockOnly && $closingStock > $minStock && $closingStock > 0) {
                continue;
            }

            $rows[] = [
                $product->product_code,
                $product->name,
                $product->unit,
                $minStock,
                $openingStock,
                $inQty,
                $outQty,
                $adjustQty,
                $closingStock,
                $status,
            ];
        }

        $filename = 'bao_cao_ton_kho_'.now()->format('Ymd_His').'.csv';

        return $this->toCsvResponse($filename, $headers, $rows);
    }
}
