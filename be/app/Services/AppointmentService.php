<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Patient;
use App\Models\Service;
use App\Models\User;
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
     * Cancel an appointment.
     */
    public function cancelAppointment(
        Appointment $appointment,
        ?string $reason = null,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): Appointment {
        return DB::transaction(function () use (
            $appointment,
            $reason,
            $actor,
            $ipAddress,
            $userAgent
        ) {
            $oldValues = $appointment->toArray();

            $appointment->status = 'CANCELLED';

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
}
