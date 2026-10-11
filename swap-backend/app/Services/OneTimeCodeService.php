<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\OneTimeCode;
use App\Models\Setting;
use App\Models\TrustedDevice;
use App\Models\User;
use App\Notifications\OneTimeCodeNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Emailed 6-digit codes for verifying an email, signing in and resetting a password, plus the
 * "trust this browser" tokens that let a sign-in skip the code for 30 days.
 * Codes: 10 minutes, 5 tries, a new one at most once a minute; only an HMAC is stored.
 */
class OneTimeCodeService
{
    public const MINUTES = 10;
    public const MAX_ATTEMPTS = 5;
    public const RESEND_SECONDS = 60;

    public const MSG_WAIT = 'Wait a minute before asking for another code.';
    public const MSG_WRONG = "That code isn't right.";
    public const MSG_EXPIRED = 'This code has expired. Ask for a new one.';
    public const MSG_TOO_MANY = 'Too many tries. Ask for a new code.';
    public const MSG_SEND_FAILED = "We couldn't send the code right now. Try again in a moment.";

    /** The admin's switch on System Testing (Setting); absent = on. */
    public const SETTING = 'login_otp_enabled';

    public const MSG_SERVER_OFF = "It's turned off on the server (LOGIN_OTP). Change it on Render.";

    /** Sign-in asks for a code: the server allows it (LOGIN_OTP) and the page switch is on. */
    public static function loginCodeRequired(): bool
    {
        return (bool) config('auth.login_otp') && Setting::bool(self::SETTING, true);
    }

    /** @return array{required: bool, server_off: bool, page_on: bool} */
    public static function loginCodeState(): array
    {
        $pageOn = Setting::bool(self::SETTING, true);
        $serverOff = !config('auth.login_otp');

        return ['required' => !$serverOff && $pageOn, 'server_off' => $serverOff, 'page_on' => $pageOn];
    }

    private static function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /** Seconds until another code may be sent while an unused one is still out (0 = now). */
    public function cooldown(User $user, string $purpose): int
    {
        $last = OneTimeCode::where('user_id', $user->id)->where('purpose', $purpose)->whereNull('consumed_at')
            ->latest('id')->value('created_at');

        return $last ? max(0, self::RESEND_SECONDS - (int) now()->diffInSeconds($last, true)) : 0;
    }

    /**
     * Create and email a fresh code (older unused ones stop working). Throws MSG_WAIT within the
     * cooldown, and MSG_SEND_FAILED when the mailer is down (the code is then discarded).
     */
    public function issue(User $user, string $purpose): void
    {
        if ($this->cooldown($user, $purpose) > 0) {
            throw ValidationException::withMessages(['code' => [self::MSG_WAIT]]);
        }

        OneTimeCode::where('user_id', $user->id)->where('purpose', $purpose)->whereNull('consumed_at')->delete();
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $row = OneTimeCode::create([
            'user_id' => $user->id, 'purpose' => $purpose, 'code_hash' => self::hash($code),
            'expires_at' => now()->addMinutes(self::MINUTES),
        ]);

        try {
            $user->notify(new OneTimeCodeNotification($code, $purpose, self::MINUTES));
        } catch (\Throwable $e) {
            $row->delete();
            report($e);
            throw ValidationException::withMessages(['code' => [self::MSG_SEND_FAILED]]);
        }

        AuditLog::record('otp_sent', $user, null, ['purpose' => $purpose], $user->id);
    }

    /** Check (and use up) the latest code; throws with the reason when it doesn't pass. */
    public function verify(User $user, string $purpose, string $code): void
    {
        $row = OneTimeCode::where('user_id', $user->id)->where('purpose', $purpose)->whereNull('consumed_at')->latest('id')->first();
        $fail = fn (string $m) => throw ValidationException::withMessages(['code' => [$m]]);

        if (!$row || $row->attempts >= self::MAX_ATTEMPTS) {
            $fail($row ? self::MSG_TOO_MANY : self::MSG_EXPIRED);
        }
        if ($row->expires_at->isPast()) {
            $fail(self::MSG_EXPIRED);
        }
        if (!hash_equals($row->code_hash, self::hash(preg_replace('/\D/', '', $code)))) {
            $row->increment('attempts');
            if ($row->attempts >= self::MAX_ATTEMPTS) {
                AuditLog::record('otp_failed_max', $user, null, ['purpose' => $purpose], $user->id);
                $fail(self::MSG_TOO_MANY);
            }
            $fail(self::MSG_WRONG);
        }

        $row->forceFill(['consumed_at' => now()])->save();
    }

    // ── Trusted browsers ────────────────────────────────────────────────────

    /** Remember this browser for 30 days; returns the raw token (shown once). */
    public function trust(User $user, Request $request): string
    {
        $token = Str::random(64);
        TrustedDevice::create([
            'user_id' => $user->id, 'token_hash' => hash('sha256', $token),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000) ?: null, 'ip_address' => $request->ip(),
            'last_used_at' => now(), 'expires_at' => now()->addDays(TrustedDevice::DAYS),
        ]);
        AuditLog::record('trusted_device_added', $user, null, ['device' => \App\Support\DeviceName::from($request->userAgent())['label']], $user->id);

        return $token;
    }

    /** Whether this browser's token is a live trust for this user (and touch it). */
    public function isTrusted(User $user, ?string $token): bool
    {
        if (!$token) {
            return false;
        }
        $device = TrustedDevice::where('user_id', $user->id)->where('token_hash', hash('sha256', $token))
            ->where('expires_at', '>', now())->first();
        $device?->forceFill(['last_used_at' => now()])->save();

        return (bool) $device;
    }

    /** Password changed / reset, other devices signed out, or account deactivated: every browser asks again. */
    public static function forgetDevices(User $user): void
    {
        TrustedDevice::where('user_id', $user->id)->delete();
    }
}
