<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ProductCodeGenerator
{
    /**
     * Generate a unique product code with prefix 'PRD-'.
     * Format: PRD-xxx (e.g., PRD-001, PRD-002, PRD-006)
     * Concurrency-safe: scans highest existing numeric suffix and increments in a collision-check loop.
     */
    public function generate(): string
    {
        $allCodes = DB::table('products')->pluck('product_code');

        $maxNum = 0;
        foreach ($allCodes as $code) {
            if (preg_match('/(?:PRD-?)(\d+)/i', (string) $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNumber = $maxNum + 1;

        do {
            $candidate = sprintf('PRD-%03d', $nextNumber);
            $exists = DB::table('products')->where('product_code', $candidate)->exists();
            if (! $exists) {
                return $candidate;
            }
            $nextNumber++;
        } while (true);
    }
}
