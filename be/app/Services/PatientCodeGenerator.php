<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class PatientCodeGenerator
{
    /**
     * Generate a unique patient code with prefix 'BN'.
     * Format: BNxxxxxx (e.g., BN000001, BN000002)
     * Concurrency-safe: scans highest existing numeric suffix and increments in a collision-check loop.
     */
    public function generate(): string
    {
        $allCodes = DB::table('patients')
            ->pluck('patient_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:BN|PAT-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'BN'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('patients')->where('patient_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
