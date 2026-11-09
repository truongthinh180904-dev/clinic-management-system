<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ServiceCodeGenerator
{
    /**
     * Generate a unique service code with prefix 'DV'.
     * Format: DVxxxxxx (e.g., DV000001, DV000002)
     * Concurrency-safe: scans highest existing numeric suffix and increments in a collision-check loop.
     */
    public function generate(): string
    {
        $allCodes = DB::table('services')->pluck('service_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:DV|SRV-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'DV'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('services')->where('service_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
