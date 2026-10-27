<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Patient;
use App\Models\PatientPackage;
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
     * Deduct sessions from a patient package with row lock and invariant preservation.
     *
     * @throws InvalidArgumentException
     */
    public function deductPackageSessions(
        int $packageId,
        int $patientId,
        int $serviceId,
        int $quantity,
        string $visitDate,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): PatientPackage {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Số lượng buổi cần trừ phải lớn hơn 0.');
        }

        /** @var PatientPackage|null $patientPackage */
        $patientPackage = PatientPackage::where('id', $packageId)->lockForUpdate()->first();

        if (! $patientPackage) {
            throw new InvalidArgumentException('Gói dịch vụ của bệnh nhân không tồn tại trên hệ thống.');
        }

        if ((int) $patientPackage->patient_id !== $patientId) {
            throw new InvalidArgumentException('Gói dịch vụ không thuộc về bệnh nhân này.');
        }

        if ($patientPackage->status !== 'ACTIVE') {
            throw new InvalidArgumentException("Gói dịch vụ không ở trạng thái hoạt động (trạng thái hiện tại: {$patientPackage->status}).");
        }

        // Expiry check
        if ($patientPackage->expiry_date !== null) {
            $expiry = Carbon::parse($patientPackage->expiry_date)->startOfDay();
            $visitDay = Carbon::parse($visitDate)->startOfDay();
            $today = Carbon::today();

            if ($expiry->lt($visitDay) || $expiry->lt($today)) {
                throw new InvalidArgumentException("Gói dịch vụ đã hết hạn sử dụng vào ngày {$expiry->toDateString()}.");
            }
        }

        // Service check in package
        $hasService = DB::table('package_services')
            ->where('package_id', $patientPackage->package_id)
            ->where('service_id', $serviceId)
            ->exists();

        if (! $hasService) {
            throw new InvalidArgumentException('Dịch vụ không nằm trong gói dịch vụ đã chọn.');
        }

        // Remaining sessions check
        if ($patientPackage->remaining_sessions < $quantity) {
            throw new InvalidArgumentException("Gói dịch vụ không đủ số buổi còn lại (còn {$patientPackage->remaining_sessions} buổi, yêu cầu {$quantity} buổi).");
        }

        $oldValues = $patientPackage->toArray();

        // Invariant: used_sessions + remaining_sessions == total_sessions
        $patientPackage->used_sessions += $quantity;
        $patientPackage->remaining_sessions -= $quantity;

        if ($patientPackage->remaining_sessions === 0) {
            $patientPackage->status = 'COMPLETED';
        }

        $patientPackage->save();

        AuditLog::create([
            'user_id' => $actor?->id,
            'module' => 'visits',
            'action' => 'deduct_package_session',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
            'old_values' => $oldValues,
            'new_values' => $patientPackage->fresh()->toArray(),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);

        return $patientPackage;
    }

    /**
     * Refund sessions back to a patient package with row lock and invariant preservation.
     */
    public function refundPackageSessions(
        int $packageId,
        int $quantity,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): ?PatientPackage {
        if ($quantity <= 0) {
            return null;
        }

        /** @var PatientPackage|null $patientPackage */
        $patientPackage = PatientPackage::where('id', $packageId)->lockForUpdate()->first();

        if (! $patientPackage) {
            return null;
        }

        $oldValues = $patientPackage->toArray();

        // Invariant: used_sessions + remaining_sessions == total_sessions
        $actualRefund = min($quantity, (int) $patientPackage->used_sessions);
        if ($actualRefund <= 0) {
            return $patientPackage;
        }

        $patientPackage->used_sessions -= $actualRefund;
        $patientPackage->remaining_sessions = min(
            (int) $patientPackage->total_sessions,
            (int) $patientPackage->remaining_sessions + $actualRefund
        );

        // If package was marked COMPLETED/EXHAUSTED but now has remaining sessions, restore to ACTIVE
        if ($patientPackage->remaining_sessions > 0 && in_array($patientPackage->status, ['COMPLETED', 'EXHAUSTED'], true)) {
            $patientPackage->status = 'ACTIVE';
        }

        $patientPackage->save();

        AuditLog::create([
            'user_id' => $actor?->id,
            'module' => 'visits',
            'action' => 'refund_package_session',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
            'old_values' => $oldValues,
            'new_values' => $patientPackage->fresh()->toArray(),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);

        return $patientPackage;
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

            $patientPackageId = isset($data['patient_package_id']) && ! empty($data['patient_package_id'])
                ? (int) $data['patient_package_id']
                : null;

            // Deduct package sessions if package assigned and status is active (not CANCELLED)
            if ($patientPackageId !== null && $status !== 'CANCELLED') {
                $this->deductPackageSessions(
                    $patientPackageId,
                    (int) $data['patient_id'],
                    (int) $data['service_id'],
                    $amounts['quantity'],
                    (string) $data['visit_date'],
                    $actor,
                    $ipAddress,
                    $userAgent
                );
            }

            $visit = Visit::create([
                'visit_code' => $visitCode,
                'patient_id' => $data['patient_id'],
                'employee_id' => $data['employee_id'],
                'service_id' => $data['service_id'],
                'patient_package_id' => $patientPackageId,
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
            $oldPackageId = $visit->patient_package_id ? (int) $visit->patient_package_id : null;
            $oldQuantity = (int) $visit->quantity;
            $oldStatus = (string) $visit->status;
            $wasDeducted = ($oldPackageId !== null && $oldStatus !== 'CANCELLED');

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

            $newPatientId = array_key_exists('patient_id', $data) ? (int) $data['patient_id'] : (int) $visit->patient_id;
            $newServiceId = array_key_exists('service_id', $data) ? (int) $data['service_id'] : (int) $visit->service_id;
            $newVisitDate = array_key_exists('visit_date', $data) ? (string) $data['visit_date'] : (string) $visit->visit_date;
            $newStatus = array_key_exists('status', $data) ? (string) $data['status'] : $oldStatus;
            $newPackageId = array_key_exists('patient_package_id', $data)
                ? ($data['patient_package_id'] ? (int) $data['patient_package_id'] : null)
                : $oldPackageId;
            $newQuantity = $amounts['quantity'];
            $shouldBeDeducted = ($newPackageId !== null && $newStatus !== 'CANCELLED');

            // Handle package session transition logic
            if ($wasDeducted && ! $shouldBeDeducted) {
                $this->refundPackageSessions($oldPackageId, $oldQuantity, $actor, $ipAddress, $userAgent);
            } elseif (! $wasDeducted && $shouldBeDeducted) {
                $this->deductPackageSessions(
                    $newPackageId,
                    $newPatientId,
                    $newServiceId,
                    $newQuantity,
                    $newVisitDate,
                    $actor,
                    $ipAddress,
                    $userAgent
                );
            } elseif ($wasDeducted && $shouldBeDeducted) {
                if ($oldPackageId !== $newPackageId) {
                    $this->refundPackageSessions($oldPackageId, $oldQuantity, $actor, $ipAddress, $userAgent);
                    $this->deductPackageSessions(
                        $newPackageId,
                        $newPatientId,
                        $newServiceId,
                        $newQuantity,
                        $newVisitDate,
                        $actor,
                        $ipAddress,
                        $userAgent
                    );
                } else {
                    // Same package: validate constraints and adjust quantity difference
                    /** @var PatientPackage|null $patientPackage */
                    $patientPackage = PatientPackage::where('id', $newPackageId)->lockForUpdate()->first();
                    if (! $patientPackage) {
                        throw new InvalidArgumentException('Gói dịch vụ của bệnh nhân không tồn tại trên hệ thống.');
                    }
                    if ((int) $patientPackage->patient_id !== $newPatientId) {
                        throw new InvalidArgumentException('Gói dịch vụ không thuộc về bệnh nhân này.');
                    }
                    $hasService = DB::table('package_services')
                        ->where('package_id', $patientPackage->package_id)
                        ->where('service_id', $newServiceId)
                        ->exists();
                    if (! $hasService) {
                        throw new InvalidArgumentException('Dịch vụ không nằm trong gói dịch vụ đã chọn.');
                    }
                    if ($patientPackage->expiry_date !== null) {
                        $expiry = Carbon::parse($patientPackage->expiry_date)->startOfDay();
                        $visitDay = Carbon::parse($newVisitDate)->startOfDay();
                        $today = Carbon::today();
                        if ($expiry->lt($visitDay) || $expiry->lt($today)) {
                            throw new InvalidArgumentException("Gói dịch vụ đã hết hạn sử dụng vào ngày {$expiry->toDateString()}.");
                        }
                    }

                    if ($newQuantity > $oldQuantity) {
                        $diff = $newQuantity - $oldQuantity;
                        if ($patientPackage->status !== 'ACTIVE') {
                            throw new InvalidArgumentException("Gói dịch vụ không ở trạng thái hoạt động (trạng thái hiện tại: {$patientPackage->status}).");
                        }
                        if ($patientPackage->remaining_sessions < $diff) {
                            throw new InvalidArgumentException("Gói dịch vụ không đủ số buổi còn lại (còn {$patientPackage->remaining_sessions} buổi, yêu cầu thêm {$diff} buổi).");
                        }
                        $patientPackage->used_sessions += $diff;
                        $patientPackage->remaining_sessions -= $diff;
                        if ($patientPackage->remaining_sessions === 0) {
                            $patientPackage->status = 'COMPLETED';
                        }
                        $patientPackage->save();
                    } elseif ($newQuantity < $oldQuantity) {
                        $diff = $oldQuantity - $newQuantity;
                        $actualRefund = min($diff, (int) $patientPackage->used_sessions);
                        $patientPackage->used_sessions -= $actualRefund;
                        $patientPackage->remaining_sessions = min(
                            (int) $patientPackage->total_sessions,
                            (int) $patientPackage->remaining_sessions + $actualRefund
                        );
                        if ($patientPackage->remaining_sessions > 0 && in_array($patientPackage->status, ['COMPLETED', 'EXHAUSTED'], true)) {
                            $patientPackage->status = 'ACTIVE';
                        }
                        $patientPackage->save();
                    }
                    // When newQuantity === oldQuantity, no session changes (idempotent)!
                }
            }

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
            $oldStatus = (string) $visit->status;

            if ($visit->patient_package_id !== null) {
                $wasDeducted = ($oldStatus !== 'CANCELLED');
                $shouldBeDeducted = ($newStatus !== 'CANCELLED');

                if ($wasDeducted && ! $shouldBeDeducted) {
                    $this->refundPackageSessions(
                        (int) $visit->patient_package_id,
                        (int) $visit->quantity,
                        $actor,
                        $ipAddress,
                        $userAgent
                    );
                } elseif (! $wasDeducted && $shouldBeDeducted) {
                    $this->deductPackageSessions(
                        (int) $visit->patient_package_id,
                        (int) $visit->patient_id,
                        (int) $visit->service_id,
                        (int) $visit->quantity,
                        (string) $visit->visit_date,
                        $actor,
                        $ipAddress,
                        $userAgent
                    );
                }
                // Transitioning between active statuses: no session adjustment needed (idempotent)
            }

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
            $oldStatus = (string) $visit->status;

            // Refund package sessions if visit was not cancelled
            if ($oldStatus !== 'CANCELLED' && $visit->patient_package_id !== null) {
                $this->refundPackageSessions(
                    (int) $visit->patient_package_id,
                    (int) $visit->quantity,
                    $actor,
                    $ipAddress,
                    $userAgent
                );
            }

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

            // Refund package sessions if not cancelled
            if ($visit->status !== 'CANCELLED' && $visit->patient_package_id !== null) {
                $this->refundPackageSessions(
                    (int) $visit->patient_package_id,
                    (int) $visit->quantity,
                    $actor,
                    $ipAddress,
                    $userAgent
                );
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
