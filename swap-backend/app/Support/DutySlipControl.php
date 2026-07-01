<?php

namespace App\Support;

/**
 * Generates and verifies the duty-slip Control No. Kept bit-for-bit identical to
 * the frontend generator (recipient duty-slip page) so the admin can recompute a
 * pasted control number and confirm a printed slip is legit.
 *
 * Format:  SWAP-{STUDENTID}-{YYYY?}{SEM}-{RANGE}-{CHECKSUM}
 *   STUDENTID  student id, non-alphanumerics stripped, uppercased
 *   YY+YY      last two digits of each academic year (2024-2025 -> 2425)
 *   SEM        S1 | S2 | SM
 *   RANGE      SEM  |  W + YYYYMMDD (Monday of the week)
 *   CHECKSUM   6-char base36 djb2 hash of "sid|ay|sem|range"
 */
class DutySlipControl
{
    /** djb2, computed mod 2^32 to match the JS `((h<<5)+h+c) >>> 0`. */
    private static function djb2(string $s): int
    {
        $h = 5381;
        $len = strlen($s);
        for ($i = 0; $i < $len; $i++) {
            $h = ((($h << 5) + $h) + ord($s[$i])) & 0xFFFFFFFF;
        }
        return $h;
    }

    public static function checksum(string $sid, string $ay, string $sem, string $range): string
    {
        $h = self::djb2("{$sid}|{$ay}|{$sem}|{$range}");
        $b36 = strtoupper(base_convert((string) $h, 10, 36));
        return substr(str_pad($b36, 6, '0', STR_PAD_LEFT), -6);
    }

    /**
     * Parse a control number into its parts and whether the checksum is valid.
     * Returns null when the string is malformed.
     *
     * @return array{sid:string,ay:string,sem:string,range:string,checksum:string,valid:bool}|null
     */
    public static function parse(string $controlNo): ?array
    {
        $parts = explode('-', strtoupper(trim($controlNo)));
        if (count($parts) !== 5 || $parts[0] !== 'SWAP') {
            return null;
        }
        [, $sid, $aysem, $range, $checksum] = $parts;

        if (!preg_match('/^(\d{4})(S1|S2|SM)$/', $aysem, $m)) {
            return null;
        }
        $ay = $m[1];
        $sem = $m[2];

        return [
            'sid' => $sid,
            'ay' => $ay,
            'sem' => $sem,
            'range' => $range,
            'checksum' => $checksum,
            'valid' => self::checksum($sid, $ay, $sem, $range) === $checksum,
        ];
    }
}
