<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\ServicePackage;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PatientPackageService
{
    /**
     * Assign a service package to a patient.
     *
     * @param  array{
     *     purchase_date?: string|null,
     *     expiry_date?: string|null,
     *     price?: float|int|null,
     *     total_sessions?: int|null,
     *     status?: string|null,
     * }  $data
     */
    public function assignPackage(
        Patient $patient,
        ServicePackage $package,
        array $data = [],
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): PatientPackage {
        if ($patient->status !== 'ACTIVE') {
            throw new InvalidArgumentException('Chỉ có thể cấp gói dịch vụ cho bệnh nhân đang ở trạng thái hoạt động (ACTIVE).');
        }

        if ($package->status !== 'ACTIVE') {
            throw new InvalidArgumentException('Gói dịch vụ không ở trạng thái hoạt động (ACTIVE), không thể cấp cho bệnh nhân.');
        }

        $purchaseDate = ! empty($data['purchase_date'])
            ? Carbon::parse($data['purchase_date'])->toDateString()
            : now()->toDateString();

        $validityDays = (int) $package->validity_days;
        $expiryDate = ! empty($data['expiry_date'])
            ? Carbon::parse($data['expiry_date'])->toDateString()
            : Carbon::parse($purchaseDate)->addDays($validityDays)->toDateString();

        $totalSessions = isset($data['total_sessions']) && (int) $data['total_sessions'] > 0
            ? (int) $data['total_sessions']
            : (int) $package->total_sessions;

        $usedSessions = 0;
        $remainingSessions = $totalSessions;

        // Invariant: price at the moment of assignment is locked
        $price = isset($data['price']) && is_numeric($data['price'])
            ? (float) $data['price']
            : (float) $package->price;

        $status = $data['status'] ?? 'ACTIVE';

        $patientPackage = DB::transaction(function () use (
            $patient,
            $package,
            $purchaseDate,
            $expiryDate,
            $totalSessions,
            $usedSessions,
            $remainingSessions,
            $price,
            $status
        ) {
            return PatientPackage::create([
                'patient_id' => $patient->id,
                'package_id' => $package->id,
                'purchase_date' => $purchaseDate,
                'expiry_date' => $expiryDate,
                'total_sessions' => $totalSessions,
                'used_sessions' => $usedSessions,
                'remaining_sessions' => $remainingSessions,
                'price' => $price,
                'status' => $status,
            ]);
        });

        AuditLog::create([
            'user_id' => $actor?->id,
            'module' => 'service_packages',
            'action' => 'assign_package',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
            'old_values' => null,
            'new_values' => $patientPackage->toArray(),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);

        return $patientPackage;
    }

    /**
     * Update status of a patient package.
     */
    public function updateStatus(
        PatientPackage $patientPackage,
        string $newStatus,
        ?User $actor = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): PatientPackage {
        $oldValues = $patientPackage->toArray();

        $patientPackage->status = $newStatus;
        $patientPackage->save();

        AuditLog::create([
            'user_id' => $actor?->id,
            'module' => 'service_packages',
            'action' => 'update_patient_package_status',
            'table_name' => 'patient_packages',
            'record_id' => (string) $patientPackage->id,
            'old_values' => $oldValues,
            'new_values' => $patientPackage->toArray(),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);

        return $patientPackage;
    }
}
