<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class EmployeeCodeGenerator
{
    /**
     * Generate a unique employee code with prefix 'NV'.
     * Format: NVxxxxxx (e.g., NV000001, NV000002)
     */
    public function generate(): string
    {
        $allNvCodes = DB::table('employees')
            ->where('employee_code', 'LIKE', 'NV%')
            ->pluck('employee_code');

        $maxNum = 0;
        foreach ($allNvCodes as $code) {
            if (preg_match('/^NV(\d+)$/', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = 'NV'.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
            $exists = DB::table('employees')->where('employee_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
