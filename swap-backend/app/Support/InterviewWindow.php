<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * The scheduling rules for interview slots, in one place so the Form Request,
 * the API and the tests all agree. Every comparison is made in Asia/Manila —
 * never the server's default zone — because the rules describe office hours in
 * Marawi, not UTC.
 */
class InterviewWindow
{
    public const TIMEZONE = 'Asia/Manila';

    public const MODE_IN_PERSON = 'in_person';
    public const MODE_ONLINE = 'online';

    /** Face-to-face: weekdays only, 7:00 AM – 5:00 PM. */
    private const IN_PERSON_START_MINUTE = 7 * 60;
    private const IN_PERSON_END_MINUTE = 17 * 60;

    /** Online: any day, 8:00 AM – 11:00 PM. */
    private const ONLINE_START_MINUTE = 8 * 60;
    private const ONLINE_END_MINUTE = 23 * 60;

    /** Opening minute of the allowed window, as minutes past midnight. */
    public static function startMinute(string $mode): int
    {
        return $mode === self::MODE_ONLINE ? self::ONLINE_START_MINUTE : self::IN_PERSON_START_MINUTE;
    }

    /** Closing minute of the allowed window — an interview must END by this time. */
    public static function endMinute(string $mode): int
    {
        return $mode === self::MODE_ONLINE ? self::ONLINE_END_MINUTE : self::IN_PERSON_END_MINUTE;
    }

    /** Face-to-face runs Monday–Friday; online runs any day of the week. */
    public static function allowsWeekends(string $mode): bool
    {
        return $mode === self::MODE_ONLINE;
    }

    public static function windowLabel(string $mode): string
    {
        return $mode === self::MODE_ONLINE
            ? '8:00 AM and 11:00 PM'
            : '7:00 AM and 5:00 PM';
    }

    /** "now" in Manila, so past-slot checks are made against local office time. */
    public static function now(): Carbon
    {
        return Carbon::now(self::TIMEZONE);
    }

    /**
     * Every reason the slot is not schedulable, as user-facing messages.
     * An empty array means the slot is valid.
     */
    public static function violations(Carbon $start, string $mode, int $durationMinutes): array
    {
        $start = $start->copy()->setTimezone(self::TIMEZONE);
        $errors = [];

        if ($start->lessThanOrEqualTo(self::now())) {
            $errors[] = 'The interview cannot be scheduled in the past. Pick a later date or time.';
        }

        if (!self::allowsWeekends($mode) && $start->isWeekend()) {
            $errors[] = 'Face-to-face interviews run Monday to Friday only. Pick a weekday, or switch to Online.';
        }

        $startMinute = $start->hour * 60 + $start->minute;
        $endMinute = $startMinute + $durationMinutes;

        if ($startMinute < self::startMinute($mode) || $endMinute > self::endMinute($mode)) {
            $label = self::windowLabel($mode);
            $kind = $mode === self::MODE_ONLINE ? 'Online' : 'Face-to-face';
            $errors[] = "{$kind} interviews must start and end between {$label}.";
        }

        return $errors;
    }
}
