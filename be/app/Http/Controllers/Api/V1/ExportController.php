<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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
     * Generate UTF-8 BOM CSV response with Vietnamese date & number standards.
     *
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     * @param  array<int, string>  $columnTypes
     */
    protected function toCsvResponse(string $filename, array $headers, iterable $rows, array $columnTypes = []): Response
    {
        $handle = fopen('php://temp', 'r+');

        // Write UTF-8 BOM for Excel Vietnamese font compatibility
        fwrite($handle, "\xEF\xBB\xBF");

        // Write CSV headers
        fputcsv($handle, $headers);

        // Write CSV data rows
        foreach ($rows as $row) {
            $formattedRow = [];
            foreach ($row as $colIdx => $value) {
                $type = $columnTypes[$colIdx] ?? 'string';

                if ($value === null || $value === '') {
                    $formattedRow[] = '';
                    continue;
                }

                if ($type === 'date') {
                    if ($value instanceof \DateTimeInterface) {
                        $formattedRow[] = $value->format('d/m/Y');
                    } else {
                        $d = Carbon::tryParse((string) $value);
                        $formattedRow[] = $d ? $d->format('d/m/Y') : (string) $value;
                    }
                } elseif ($type === 'datetime') {
                    if ($value instanceof \DateTimeInterface) {
                        $formattedRow[] = $value->format('d/m/Y H:i:s');
                    } else {
                        $d = Carbon::tryParse((string) $value);
                        $formattedRow[] = $d ? $d->format('d/m/Y H:i:s') : (string) $value;
                    }
                } elseif ($type === 'phone') {
                    // Force Excel to treat as string to prevent stripping leading 0
                    $phoneStr = trim((string) $value);
                    if ($phoneStr !== '' && str_starts_with($phoneStr, '0')) {
                        $formattedRow[] = '="'.$phoneStr.'"';
                    } else {
                        $formattedRow[] = $phoneStr;
                    }
                } elseif (is_bool($value)) {
                    $formattedRow[] = $value ? 'Có' : 'Không';
                } else {
                    $formattedRow[] = (string) $value;
                }
            }

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
     * Generate native Excel XML (SpreadsheetML) response compatible with all MS Excel versions.
     * Guarantees strict date formatting (dd/mm/yyyy), numeric accounting, and leading-zero preservation.
     *
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     * @param  array<int, string>  $columnTypes
     */
    protected function toExcelResponse(string $filename, array $headers, iterable $rows, array $columnTypes = []): Response
    {
        $handle = fopen('php://temp', 'r+');

        fwrite($handle, '<?xml version="1.0" encoding="UTF-8"?>'."\n");
        fwrite($handle, '<?mso-application progid="Excel.Sheet"?>'."\n");
        fwrite($handle, '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'."\n");
        fwrite($handle, ' xmlns:o="urn:schemas-microsoft-com:office:office"'."\n");
        fwrite($handle, ' xmlns:x="urn:schemas-microsoft-com:office:excel"'."\n");
        fwrite($handle, ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'."\n");
        fwrite($handle, ' xmlns:html="http://www.w3.org/TR/REC-html40">'."\n");

        // Document Properties
        fwrite($handle, ' <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">'."\n");
        fwrite($handle, '  <Author>QLPK System</Author>'."\n");
        fwrite($handle, '  <Created>'.now()->toIso8601String().'</Created>'."\n");
        fwrite($handle, ' </DocumentProperties>'."\n");

        // Styles
        fwrite($handle, ' <Styles>'."\n");
        fwrite($handle, '  <Style ss:ID="Default" ss:Name="Normal">'."\n");
        fwrite($handle, '   <Alignment ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Font ss:FontName="Calibri" x:CharSet="163" ss:Size="11" ss:Color="#1E293B"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // Header style (Navy Blue background, bold white text)
        fwrite($handle, '  <Style ss:ID="Header">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <Font ss:FontName="Calibri" x:CharSet="163" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>'."\n");
        fwrite($handle, '   <Interior ss:Color="#1E40AF" ss:Pattern="Solid"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // Date style (dd/mm/yyyy)
        fwrite($handle, '  <Style ss:ID="Date">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <NumberFormat ss:Format="dd/mm/yyyy"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // DateTime style (dd/mm/yyyy hh:mm:ss)
        fwrite($handle, '  <Style ss:ID="DateTime">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <NumberFormat ss:Format="dd/mm/yyyy hh:mm:ss"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // Currency / Integer Number style
        fwrite($handle, '  <Style ss:ID="Number">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <NumberFormat ss:Format="#,##0"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // Decimal style (e.g. quantities with fractions)
        fwrite($handle, '  <Style ss:ID="DecimalNumber">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <NumberFormat ss:Format="#,##0.00"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // Left-aligned Text style
        fwrite($handle, '  <Style ss:ID="Text">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <NumberFormat ss:Format="@"/>'."\n");
        fwrite($handle, '  </Style>'."\n");

        // Centered Text style (codes, phone numbers, status badges)
        fwrite($handle, '  <Style ss:ID="CenterText">'."\n");
        fwrite($handle, '   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>'."\n");
        fwrite($handle, '   <Borders>'."\n");
        fwrite($handle, '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>'."\n");
        fwrite($handle, '   </Borders>'."\n");
        fwrite($handle, '   <NumberFormat ss:Format="@"/>'."\n");
        fwrite($handle, '  </Style>'."\n");
        fwrite($handle, ' </Styles>'."\n");

        // Worksheet
        fwrite($handle, ' <Worksheet ss:Name="DuLieu">'."\n");
        fwrite($handle, '  <Table>'."\n");

        // Header Row
        fwrite($handle, '   <Row ss:Height="26">'."\n");
        foreach ($headers as $h) {
            $safeH = htmlspecialchars((string) $h, ENT_XML1, 'UTF-8');
            fwrite($handle, '    <Cell ss:StyleID="Header"><Data ss:Type="String">'.$safeH.'</Data></Cell>'."\n");
        }
        fwrite($handle, '   </Row>'."\n");

        // Data Rows
        foreach ($rows as $row) {
            fwrite($handle, '   <Row ss:Height="21">'."\n");
            foreach ($row as $colIdx => $val) {
                $type = $columnTypes[$colIdx] ?? 'string';

                if ($val === null || $val === '') {
                    fwrite($handle, '    <Cell ss:StyleID="Text"><Data ss:Type="String"></Data></Cell>'."\n");
                    continue;
                }

                if ($type === 'date') {
                    if ($val instanceof \DateTimeInterface) {
                        $dtStr = $val->format('Y-m-d\T00:00:00.000');
                    } else {
                        $d = Carbon::tryParse((string) $val);
                        $dtStr = $d ? $d->format('Y-m-d\T00:00:00.000') : (string) $val;
                    }
                    fwrite($handle, '    <Cell ss:StyleID="Date"><Data ss:Type="DateTime">'.$dtStr.'</Data></Cell>'."\n");
                } elseif ($type === 'datetime') {
                    if ($val instanceof \DateTimeInterface) {
                        $dtStr = $val->format('Y-m-d\TH:i:s.000');
                    } else {
                        $d = Carbon::tryParse((string) $val);
                        $dtStr = $d ? $d->format('Y-m-d\TH:i:s.000') : (string) $val;
                    }
                    fwrite($handle, '    <Cell ss:StyleID="DateTime"><Data ss:Type="DateTime">'.$dtStr.'</Data></Cell>'."\n");
                } elseif ($type === 'number') {
                    $numVal = is_numeric($val) ? (float) $val : 0;
                    fwrite($handle, '    <Cell ss:StyleID="Number"><Data ss:Type="Number">'.$numVal.'</Data></Cell>'."\n");
                } elseif ($type === 'decimal') {
                    $numVal = is_numeric($val) ? (float) $val : 0;
                    fwrite($handle, '    <Cell ss:StyleID="DecimalNumber"><Data ss:Type="Number">'.$numVal.'</Data></Cell>'."\n");
                } elseif ($type === 'phone' || $type === 'center') {
                    $safeStr = htmlspecialchars((string) $val, ENT_XML1, 'UTF-8');
                    fwrite($handle, '    <Cell ss:StyleID="CenterText"><Data ss:Type="String">'.$safeStr.'</Data></Cell>'."\n");
                } else {
                    $safeStr = htmlspecialchars((string) $val, ENT_XML1, 'UTF-8');
                    fwrite($handle, '    <Cell ss:StyleID="Text"><Data ss:Type="String">'.$safeStr.'</Data></Cell>'."\n");
                }
            }
            fwrite($handle, '   </Row>'."\n");
        }

        fwrite($handle, '  </Table>'."\n");
        fwrite($handle, ' </Worksheet>'."\n");
        fwrite($handle, '</Workbook>'."\n");

        rewind($handle);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        return response($content, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Dispatch export to either Excel (.xls) or CSV based on request format.
     */
    protected function exportResponse(
        Request $request,
        string $baseFilename,
        array $headers,
        iterable $rows,
        array $columnTypes = []
    ): Response {
        $format = strtolower((string) ($request->input('format') ?? 'excel'));

        if ($format === 'csv') {
            return $this->toCsvResponse($baseFilename.'.csv', $headers, $rows, $columnTypes);
        }

        return $this->toExcelResponse($baseFilename.'.xls', $headers, $rows, $columnTypes);
    }

    /**
     * Export patient directory.
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

        $columnTypes = [
            'center',   // Mã bệnh nhân
            'string',   // Họ và tên
            'date',     // Ngày sinh
            'center',   // Giới tính
            'phone',    // SĐT
            'string',   // Email
            'string',   // Địa chỉ
            'string',   // Người liên hệ khẩn cấp
            'phone',    // SĐT khẩn cấp
            'date',     // Ngày khám đầu
            'date',     // Ngày khám cuối
            'center',   // Trạng thái
            'string',   // Ghi chú
            'datetime', // Ngày tạo
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
                $p->date_of_birth,
                $genderMap[strtoupper((string) $p->gender)] ?? $p->gender,
                $p->phone ?? '',
                $p->email ?? '',
                $p->address ?? '',
                $p->emergency_contact_name ?? '',
                $p->emergency_contact_phone ?? '',
                $p->first_visit_date,
                $p->last_visit_date,
                $statusMap[strtoupper((string) $p->status)] ?? $p->status,
                $p->notes ?? '',
                $p->created_at,
            ];
        }

        $baseFilename = 'danh_sach_benh_nhan_'.now()->format('Ymd_His');
        $format = strtolower((string) ($request->input('format') ?? 'excel'));

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'patients',
            'action' => $format === 'csv' ? 'export_csv' : 'export_excel',
            'table_name' => 'patients',
            'record_id' => null,
            'old_values' => null,
            'new_values' => [
                'type' => 'patients',
                'format' => $format,
                'filename' => $baseFilename.($format === 'csv' ? '.csv' : '.xls'),
                'row_count' => count($rows),
                'filters' => $request->all(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return $this->exportResponse($request, $baseFilename, $headers, $rows, $columnTypes);
    }

    /**
     * Export invoices and receivables.
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

        $columnTypes = [
            'center',   // Mã hóa đơn
            'center',   // Mã bệnh nhân
            'string',   // Tên bệnh nhân
            'phone',    // SĐT
            'datetime', // Ngày phát hành
            'number',   // Tiền dịch vụ
            'number',   // Giảm giá
            'number',   // Tổng cộng
            'number',   // Đã thanh toán
            'number',   // Còn nợ
            'center',   // Trạng thái
            'string',   // Người tạo
            'datetime', // Ngày tạo
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
                $inv->issued_at,
                (float) $inv->subtotal_amount,
                (float) $inv->discount_amount,
                (float) $inv->total_amount,
                (float) $inv->paid_amount,
                (float) $inv->remaining_amount,
                $statusMap[strtoupper((string) $inv->status)] ?? $inv->status,
                $creatorName,
                $inv->created_at,
            ];
        }

        $baseFilename = 'hoa_don_cong_no_'.now()->format('Ymd_His');
        $format = strtolower((string) ($request->input('format') ?? 'excel'));

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'invoices',
            'action' => $format === 'csv' ? 'export_csv' : 'export_excel',
            'table_name' => 'invoices',
            'record_id' => null,
            'old_values' => null,
            'new_values' => [
                'type' => 'invoices',
                'format' => $format,
                'filename' => $baseFilename.($format === 'csv' ? '.csv' : '.xls'),
                'row_count' => count($rows),
                'filters' => $request->all(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return $this->exportResponse($request, $baseFilename, $headers, $rows, $columnTypes);
    }

    /**
     * Export cashbook transactions.
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

        $columnTypes = [
            'center',   // Mã phiếu
            'center',   // Loại giao dịch
            'number',   // Số tiền
            'center',   // Phương thức thanh toán
            'datetime', // Ngày giao dịch
            'center',   // Loại tham chiếu
            'string',   // Mã tham chiếu
            'string',   // Người lập
            'string',   // Nội dung
            'datetime', // Ngày ghi sổ
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
                (float) $t->amount,
                $methodMap[strtoupper((string) $t->payment_method)] ?? $t->payment_method,
                $t->transaction_date,
                $t->reference_type ?? '',
                $t->reference_id ?? '',
                $creatorName,
                $t->description ?? '',
                $t->created_at,
            ];
        }

        $baseFilename = 'so_quy_thu_chi_'.now()->format('Ymd_His');
        $format = strtolower((string) ($request->input('format') ?? 'excel'));

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'cashbook',
            'action' => $format === 'csv' ? 'export_csv' : 'export_excel',
            'table_name' => 'cash_transactions',
            'record_id' => null,
            'old_values' => null,
            'new_values' => [
                'type' => 'cashbook',
                'format' => $format,
                'filename' => $baseFilename.($format === 'csv' ? '.csv' : '.xls'),
                'row_count' => count($rows),
                'filters' => $request->all(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return $this->exportResponse($request, $baseFilename, $headers, $rows, $columnTypes);
    }

    /**
     * Export inventory stock and movements.
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

        $columnTypes = [
            'center',   // Mã sản phẩm
            'string',   // Tên sản phẩm
            'center',   // Đơn vị tính
            'decimal',  // Tồn tối thiểu
            'decimal',  // Tồn đầu kỳ
            'decimal',  // Tổng nhập
            'decimal',  // Tổng xuất
            'decimal',  // Điều chỉnh
            'decimal',  // Tồn cuối kỳ
            'center',   // Trạng thái tồn
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

        $baseFilename = 'bao_cao_ton_kho_'.now()->format('Ymd_His');
        $format = strtolower((string) ($request->input('format') ?? 'excel'));

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'inventory',
            'action' => $format === 'csv' ? 'export_csv' : 'export_excel',
            'table_name' => 'inventory_transactions',
            'record_id' => null,
            'old_values' => null,
            'new_values' => [
                'type' => 'inventory',
                'format' => $format,
                'filename' => $baseFilename.($format === 'csv' ? '.csv' : '.xls'),
                'row_count' => count($rows),
                'filters' => $request->all(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return $this->exportResponse($request, $baseFilename, $headers, $rows, $columnTypes);
    }
}
