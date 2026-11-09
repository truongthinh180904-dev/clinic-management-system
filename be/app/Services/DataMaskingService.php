<?php

namespace App\Services;

use App\Models\User;

class DataMaskingService
{
    /**
     * Mask a phone number to standard format like 0912***456.
     * Preserves leading 4 digits and trailing 3 digits for standard 10-digit VN numbers.
     */
    public static function maskPhone(?string $phone): ?string
    {
        if ($phone === null || trim($phone) === '') {
            return $phone;
        }

        $trimmed = trim($phone);
        $len = strlen($trimmed);

        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        if ($len >= 10) {
            // Standard 10-digit: keep first 4, mask middle 3, keep last 3 -> 0912***456
            return substr($trimmed, 0, 4).'***'.substr($trimmed, -3);
        }

        if ($len >= 7) {
            // 7 to 9 digits: keep first 3, mask middle, keep last 2-3
            $tail = min(3, max(2, $len - 6));

            return substr($trimmed, 0, 3).'***'.substr($trimmed, -$tail);
        }

        return substr($trimmed, 0, 2).'***'.substr($trimmed, -1);
    }

    /**
     * Mask a citizen identity number (CCCD/CMND).
     * CCCD is 12 digits, CMND is 9 digits.
     * e.g. 001200123456 -> 0012*****456 (or 0012***456)
     */
    public static function maskIdentity(?string $identity): ?string
    {
        if ($identity === null || trim($identity) === '') {
            return $identity;
        }

        $trimmed = trim($identity);
        $len = strlen($trimmed);

        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        if ($len >= 12) {
            // 12-digit CCCD: keep first 4, mask middle 5, keep last 3
            return substr($trimmed, 0, 4).'*****'.substr($trimmed, -3);
        }

        if ($len >= 9) {
            // 9-digit CMND: keep first 3, mask 3, keep last 3
            return substr($trimmed, 0, 3).'***'.substr($trimmed, -3);
        }

        return substr($trimmed, 0, 2).'***'.substr($trimmed, -2);
    }

    /**
     * In-memory cache for resolved masking bypass permissions per User object instance.
     *
     * @var \WeakMap<User, bool>|null
     */
    protected static ?\WeakMap $bypassCache = null;

    /**
     * Determine if a user has authority to bypass data masking.
     * Roles with direct administrative authority: ADMIN, MANAGER.
     * Permissions: patients.mask_bypass, patients.update (receptionists/managers updating patients).
     */
    public static function canBypassMasking(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        self::$bypassCache ??= new \WeakMap;
        if (isset(self::$bypassCache[$user])) {
            return self::$bypassCache[$user];
        }

        $canBypass = $user->hasRole('ADMIN')
            || $user->hasRole('MANAGER')
            || $user->hasPermission('patients.mask_bypass')
            || $user->hasPermission('patients.update');

        self::$bypassCache[$user] = $canBypass;

        return $canBypass;
    }
}
