<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Patient;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class VisitService
{
    /**
     * Generate a unique visit code with prefix 'VIS'.
     * Format: VISxxxxxx (e.g., VIS000001, VIS000002)
     * Concurrency-safe scan of highest existing numeric suffix with collision-check loop.
     */
    public function generateVisitCode(): string
    {
        $allCodes = DB::table('visits')->pluck('visit_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:VIS-?|LK-?|VISIT-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'VIS'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('visits')->where('visit_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }

    /**
     * Calculate subtotal, discount, and total amounts.
     * total_amount = max(0, quantity * unit_price - discount_amount).
     *
     * @return array{quantity: int, unit_price: float, discount_amount: float, total_amount: float}
     *
     * @throws InvalidArgumentException
     */
    public function calculateAmounts(int $quantity, float $unitPrice, float $discountAmount): array
    {
        if ($quantity < 1) {
            throw new InvalidArgumentException('Số lượng dịch vụ phải lớn hơn hoặc bằng 1.');
        }

        if ($unitPrice < 0) {
            throw new InvalidArgumentException('Đơn giá không được âm.');
        }

        if ($discountAmount < 0) {
            throw new InvalidArgumentException('Số tiền giảm giá không được âm.');
        }

        $subtotal = $quantity * $unitPrice;
        if ($discountAmount > $subtotal) {
            throw new InvalidArgumentException('Số tiền giảm giá không được vượt quá tổng thành tiền của dịch vụ.');
        }

        $totalAmount = max(0.0, round($subtotal - $discountAmount, 2));

        return [
            'quantity' => $quantity,
            'unit_price' => round($unitPrice, 2),
            'discount_amount' => round($discountAmount, 2),
            'total_amount' => $totalAmount,
        ];
    }

    /**
     * Update patient's first_visit_date and last_visit_date based on all visits.
     */
    public function updatePatientVisitDates(int $patientId): void
    {
        $patient = Patient::find($patientId);
        if (! $patient) {
            return;
        }

        // Search among non-cancelled visits first
        $nonCancelled = Visit::where('patient_id', $patientId)
            ->where('status', '!=', 'CANCELLED');

        $minDate = (clone $nonCancelled)->min('visit_date');
        $maxDate = (clone $nonCancelled)->max('visit_date');

        // If no active non-cancelled visits, fall back to any visits
        if (! $minDate) {
            $minDate = Visit::where('patient_id', $patientId)->min('visit_date');
            $maxDate = Visit::where('patient_id', $patientId)->max('visit_date');
        }

        $patient->first_visit_date = $minDate ? Carbon::parse($minDate)->toDateString() : null;
        $patient->last_visit_date = $maxDate ? Carbon::parse($maxDate)->toDateString() : null;
        $patient->save();
    }

    /**
     * Create a new visit inside a DB transaction.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws InvalidArgumentException
     */
    public function createVisit(
        array $data,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Visit {
        return DB::transaction(function () use ($data, $actor, $ipAddress, $userAgent) {
            $service = Service::findOrFail($data['service_id']);

            $quantity = isset($data['quantity']) ? (int) $data['quantity'] : 1;
            $unitPrice = isset($data['unit_price']) ? (float) $data['unit_price'] : (float) $service->price;
            $discountAmount = isset($data['discount_amount']) ? (float) $data['discount_amount'] : 0.0;

            $amounts = $this->calculateAmounts($quantity, $unitPrice, $discountAmount);

            $visitCode = ! empty($data['visit_code'])
                ? (string) $data['visit_code']
                : $this->generateVisitCode();

            $status = $data['status'] ?? 'SCHEDULED';
            $paymentStatus = $data['payment_status'] ?? 'UNPAID';

            $visit = Visit::create([
                'visit_code' => $visitCode,
                'patient_id' => $data['patient_id'],
                'employee_id' => $data['employee_id'],
                'service_id' => $data['service_id'],
                'patient_package_id' => $data['patient_package_id'] ?? null,
                'appointment_id' => $data['appointment_id'] ?? null,
                'visit_date' => $data['visit_date'],
                'quantity' => $amounts['quantity'],
                'unit_price' => $amounts['unit_price'],
                'discount_amount' => $amounts['discount_amount'],
                'total_amount' => $amounts['total_amount'],
                'payment_status' => $paymentStatus,
                'status' => $status,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor?->id,
            ]);

            // Update patient visit dates
            $this->updatePatientVisitDates((int) $data['patient_id']);

            // Create audit log
            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'visits',
                'action' => 'create',
                'table_name' => 'visits',
                'record_id' => (string) $visit->id,
                'old_values' => null,
                'new_values' => $visit->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $visit;
        });
    }

    /**
     * Update an existing visit inside a DB transaction.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws InvalidArgumentException
     */
    public function updateVisit(
        Visit $visit,
        array $data,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Visit {
        return DB::transaction(function () use ($visit, $data, $actor, $ipAddress, $userAgent) {
            $oldValues = $visit->toArray();
            $oldPatientId = (int) $visit->patient_id;

            $quantity = array_key_exists('quantity', $data)
                ? (int) $data['quantity']
                : (int) $visit->quantity;

            if (array_key_exists('unit_price', $data)) {
                $unitPrice = (float) $data['unit_price'];
            } elseif (array_key_exists('service_id', $data) && $data['service_id'] !== $visit->service_id) {
                $service = Service::find($data['service_id']);
                $unitPrice = $service ? (float) $service->price : (float) $visit->unit_price;
            } else {
                $unitPrice = (float) $visit->unit_price;
            }

            $discountAmount = array_key_exists('discount_amount', $data)
                ? (float) $data['discount_amount']
                : (float) $visit->discount_amount;

            $amounts = $this->calculateAmounts($quantity, $unitPrice, $discountAmount);

            $updatePayload = [];

            if (array_key_exists('visit_code', $data) && $data['visit_code'] !== null) {
                $updatePayload['visit_code'] = (string) $data['visit_code'];
            }
            if (array_key_exists('patient_id', $data)) {
                $updatePayload['patient_id'] = (int) $data['patient_id'];
            }
            if (array_key_exists('employee_id', $data)) {
                $updatePayload['employee_id'] = (int) $data['employee_id'];
            }
            if (array_key_exists('service_id', $data)) {
                $updatePayload['service_id'] = (int) $data['service_id'];
            }
            if (array_key_exists('patient_package_id', $data)) {
                $updatePayload['patient_package_id'] = $data['patient_package_id'];
            }
            if (array_key_exists('appointment_id', $data)) {
                $updatePayload['appointment_id'] = $data['appointment_id'];
            }
            if (array_key_exists('visit_date', $data)) {
                $updatePayload['visit_date'] = $data['visit_date'];
            }
            if (array_key_exists('status', $data)) {
                $updatePayload['status'] = (string) $data['status'];
            }
            if (array_key_exists('payment_status', $data)) {
                $updatePayload['payment_status'] = (string) $data['payment_status'];
            }
            if (array_key_exists('notes', $data)) {
                $updatePayload['notes'] = $data['notes'];
            }

            $updatePayload['quantity'] = $amounts['quantity'];
            $updatePayload['unit_price'] = $amounts['unit_price'];
            $updatePayload['discount_amount'] = $amounts['discount_amount'];
            $updatePayload['total_amount'] = $amounts['total_amount'];

            $visit->update($updatePayload);

            $newPatientId = (int) $visit->patient_id;
            $this->updatePatientVisitDates($newPatientId);
            if ($oldPatientId !== $newPatientId) {
                $this->updatePatientVisitDates($oldPatientId);
            }

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'visits',
                'action' => 'update',
                'table_name' => 'visits',
                'record_id' => (string) $visit->id,
                'old_values' => $oldValues,
                'new_values' => $visit->fresh()->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $visit->fresh();
        });
    }

    /**
     * Update visit status (e.g. SCHEDULED -> IN_PROGRESS -> COMPLETED, or CANCELLED).
     */
    public function updateStatus(
        Visit $visit,
        string $newStatus,
        ?string $notes = null,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Visit {
        return DB::transaction(function () use ($visit, $newStatus, $notes, $actor, $ipAddress, $userAgent) {
            $allowedStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
            if (! in_array($newStatus, $allowedStatuses, true)) {
                throw new InvalidArgumentException("Trạng thái không hợp lệ: {$newStatus}");
            }

            $oldValues = $visit->toArray();

            $visit->status = $newStatus;
            if ($notes !== null) {
                $visit->notes = $notes;
            }
            $visit->save();

            $this->updatePatientVisitDates((int) $visit->patient_id);

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'visits',
                'action' => 'status_update',
                'table_name' => 'visits',
                'record_id' => (string) $visit->id,
                'old_values' => $oldValues,
                'new_values' => $visit->fresh()->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $visit->fresh();
        });
    }

    /**
     * Cancel a visit.
     */
    public function cancelVisit(
        Visit $visit,
        ?string $reason = null,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Visit {
        return DB::transaction(function () use ($visit, $reason, $actor, $ipAddress, $userAgent) {
            $oldValues = $visit->toArray();

            $visit->status = 'CANCELLED';
            if ($reason !== null && trim($reason) !== '') {
                $trimmedReason = trim($reason);
                $visit->notes = $visit->notes
                    ? $visit->notes." | Lý do hủy: {$trimmedReason}"
                    : "Lý do hủy: {$trimmedReason}";
            }
            $visit->save();

            $this->updatePatientVisitDates((int) $visit->patient_id);

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'visits',
                'action' => 'cancel',
                'table_name' => 'visits',
                'record_id' => (string) $visit->id,
                'old_values' => $oldValues,
                'new_values' => $visit->fresh()->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $visit->fresh();
        });
    }

    /**
     * Delete a visit if eligible.
     *
     * @throws InvalidArgumentException
     */
    public function deleteVisit(
        Visit $visit,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): bool {
        return DB::transaction(function () use ($visit, $actor, $ipAddress, $userAgent) {
            if ($visit->medicalRecord()->exists()) {
                throw new InvalidArgumentException('Không thể xóa lượt khám đã có hồ sơ bệnh án.');
            }

            if ($visit->invoices()->exists()) {
                throw new InvalidArgumentException('Không thể xóa lượt khám đã phát sinh hóa đơn tài chính.');
            }

            $patientId = (int) $visit->patient_id;
            $oldValues = $visit->toArray();

            $visit->delete();

            $this->updatePatientVisitDates($patientId);

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'visits',
                'action' => 'delete',
                'table_name' => 'visits',
                'record_id' => (string) $oldValues['id'],
                'old_values' => $oldValues,
                'new_values' => null,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return true;
        });
    }
}
