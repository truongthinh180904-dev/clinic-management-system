<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AppointmentOverlapException extends \RuntimeException
{
    public function __construct(
        string $message = 'Nhân viên/Bác sĩ đã có lịch hẹn khác trong khung giờ này trên cùng ngày khám.',
        int $code = 409,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code, $previous);
    }
}

class AppointmentService
{
    public function __construct(
        protected ?VisitService $visitService = null
    ) {
        $this->visitService = $visitService ?? app(VisitService::class);
    }

    /**
     * Generate a unique appointment code with prefix 'APT'.
     * Format: APTxxxxxx (e.g., APT000001, APT000002)
     * Concurrency-safe scan of max numeric suffix with collision-check loop.
     */
    public function generateAppointmentCode(): string
    {
        $allCodes = DB::table('appointments')->pluck('appointment_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:APT-?|LH-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'APT'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('appointments')->where('appointment_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }

    /**
     * Normalize a time string into H:i:s format.
     */
    public function normalizeTime(string $time): string
    {
        $parts = explode(':', trim($time));
        $hours = str_pad($parts[0] ?? '0', 2, '0', STR_PAD_LEFT);
        $minutes = str_pad($parts[1] ?? '0', 2, '0', STR_PAD_LEFT);
        $seconds = str_pad($parts[2] ?? '0', 2, '0', STR_PAD_LEFT);

        return "{$hours}:{$minutes}:{$seconds}";
    }

    /**
     * Check whether an employee has an overlapping appointment in the given time slot.
     * Overlap condition:
     * existing.start_time < new.end_time AND existing.end_time > new.start_time
     * for same employee on same date with status != CANCELLED.
     */
    public function hasOverlap(
        int $employeeId,
        string $date,
        string $startTime,
        string $endTime,
        ?int $excludeAppointmentId = null
    ): bool {
        $normalizedDate = Carbon::parse($date)->toDateString();
        $normalizedStart = $this->normalizeTime($startTime);
        $normalizedEnd = $this->normalizeTime($endTime);

        return Appointment::query()
            ->where('employee_id', $employeeId)
            ->whereDate('appointment_date', $normalizedDate)
            ->where('status', '!=', 'CANCELLED')
            ->when($excludeAppointmentId, function ($query, $id) {
                $query->where('id', '!=', $id);
            })
            ->where(function ($query) use ($normalizedStart, $normalizedEnd) {
                $query->where('start_time', '<', $normalizedEnd)
                    ->where('end_time', '>', $normalizedStart);
            })
            ->exists();
    }

    /**
     * Create a new appointment with transaction + row lock on the assigned employee.
     *
     * @param  array{
     *     patient_id: int,
     *     employee_id: int,
     *     service_id: int,
     *     appointment_date: string,
     *     start_time: string,
     *     end_time: string,
     *     appointment_code?: string|null,
     *     status?: string|null,
     *     notes?: string|null,
     * }  $data
     *
     * @throws InvalidArgumentException
     * @throws AppointmentOverlapException
     */
    public function createAppointment(
        array $data,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Appointment {
        $patient = Patient::find($data['patient_id']);
        if (! $patient) {
            throw new InvalidArgumentException('Không tìm thấy thông tin bệnh nhân.');
        }

        $service = Service::find($data['service_id']);
        if (! $service) {
            throw new InvalidArgumentException('Không tìm thấy dịch vụ được chọn.');
        }

        if ($service->status !== 'ACTIVE') {
            throw new InvalidArgumentException('Dịch vụ được chọn không ở trạng thái hoạt động (ACTIVE).');
        }

        $appointmentDate = Carbon::parse($data['appointment_date'])->toDateString();
        $startTime = $this->normalizeTime($data['start_time']);
        $endTime = $this->normalizeTime($data['end_time']);

        if ($startTime >= $endTime) {
            throw new InvalidArgumentException('Thời gian kết thúc (end_time) phải lớn hơn thời gian bắt đầu (start_time).');
        }

        $status = $data['status'] ?? 'CONFIRMED';
        $notes = $data['notes'] ?? null;
        $employeeId = (int) $data['employee_id'];

        return DB::transaction(function () use (
            $data,
            $patient,
            $service,
            $employeeId,
            $appointmentDate,
            $startTime,
            $endTime,
            $status,
            $notes,
            $actor,
            $ipAddress,
            $userAgent
        ) {
            // Row-level lock on employee to prevent concurrent overlap race condition
            $employee = Employee::where('id', $employeeId)->lockForUpdate()->first();
            if (! $employee) {
                throw new InvalidArgumentException('Không tìm thấy thông tin nhân viên/bác sĩ phụ trách.');
            }

            // Check overlap if status is not CANCELLED
            if ($status !== 'CANCELLED') {
                $overlapExists = Appointment::query()
                    ->where('employee_id', $employee->id)
                    ->whereDate('appointment_date', $appointmentDate)
                    ->where('status', '!=', 'CANCELLED')
                    ->where(function ($query) use ($startTime, $endTime) {
                        $query->where('start_time', '<', $endTime)
                            ->where('end_time', '>', $startTime);
                    })
                    ->exists();

                if ($overlapExists) {
                    throw new AppointmentOverlapException('Nhân viên/Bác sĩ đã có lịch hẹn khác trong khung giờ này trên cùng ngày khám.');
                }
            }

            $appointmentCode = ! empty($data['appointment_code'])
                ? $data['appointment_code']
                : $this->generateAppointmentCode();

            $appointment = Appointment::create([
                'appointment_code' => $appointmentCode,
                'patient_id' => $patient->id,
                'employee_id' => $employee->id,
                'service_id' => $service->id,
                'appointment_date' => $appointmentDate,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'status' => $status,
                'notes' => $notes,
                'created_by' => $actor?->id,
            ]);

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'appointments',
                'action' => 'create',
                'table_name' => 'appointments',
                'record_id' => (string) $appointment->id,
                'old_values' => null,
                'new_values' => $appointment->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $appointment;
        });
    }

    /**
     * Update an appointment with overlap prevention.
     *
     * @param  array{
     *     patient_id?: int,
     *     employee_id?: int,
     *     service_id?: int,
     *     appointment_date?: string,
     *     start_time?: string,
     *     end_time?: string,
     *     appointment_code?: string,
     *     status?: string,
     *     notes?: string|null,
     * }  $data
     *
     * @throws InvalidArgumentException
     * @throws AppointmentOverlapException
     */
    public function updateAppointment(
        Appointment $appointment,
        array $data,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Appointment {
        $targetEmployeeId = (int) ($data['employee_id'] ?? $appointment->employee_id);

        if (isset($data['service_id'])) {
            $service = Service::find($data['service_id']);
            if (! $service) {
                throw new InvalidArgumentException('Không tìm thấy dịch vụ được chọn.');
            }
            if ($service->status !== 'ACTIVE') {
                throw new InvalidArgumentException('Dịch vụ được chọn không ở trạng thái hoạt động (ACTIVE).');
            }
        }

        if (isset($data['patient_id'])) {
            $patient = Patient::find($data['patient_id']);
            if (! $patient) {
                throw new InvalidArgumentException('Không tìm thấy thông tin bệnh nhân.');
            }
        }

        $targetDate = isset($data['appointment_date'])
            ? Carbon::parse($data['appointment_date'])->toDateString()
            : Carbon::parse($appointment->appointment_date)->toDateString();

        $targetStartTime = isset($data['start_time'])
            ? $this->normalizeTime($data['start_time'])
            : $this->normalizeTime((string) $appointment->start_time);

        $targetEndTime = isset($data['end_time'])
            ? $this->normalizeTime($data['end_time'])
            : $this->normalizeTime((string) $appointment->end_time);

        if ($targetStartTime >= $targetEndTime) {
            throw new InvalidArgumentException('Thời gian kết thúc (end_time) phải lớn hơn thời gian bắt đầu (start_time).');
        }

        $targetStatus = $data['status'] ?? $appointment->status;

        if ($targetStatus !== $appointment->status) {
            $notes = $data['notes'] ?? $appointment->notes;
            $this->validateTransition($appointment, $targetStatus, $notes);
        }

        return DB::transaction(function () use (
            $appointment,
            $data,
            $targetEmployeeId,
            $targetDate,
            $targetStartTime,
            $targetEndTime,
            $targetStatus,
            $actor,
            $ipAddress,
            $userAgent
        ) {
            // Row-level lock on the target employee
            $employee = Employee::where('id', $targetEmployeeId)->lockForUpdate()->first();
            if (! $employee) {
                throw new InvalidArgumentException('Không tìm thấy thông tin nhân viên/bác sĩ phụ trách.');
            }

            // Check overlap if new status is not CANCELLED
            if ($targetStatus !== 'CANCELLED') {
                $overlapExists = Appointment::query()
                    ->where('employee_id', $employee->id)
                    ->whereDate('appointment_date', $targetDate)
                    ->where('id', '!=', $appointment->id)
                    ->where('status', '!=', 'CANCELLED')
                    ->where(function ($query) use ($targetStartTime, $targetEndTime) {
                        $query->where('start_time', '<', $targetEndTime)
                            ->where('end_time', '>', $targetStartTime);
                    })
                    ->exists();

                if ($overlapExists) {
                    throw new AppointmentOverlapException('Nhân viên/Bác sĩ đã có lịch hẹn khác trong khung giờ này trên cùng ngày khám.');
                }
            }

            $oldValues = $appointment->toArray();

            $appointment->fill([
                'patient_id' => $data['patient_id'] ?? $appointment->patient_id,
                'employee_id' => $targetEmployeeId,
                'service_id' => $data['service_id'] ?? $appointment->service_id,
                'appointment_date' => $targetDate,
                'start_time' => $targetStartTime,
                'end_time' => $targetEndTime,
                'status' => $targetStatus,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $appointment->notes,
            ]);

            if (! empty($data['appointment_code'])) {
                $appointment->appointment_code = $data['appointment_code'];
            }

            $appointment->save();

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'appointments',
                'action' => 'update',
                'table_name' => 'appointments',
                'record_id' => (string) $appointment->id,
                'old_values' => $oldValues,
                'new_values' => $appointment->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $appointment;
        });
    }

    /**
     * Validate state machine transitions.
     * Enforces: PENDING -> CONFIRMED -> COMPLETED (or CANCELLED with reason)
     * Rejects illegal transitions / skips (e.g., PENDING directly to COMPLETED).
     * Rejects transitions from terminal states (COMPLETED, CANCELLED, NO_SHOW).
     *
     * @throws InvalidArgumentException
     */
    public function validateTransition(Appointment $appointment, string $newStatus, ?string $reason = null): void
    {
        $currentStatus = $appointment->status;

        if ($currentStatus === Appointment::STATUS_CANCELLED) {
            throw new InvalidArgumentException('Lịch hẹn này đã bị hủy trước đó và không thể thay đổi trạng thái.');
        }

        if ($currentStatus === Appointment::STATUS_COMPLETED && $newStatus !== Appointment::STATUS_COMPLETED) {
            throw new InvalidArgumentException('Lịch hẹn đã hoàn thành và không thể chuyển sang trạng thái khác.');
        }

        if ($currentStatus === Appointment::STATUS_NO_SHOW && $newStatus !== Appointment::STATUS_NO_SHOW) {
            throw new InvalidArgumentException('Lịch hẹn ở trạng thái không đến (NO_SHOW) không thể chuyển sang trạng thái khác.');
        }

        if ($currentStatus === $newStatus) {
            return;
        }

        if (! $appointment->canTransitionTo($newStatus)) {
            throw new InvalidArgumentException(
                "Không thể chuyển trạng thái lịch hẹn từ {$currentStatus} sang {$newStatus}. Quy trình trạng thái phải tuân thủ: PENDING -> CONFIRMED -> COMPLETED (hoặc CANCELLED kèm lý do hủy)."
            );
        }

        if ($newStatus === Appointment::STATUS_CANCELLED && ($reason === null || trim($reason) === '')) {
            throw new InvalidArgumentException('Vui lòng cung cấp lý do khi hủy lịch hẹn.');
        }
    }

    /**
     * Cancel an appointment.
     */
    public function cancelAppointment(
        Appointment $appointment,
        ?string $reason = null,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Appointment {
        $this->validateTransition($appointment, Appointment::STATUS_CANCELLED, $reason);

        return DB::transaction(function () use (
            $appointment,
            $reason,
            $actor,
            $ipAddress,
            $userAgent
        ) {
            $oldValues = $appointment->toArray();

            $appointment->status = Appointment::STATUS_CANCELLED;

            if ($reason !== null && trim($reason) !== '') {
                $appointment->notes = trim(($appointment->notes ? $appointment->notes."\n" : '').'Lý do hủy: '.trim($reason));
            }

            $appointment->save();

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'appointments',
                'action' => 'cancel',
                'table_name' => 'appointments',
                'record_id' => (string) $appointment->id,
                'old_values' => $oldValues,
                'new_values' => $appointment->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $appointment;
        });
    }

    /**
     * Delete an appointment if no visits have been conducted.
     *
     * @throws InvalidArgumentException
     */
    public function deleteAppointment(
        Appointment $appointment,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): bool {
        if ($appointment->visits()->exists()) {
            throw new InvalidArgumentException('Không thể xóa lịch hẹn đã phát sinh lượt khám.');
        }

        return DB::transaction(function () use (
            $appointment,
            $actor,
            $ipAddress,
            $userAgent
        ) {
            $oldValues = $appointment->toArray();
            $recordId = (string) $appointment->id;

            $appointment->delete();

            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'appointments',
                'action' => 'delete',
                'table_name' => 'appointments',
                'record_id' => $recordId,
                'old_values' => $oldValues,
                'new_values' => null,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return true;
        });
    }

    /**
     * Atomically check in an appointment to create a Visit and complete the appointment.
     * Prevents duplicate creation under concurrent requests using DB::transaction() and pessimistic row lock.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws InvalidArgumentException
     */
    public function checkInAppointment(
        Appointment $appointment,
        array $data = [],
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Visit {
        return DB::transaction(function () use (
            $appointment,
            $data,
            $actor,
            $ipAddress,
            $userAgent
        ) {
            // 1. Pessimistic row-level lock on the appointment record
            /** @var Appointment|null $lockedAppointment */
            $lockedAppointment = Appointment::where('id', $appointment->id)
                ->lockForUpdate()
                ->first();

            if (! $lockedAppointment) {
                throw new InvalidArgumentException('Không tìm thấy thông tin lịch hẹn.');
            }

            // 2. Prevent duplicate check-in / visits creation under race conditions
            if ($lockedAppointment->status === Appointment::STATUS_COMPLETED || $lockedAppointment->visits()->exists()) {
                throw new InvalidArgumentException('Lịch hẹn này đã hoàn thành hoặc đã phát sinh lượt khám trước đó.');
            }

            // 3. State transition validations
            if ($lockedAppointment->status === Appointment::STATUS_CANCELLED) {
                throw new InvalidArgumentException('Không thể tiếp nhận lịch hẹn đã bị hủy.');
            }

            if ($lockedAppointment->status === Appointment::STATUS_NO_SHOW) {
                throw new InvalidArgumentException('Không thể tiếp nhận lịch hẹn ở trạng thái không đến (NO_SHOW).');
            }

            if ($lockedAppointment->status !== Appointment::STATUS_CONFIRMED) {
                throw new InvalidArgumentException(
                    "Không thể tiếp nhận lịch hẹn ở trạng thái {$lockedAppointment->status}. Lịch hẹn phải ở trạng thái đã xác nhận (CONFIRMED) trước khi tiếp nhận."
                );
            }

            // 4. Resolve clinical entities and amounts
            $service = Service::find($data['service_id'] ?? $lockedAppointment->service_id);
            if (! $service) {
                throw new InvalidArgumentException('Không tìm thấy thông tin dịch vụ của lịch hẹn.');
            }

            $employeeId = (int) ($data['employee_id'] ?? $lockedAppointment->employee_id);
            $employee = Employee::find($employeeId);
            if (! $employee) {
                throw new InvalidArgumentException('Không tìm thấy thông tin nhân viên/bác sĩ phụ trách.');
            }

            $patient = Patient::find($lockedAppointment->patient_id);
            if (! $patient) {
                throw new InvalidArgumentException('Không tìm thấy thông tin bệnh nhân.');
            }

            $quantity = isset($data['quantity']) ? (int) $data['quantity'] : 1;
            $unitPrice = isset($data['unit_price']) ? (float) $data['unit_price'] : (float) $service->price;
            $discountAmount = isset($data['discount_amount']) ? (float) $data['discount_amount'] : 0.0;
            $totalAmount = max(0.0, round(($quantity * $unitPrice) - $discountAmount, 2));

            $visitDate = ! empty($data['visit_date'])
                ? Carbon::parse($data['visit_date'])->toDateTimeString()
                : now()->toDateTimeString();

            $visitService = $this->visitService ?? app(VisitService::class);
            $visitCode = ! empty($data['visit_code'])
                ? (string) $data['visit_code']
                : $visitService->generateVisitCode();

            $visitNotes = ! empty($data['notes'])
                ? (string) $data['notes']
                : "[Tiếp nhận từ Lịch hẹn {$lockedAppointment->appointment_code}]".($lockedAppointment->notes ? " - {$lockedAppointment->notes}" : '');

            // 5. Handle patient package deduction if supplied
            $patientPackageId = isset($data['patient_package_id']) && ! empty($data['patient_package_id'])
                ? (int) $data['patient_package_id']
                : null;

            if ($patientPackageId !== null) {
                $visitService->deductPackageSessions(
                    $patientPackageId,
                    $patient->id,
                    $service->id,
                    $quantity,
                    $visitDate,
                    $actor,
                    $ipAddress,
                    $userAgent
                );
            }

            // 6. Create Visit record linked to appointment_id
            $visit = Visit::create([
                'visit_code' => $visitCode,
                'patient_id' => $patient->id,
                'employee_id' => $employee->id,
                'service_id' => $service->id,
                'patient_package_id' => $patientPackageId,
                'appointment_id' => $lockedAppointment->id,
                'visit_date' => $visitDate,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount_amount' => $discountAmount,
                'total_amount' => $totalAmount,
                'payment_status' => Visit::PAYMENT_STATUS_UNPAID,
                'status' => Visit::STATUS_SCHEDULED,
                'notes' => $visitNotes,
                'created_by' => $actor?->id,
            ]);

            // Update patient visit dates
            $visitService->updatePatientVisitDates($patient->id);

            // Audit log for visit creation
            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'visits',
                'action' => 'create_from_appointment',
                'table_name' => 'visits',
                'record_id' => (string) $visit->id,
                'old_values' => null,
                'new_values' => $visit->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            // 7. Transition Appointment status to COMPLETED
            $oldApptValues = $lockedAppointment->toArray();
            $lockedAppointment->status = Appointment::STATUS_COMPLETED;
            $lockedAppointment->save();

            $appointment->status = Appointment::STATUS_COMPLETED;

            // Audit log for appointment status transition
            AuditLog::create([
                'user_id' => $actor?->id,
                'module' => 'appointments',
                'action' => 'check_in',
                'table_name' => 'appointments',
                'record_id' => (string) $lockedAppointment->id,
                'old_values' => $oldApptValues,
                'new_values' => $lockedAppointment->toArray(),
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => now(),
            ]);

            return $visit;
        });
    }
}
