<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ImportBatchResource;
use App\Models\AuditLog;
use App\Models\ImportBatch;
use App\Models\ImportError;
use App\Models\InventoryTransaction;
use App\Models\Patient;
use App\Models\Product;
use App\Models\Service;
use App\Services\PatientCodeGenerator;
use App\Services\ProductCodeGenerator;
use App\Services\ServiceCodeGenerator;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    /**
     * Supported modules for data import.
     */
    protected const SUPPORTED_MODULES = ['patients', 'services', 'products'];

    public function __construct(
        protected PatientCodeGenerator $patientCodeGenerator,
        protected ServiceCodeGenerator $serviceCodeGenerator,
        protected ProductCodeGenerator $productCodeGenerator
    ) {}

    /**
     * Display a paginated listing of import batches.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ImportBatch::query()->with(['importer']);

        if ($request->filled('module')) {
            $query->where('module', (string) $request->input('module'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $batches = $query->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => ImportBatchResource::collection($batches),
            'meta' => [
                'current_page' => $batches->currentPage(),
                'from' => $batches->firstItem(),
                'last_page' => $batches->lastPage(),
                'per_page' => $batches->perPage(),
                'to' => $batches->lastItem(),
                'total' => $batches->total(),
            ],
        ], 200);
    }

    /**
     * Display detailed information of an import batch with its errors.
     */
    public function show(int|string $id): JsonResponse
    {
        $batch = ImportBatch::with([
            'errors' => fn ($q) => $q->orderBy('row_number')->orderBy('id'),
            'importer',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => new ImportBatchResource($batch),
        ], 200);
    }

    /**
     * Download CSV template for a specific module.
     */
    public function template(string $module): Response|StreamedResponse|JsonResponse
    {
        $normalizedModule = strtolower(trim($module));

        if (! in_array($normalizedModule, self::SUPPORTED_MODULES, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Module không hợp lệ. Các module được hỗ trợ: '.implode(', ', self::SUPPORTED_MODULES),
            ], 422);
        }

        $bom = "\xEF\xBB\xBF";
        $csvContent = '';

        switch ($normalizedModule) {
            case 'patients':
                $csvContent = $bom."patient_code,full_name,date_of_birth,gender,phone,email,address,emergency_contact_name,emergency_contact_phone,notes\n"
                    ."BN000001,Nguyễn Văn An,1990-05-15,MALE,0901234567,an.nguyen@example.com,123 Lê Lợi TP.HCM,Trần Thị Mai,0909999888,Tiền sử dị ứng penicillin\n"
                    ."BN000002,Trần Thị Bình,1985-11-20,FEMALE,0912345678,binh.tran@example.com,456 Nguyễn Huệ TP.HCM,Trần Văn Cường,0919888777,Khám sức khỏe tổng quát\n";
                break;

            case 'services':
                $csvContent = $bom."service_code,name,price,duration_minutes,description,status\n"
                    ."DV000001,Khám nội tổng quát,150000,30,Khám lâm sàng và tư vấn ban đầu,ACTIVE\n"
                    ."DV000002,Siêu âm tổng quát 4D,250000,20,Khảo sát hình ảnh các cơ quan ổ bụng,ACTIVE\n";
                break;

            case 'products':
                $csvContent = $bom."product_code,name,unit,minimum_stock,initial_stock,status\n"
                    ."PRD-001,Paracetamol 500mg,Hộp,20,100,ACTIVE\n"
                    ."PRD-002,Bơm tiêm 5ml dùng 1 lần,Cái,50,500,ACTIVE\n";
                break;
        }

        return response($csvContent, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"template_{$normalizedModule}.csv\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    /**
     * Upload and import CSV data for a specific module.
     */
    public function import(Request $request, string $module): JsonResponse
    {
        $normalizedModule = strtolower(trim($module));

        if (! in_array($normalizedModule, self::SUPPORTED_MODULES, true)) {
            return response()->json([
                'success' => false,
                'message' => "Module '{$module}' không được hỗ trợ. Các module hợp lệ: ".implode(', ', self::SUPPORTED_MODULES),
            ], 422);
        }

        // Check for file or direct rows input
        $hasFile = $request->hasFile('file');
        $hasRows = $request->has('rows') && is_array($request->input('rows'));

        if (! $hasFile && ! $hasRows) {
            return response()->json([
                'success' => false,
                'message' => 'Vui lòng cung cấp tệp CSV hoặc mảng dữ liệu để import.',
            ], 422);
        }

        $fileName = 'direct_import.csv';
        $rows = [];

        if ($hasFile) {
            /** @var UploadedFile $file */
            $file = $request->file('file');
            if (! $file->isValid()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tệp tải lên không hợp lệ.',
                ], 422);
            }

            $fileName = $file->getClientOriginalName();
            try {
                $rows = $this->parseCsvFile($file);
            } catch (\Throwable $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Lỗi khi đọc file CSV: '.$e->getMessage(),
                ], 422);
            }
        } elseif ($hasRows) {
            $inputRows = (array) $request->input('rows');
            $lineIndex = 2;
            foreach ($inputRows as $item) {
                $rows[] = [
                    'row_number' => $lineIndex,
                    'raw_data' => (array) $item,
                ];
                $lineIndex++;
            }
        }

        $updateExisting = $request->boolean('update_existing', false)
            || $request->input('mode') === 'update';

        // Create initial batch record
        $batch = ImportBatch::create([
            'module' => $normalizedModule,
            'file_name' => $fileName,
            'total_rows' => count($rows),
            'success_rows' => 0,
            'error_rows' => 0,
            'status' => 'PROCESSING',
            'imported_by' => $request->user()?->id,
            'created_at' => now(),
        ]);

        $successRows = 0;
        $errorRows = 0;
        $seenCodes = [];

        foreach ($rows as $rowItem) {
            $rowNumber = (int) $rowItem['row_number'];
            $rawData = (array) $rowItem['raw_data'];

            $normalizedData = $this->normalizeRowData($rawData, $normalizedModule);
            $errors = $this->validateAndProcessRow(
                $normalizedModule,
                $normalizedData,
                $rowNumber,
                $updateExisting,
                $seenCodes,
                $request->user()
            );

            if (! empty($errors)) {
                $errorRows++;
                foreach ($errors as $error) {
                    ImportError::create([
                        'batch_id' => $batch->id,
                        'row_number' => $rowNumber,
                        'column_name' => $error['column_name'],
                        'error_message' => $error['error_message'],
                        'raw_data' => $rawData,
                        'created_at' => now(),
                    ]);
                }
            } else {
                $successRows++;
            }
        }

        $totalProcessed = $successRows + $errorRows;
        $finalStatus = ($errorRows > 0) ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

        $batch->update([
            'total_rows' => $totalProcessed,
            'success_rows' => $successRows,
            'error_rows' => $errorRows,
            'status' => $finalStatus,
            'completed_at' => now(),
        ]);

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'module' => 'data_transfer',
            'action' => 'import',
            'table_name' => 'import_batches',
            'record_id' => (string) $batch->id,
            'new_values' => [
                'module' => $normalizedModule,
                'file_name' => $fileName,
                'total_rows' => $totalProcessed,
                'success_rows' => $successRows,
                'error_rows' => $errorRows,
                'status' => $finalStatus,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        $freshBatch = $batch->fresh(['errors' => fn ($q) => $q->orderBy('row_number'), 'importer']);

        return response()->json([
            'success' => true,
            'message' => "Import {$normalizedModule} hoàn tất: {$successRows} dòng thành công, {$errorRows} dòng lỗi.",
            'data' => new ImportBatchResource($freshBatch),
        ], 200);
    }

    /**
     * Parse uploaded CSV file into rows.
     *
     * @return array<int, array{row_number: int, raw_data: array<string, string>}>
     */
    protected function parseCsvFile(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \RuntimeException('Không thể mở tệp CSV để đọc.');
        }

        // Detect and handle UTF-8 BOM
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }

        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);

            return [];
        }

        $delimiter = ',';
        if (substr_count($firstLine, ';') > substr_count($firstLine, ',')) {
            $delimiter = ';';
        } elseif (substr_count($firstLine, "\t") > substr_count($firstLine, ',')) {
            $delimiter = "\t";
        }

        $headers = str_getcsv(rtrim($firstLine, "\r\n"), $delimiter);
        if (! empty($headers)) {
            $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $headers[0]);
            $headers = array_map(fn ($h) => trim((string) $h), $headers);
        }

        $rows = [];
        $lineIndex = 2;

        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            $allEmpty = true;
            foreach ($data as $val) {
                if (trim((string) $val) !== '') {
                    $allEmpty = false;
                    break;
                }
            }

            if ($allEmpty) {
                $lineIndex++;

                continue;
            }

            $rowAssoc = [];
            foreach ($headers as $colIdx => $colName) {
                $rowAssoc[$colName] = isset($data[$colIdx]) ? trim((string) $data[$colIdx]) : '';
            }

            $rows[] = [
                'row_number' => $lineIndex,
                'raw_data' => $rowAssoc,
            ];
            $lineIndex++;
        }

        fclose($handle);

        return $rows;
    }

    /**
     * Normalize key names from CSV header to database field names.
     *
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    protected function normalizeRowData(array $raw, string $module): array
    {
        $normalized = [];

        foreach ($raw as $key => $value) {
            $cleanKey = mb_strtolower(trim(str_replace(['_', ' ', '-'], '', (string) $key)));
            $cleanVal = is_string($value) ? trim($value) : $value;

            if ($module === 'patients') {
                if (in_array($cleanKey, ['patientcode', 'code', 'mabn', 'mabenhnhan'])) {
                    $normalized['patient_code'] = $cleanVal;
                } elseif (in_array($cleanKey, ['fullname', 'name', 'hoten', 'hovaten', 'tenbenhnhan'])) {
                    $normalized['full_name'] = $cleanVal;
                } elseif (in_array($cleanKey, ['dateofbirth', 'dob', 'ngaysinh'])) {
                    $normalized['date_of_birth'] = $cleanVal;
                } elseif (in_array($cleanKey, ['gender', 'gioitinh'])) {
                    $normalized['gender'] = $cleanVal;
                } elseif (in_array($cleanKey, ['phone', 'sodienthoai', 'sdt'])) {
                    $normalized['phone'] = $cleanVal;
                } elseif (in_array($cleanKey, ['email'])) {
                    $normalized['email'] = $cleanVal;
                } elseif (in_array($cleanKey, ['address', 'diachi'])) {
                    $normalized['address'] = $cleanVal;
                } elseif (in_array($cleanKey, ['emergencycontactname', 'emergencyname', 'nguoithan', 'nguoilienhe'])) {
                    $normalized['emergency_contact_name'] = $cleanVal;
                } elseif (in_array($cleanKey, ['emergencycontactphone', 'emergencyphone', 'sdtnguoithan', 'sdtnguoilienhe'])) {
                    $normalized['emergency_contact_phone'] = $cleanVal;
                } elseif (in_array($cleanKey, ['notes', 'note', 'ghichu'])) {
                    $normalized['notes'] = $cleanVal;
                } elseif (in_array($cleanKey, ['status', 'trangthai'])) {
                    $normalized['status'] = $cleanVal;
                }
            } elseif ($module === 'services') {
                if (in_array($cleanKey, ['servicecode', 'code', 'madv', 'madichvu'])) {
                    $normalized['service_code'] = $cleanVal;
                } elseif (in_array($cleanKey, ['name', 'servicename', 'tendv', 'tendichvu'])) {
                    $normalized['name'] = $cleanVal;
                } elseif (in_array($cleanKey, ['price', 'dongia', 'gia'])) {
                    $normalized['price'] = $cleanVal;
                } elseif (in_array($cleanKey, ['durationminutes', 'duration', 'thoiluong', 'phut'])) {
                    $normalized['duration_minutes'] = $cleanVal;
                } elseif (in_array($cleanKey, ['description', 'mota'])) {
                    $normalized['description'] = $cleanVal;
                } elseif (in_array($cleanKey, ['status', 'trangthai'])) {
                    $normalized['status'] = $cleanVal;
                }
            } elseif ($module === 'products') {
                if (in_array($cleanKey, ['productcode', 'code', 'masp', 'masanpham', 'mathuoc'])) {
                    $normalized['product_code'] = $cleanVal;
                } elseif (in_array($cleanKey, ['name', 'productname', 'tensp', 'tensanpham', 'tenthuoc'])) {
                    $normalized['name'] = $cleanVal;
                } elseif (in_array($cleanKey, ['unit', 'donvitinh', 'dvt', 'donvi'])) {
                    $normalized['unit'] = $cleanVal;
                } elseif (in_array($cleanKey, ['minimumstock', 'tontoithieu', 'dinhmuncton'])) {
                    $normalized['minimum_stock'] = $cleanVal;
                } elseif (in_array($cleanKey, ['initialstock', 'tondauky', 'soluongbandau'])) {
                    $normalized['initial_stock'] = $cleanVal;
                } elseif (in_array($cleanKey, ['status', 'trangthai'])) {
                    $normalized['status'] = $cleanVal;
                }
            }
        }

        return $normalized;
    }

    /**
     * Validate and process a single row.
     * Returns an array of errors if any. If empty, the row was successfully saved.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $seenCodes
     * @return array<int, array{column_name: string, error_message: string}>
     */
    protected function validateAndProcessRow(
        string $module,
        array $data,
        int $rowNumber,
        bool $updateExisting,
        array &$seenCodes,
        mixed $user
    ): array {
        switch ($module) {
            case 'patients':
                return $this->processPatientRow($data, $updateExisting, $seenCodes);
            case 'services':
                return $this->processServiceRow($data, $updateExisting, $seenCodes);
            case 'products':
                return $this->processProductRow($data, $updateExisting, $seenCodes, $user);
            default:
                return [
                    ['column_name' => 'module', 'error_message' => "Module {$module} không được hỗ trợ."],
                ];
        }
    }

    /**
     * Process a patient row.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $seenCodes
     * @return array<int, array{column_name: string, error_message: string}>
     */
    protected function processPatientRow(array $data, bool $updateExisting, array &$seenCodes): array
    {
        $errors = [];

        // Validate full_name
        $fullName = trim((string) ($data['full_name'] ?? ''));
        if ($fullName === '') {
            $errors[] = ['column_name' => 'full_name', 'error_message' => 'Họ và tên không được để trống.'];
        }

        // Validate phone
        $phone = trim((string) ($data['phone'] ?? ''));
        if ($phone === '') {
            $errors[] = ['column_name' => 'phone', 'error_message' => 'Số điện thoại không được để trống.'];
        } elseif (! preg_match('/^[0-9+\s().-]{7,25}$/', $phone)) {
            $errors[] = ['column_name' => 'phone', 'error_message' => 'Số điện thoại không hợp lệ.'];
        }

        // Validate gender
        $rawGender = strtoupper(trim((string) ($data['gender'] ?? '')));
        $gender = 'OTHER';
        if ($rawGender !== '') {
            if (in_array($rawGender, ['MALE', 'M', 'NAM'])) {
                $gender = 'MALE';
            } elseif (in_array($rawGender, ['FEMALE', 'F', 'NỮ', 'NU'])) {
                $gender = 'FEMALE';
            } elseif (in_array($rawGender, ['OTHER', 'O', 'KHÁC', 'KHAC'])) {
                $gender = 'OTHER';
            } else {
                $errors[] = ['column_name' => 'gender', 'error_message' => 'Giới tính không hợp lệ (MALE, FEMALE, OTHER).'];
            }
        }

        // Validate date_of_birth
        $dob = trim((string) ($data['date_of_birth'] ?? ''));
        $parsedDob = null;
        if ($dob !== '') {
            try {
                $dateObj = Carbon::parse($dob);
                if ($dateObj->isFuture()) {
                    $errors[] = ['column_name' => 'date_of_birth', 'error_message' => 'Ngày sinh không thể lớn hơn ngày hiện tại.'];
                } else {
                    $parsedDob = $dateObj->toDateString();
                }
            } catch (\Throwable $e) {
                $errors[] = ['column_name' => 'date_of_birth', 'error_message' => 'Ngày sinh không đúng định dạng.'];
            }
        }

        // Validate email
        $email = trim((string) ($data['email'] ?? ''));
        if ($email !== '' && ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = ['column_name' => 'email', 'error_message' => 'Địa chỉ email không đúng định dạng.'];
        }

        // Validate patient_code
        $patientCode = trim((string) ($data['patient_code'] ?? ''));
        if ($patientCode !== '') {
            if (in_array($patientCode, $seenCodes, true)) {
                $errors[] = ['column_name' => 'patient_code', 'error_message' => 'Mã bệnh nhân bị trùng lặp trong tệp dữ liệu.'];
            } elseif (! $updateExisting && Patient::where('patient_code', $patientCode)->exists()) {
                $errors[] = ['column_name' => 'patient_code', 'error_message' => 'Mã bệnh nhân đã tồn tại trên hệ thống.'];
            }
        }

        if (! empty($errors)) {
            return $errors;
        }

        // Concurrency-safe code generation if blank
        if ($patientCode !== '') {
            $seenCodes[] = $patientCode;
        } else {
            $patientCode = $this->patientCodeGenerator->generate();
            $seenCodes[] = $patientCode;
        }

        $patientAttributes = [
            'patient_code' => $patientCode,
            'full_name' => $fullName,
            'date_of_birth' => $parsedDob,
            'gender' => $gender,
            'phone' => $phone,
            'email' => $email !== '' ? $email : null,
            'address' => trim((string) ($data['address'] ?? '')) ?: null,
            'emergency_contact_name' => trim((string) ($data['emergency_contact_name'] ?? '')) ?: null,
            'emergency_contact_phone' => trim((string) ($data['emergency_contact_phone'] ?? '')) ?: null,
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
            'status' => 'ACTIVE',
        ];

        if ($updateExisting) {
            Patient::updateOrCreate(['patient_code' => $patientCode], $patientAttributes);
        } else {
            Patient::create($patientAttributes);
        }

        return [];
    }

    /**
     * Process a service row.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $seenCodes
     * @return array<int, array{column_name: string, error_message: string}>
     */
    protected function processServiceRow(array $data, bool $updateExisting, array &$seenCodes): array
    {
        $errors = [];

        // Validate name
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $errors[] = ['column_name' => 'name', 'error_message' => 'Tên dịch vụ không được để trống.'];
        }

        // Validate price
        $rawPrice = trim((string) ($data['price'] ?? ''));
        $price = 0.0;
        if ($rawPrice === '' || ! is_numeric($rawPrice)) {
            $errors[] = ['column_name' => 'price', 'error_message' => 'Giá dịch vụ không được để trống và phải là số hợp lệ.'];
        } else {
            $price = (float) $rawPrice;
            if ($price < 0) {
                $errors[] = ['column_name' => 'price', 'error_message' => 'Giá dịch vụ không thể âm (phải lớn hơn hoặc bằng 0).'];
            }
        }

        // Validate duration_minutes
        $rawDuration = trim((string) ($data['duration_minutes'] ?? ''));
        $duration = 30;
        if ($rawDuration !== '') {
            if (! is_numeric($rawDuration) || (int) $rawDuration < 1 || (int) $rawDuration > 1440) {
                $errors[] = ['column_name' => 'duration_minutes', 'error_message' => 'Thời lượng thực hiện dịch vụ phải từ 1 đến 1440 phút.'];
            } else {
                $duration = (int) $rawDuration;
            }
        }

        // Validate service_code
        $serviceCode = trim((string) ($data['service_code'] ?? ''));
        if ($serviceCode !== '') {
            if (in_array($serviceCode, $seenCodes, true)) {
                $errors[] = ['column_name' => 'service_code', 'error_message' => 'Mã dịch vụ bị trùng lặp trong tệp dữ liệu.'];
            } elseif (! $updateExisting && Service::where('service_code', $serviceCode)->exists()) {
                $errors[] = ['column_name' => 'service_code', 'error_message' => 'Mã dịch vụ đã tồn tại trên hệ thống.'];
            }
        }

        if (! empty($errors)) {
            return $errors;
        }

        if ($serviceCode !== '') {
            $seenCodes[] = $serviceCode;
        } else {
            $serviceCode = $this->serviceCodeGenerator->generate();
            $seenCodes[] = $serviceCode;
        }

        $rawStatus = strtoupper(trim((string) ($data['status'] ?? 'ACTIVE')));
        $status = in_array($rawStatus, ['ACTIVE', 'INACTIVE']) ? $rawStatus : 'ACTIVE';

        $serviceAttributes = [
            'service_code' => $serviceCode,
            'name' => $name,
            'price' => $price,
            'duration_minutes' => $duration,
            'description' => trim((string) ($data['description'] ?? '')) ?: null,
            'status' => $status,
        ];

        if ($updateExisting) {
            Service::updateOrCreate(['service_code' => $serviceCode], $serviceAttributes);
        } else {
            Service::create($serviceAttributes);
        }

        return [];
    }

    /**
     * Process a product row.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $seenCodes
     * @return array<int, array{column_name: string, error_message: string}>
     */
    protected function processProductRow(
        array $data,
        bool $updateExisting,
        array &$seenCodes,
        mixed $user
    ): array {
        $errors = [];

        // Validate name
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $errors[] = ['column_name' => 'name', 'error_message' => 'Tên thuốc/vật tư không được để trống.'];
        }

        // Validate unit
        $unit = trim((string) ($data['unit'] ?? ''));
        if ($unit === '') {
            $errors[] = ['column_name' => 'unit', 'error_message' => 'Đơn vị tính không được để trống.'];
        }

        // Validate minimum_stock
        $rawMinStock = trim((string) ($data['minimum_stock'] ?? '0'));
        $minimumStock = 0.0;
        if ($rawMinStock !== '') {
            if (! is_numeric($rawMinStock)) {
                $errors[] = ['column_name' => 'minimum_stock', 'error_message' => 'Mức tồn kho tối thiểu phải là số.'];
            } elseif ((float) $rawMinStock < 0) {
                $errors[] = ['column_name' => 'minimum_stock', 'error_message' => 'Mức tồn kho tối thiểu không được âm.'];
            } else {
                $minimumStock = (float) $rawMinStock;
            }
        }

        // Validate initial_stock
        $rawInitStock = trim((string) ($data['initial_stock'] ?? '0'));
        $initialStock = 0.0;
        if ($rawInitStock !== '') {
            if (! is_numeric($rawInitStock)) {
                $errors[] = ['column_name' => 'initial_stock', 'error_message' => 'Số lượng tồn đầu kỳ phải là số.'];
            } elseif ((float) $rawInitStock < 0) {
                $errors[] = ['column_name' => 'initial_stock', 'error_message' => 'Số lượng tồn đầu kỳ không được âm.'];
            } else {
                $initialStock = (float) $rawInitStock;
            }
        }

        // Validate product_code
        $productCode = trim((string) ($data['product_code'] ?? ''));
        if ($productCode !== '') {
            if (in_array($productCode, $seenCodes, true)) {
                $errors[] = ['column_name' => 'product_code', 'error_message' => 'Mã sản phẩm bị trùng lặp trong tệp dữ liệu.'];
            } elseif (! $updateExisting && Product::where('product_code', $productCode)->exists()) {
                $errors[] = ['column_name' => 'product_code', 'error_message' => 'Mã sản phẩm đã tồn tại trên hệ thống.'];
            }
        }

        if (! empty($errors)) {
            return $errors;
        }

        if ($productCode !== '') {
            $seenCodes[] = $productCode;
        } else {
            $productCode = $this->productCodeGenerator->generate();
            $seenCodes[] = $productCode;
        }

        $rawStatus = strtoupper(trim((string) ($data['status'] ?? 'ACTIVE')));
        $status = in_array($rawStatus, ['ACTIVE', 'INACTIVE']) ? $rawStatus : 'ACTIVE';

        $productAttributes = [
            'product_code' => $productCode,
            'name' => $name,
            'unit' => $unit,
            'minimum_stock' => $minimumStock,
            'status' => $status,
        ];

        DB::transaction(function () use ($updateExisting, $productCode, $productAttributes, $initialStock, $user) {
            if ($updateExisting) {
                Product::updateOrCreate(['product_code' => $productCode], $productAttributes);
            } else {
                $product = Product::create($productAttributes);
                if ($initialStock > 0) {
                    InventoryTransaction::create([
                        'product_id' => $product->id,
                        'transaction_type' => 'IN',
                        'quantity' => $initialStock,
                        'reference_type' => 'INITIAL_STOCK',
                        'reference_id' => $product->id,
                        'transaction_date' => now(),
                        'created_by' => $user?->id,
                        'created_at' => now(),
                    ]);
                }
            }
        });

        return [];
    }
}
