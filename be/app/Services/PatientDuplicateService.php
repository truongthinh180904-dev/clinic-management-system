<?php

namespace App\Services;

use App\Models\Patient;

class PatientDuplicateService
{
    /**
     * Check for potential duplicates based on:
     * 1. Phone number match
     * 2. Full name + Date of birth match
     *
     * @param  array<string, mixed>  $data
     * @return array<int, array<string, mixed>>
     */
    public function checkDuplicates(array $data, ?int $excludePatientId = null): array
    {
        $warnings = [];

        $phone = isset($data['phone']) ? trim((string) $data['phone']) : '';
        $fullName = isset($data['full_name']) ? trim((string) $data['full_name']) : '';
        $dob = ! empty($data['date_of_birth']) ? date('Y-m-d', strtotime((string) $data['date_of_birth'])) : null;

        // 1. Phone number duplicate check
        if ($phone !== '') {
            $matchingPhonesQuery = Patient::query()->where('phone', $phone);
            if ($excludePatientId !== null) {
                $matchingPhonesQuery->where('id', '!=', $excludePatientId);
            }
            $phoneMatches = $matchingPhonesQuery->get(['id', 'patient_code', 'full_name', 'phone', 'date_of_birth']);

            if ($phoneMatches->isNotEmpty()) {
                $warnings[] = [
                    'type' => 'phone',
                    'field' => 'phone',
                    'message' => "Số điện thoại '{$phone}' đã tồn tại ở {$phoneMatches->count()} hồ sơ bệnh nhân khác trong hệ thống.",
                    'matched_patients' => $phoneMatches->map(fn ($p) => [
                        'id' => $p->id,
                        'patient_code' => $p->patient_code,
                        'full_name' => $p->full_name,
                        'phone' => $p->phone,
                        'date_of_birth' => $p->date_of_birth?->format('Y-m-d'),
                    ])->values()->all(),
                ];
            }
        }

        // 2. Full name + Date of birth duplicate check
        if ($fullName !== '' && $dob !== null) {
            $matchingIdentityQuery = Patient::query()
                ->whereRaw('LOWER(TRIM(full_name)) = ?', [mb_strtolower($fullName, 'UTF-8')])
                ->whereDate('date_of_birth', $dob);

            if ($excludePatientId !== null) {
                $matchingIdentityQuery->where('id', '!=', $excludePatientId);
            }
            $identityMatches = $matchingIdentityQuery->get(['id', 'patient_code', 'full_name', 'phone', 'date_of_birth']);

            if ($identityMatches->isNotEmpty()) {
                $warnings[] = [
                    'type' => 'name_and_dob',
                    'field' => 'full_name',
                    'message' => "Họ tên '{$fullName}' và ngày sinh '{$dob}' trùng với {$identityMatches->count()} hồ sơ bệnh nhân khác.",
                    'matched_patients' => $identityMatches->map(fn ($p) => [
                        'id' => $p->id,
                        'patient_code' => $p->patient_code,
                        'full_name' => $p->full_name,
                        'phone' => $p->phone,
                        'date_of_birth' => $p->date_of_birth?->format('Y-m-d'),
                    ])->values()->all(),
                ];
            }
        }

        return $warnings;
    }
}
