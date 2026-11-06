<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\OneTimeCode;
use App\Models\PendingRegistration;
use App\Models\StudentProfile;
use App\Models\User;
use App\Notifications\OneTimeCodeNotification;
use App\Support\PrivacyNotice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Student sign-up in two steps: the form is held (30 minutes, encrypted, password hashed) and a
 * 6-digit code is emailed; only the right code creates the account — verified and active.
 * Codes follow OneTimeCodeService's rules (10 minutes, 5 tries, one a minute).
 */
class RegistrationService
{
    public const MSG_SENT = 'We sent a 6-digit code to your email. Enter it to create your account.';
    public const MSG_GONE = 'This sign-up has expired. Please fill in the form again.';
    public const MSG_EMAIL_TAKEN = 'This email is already registered.';
    public const MSG_ID_TAKEN = 'This student ID is already registered.';

    private static function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /** Hold the validated form and email a code. Filling the form again replaces an earlier hold. */
    public function start(array $data): PendingRegistration
    {
        PendingRegistration::where('expires_at', '<', now())->delete();
        PendingRegistration::where('email', $data['email'])->delete();

        $data['password'] = Hash::make($data['password']);
        unset($data['password_confirmation'], $data['privacy_consent']);
        // Consent is given now, on the form; the code only confirms the email.
        $data['privacy_accepted_at'] = now()->toIso8601String();
        $data['privacy_version'] = PrivacyNotice::VERSION;

        $pending = PendingRegistration::create([
            'email' => $data['email'],
            'student_id_number' => $data['student_id_number'],
            'payload' => $data,
            'expires_at' => now()->addMinutes(PendingRegistration::HOLD_MINUTES),
        ]);
        $this->sendCode($pending);

        return $pending;
    }

    /** A live hold for this email, or null. */
    public function find(string $email): ?PendingRegistration
    {
        return PendingRegistration::where('email', strtolower(trim($email)))->where('expires_at', '>', now())->first();
    }

    public function sendCode(PendingRegistration $pending): void
    {
        if ($pending->last_sent_at && $pending->last_sent_at->gt(now()->subSeconds(OneTimeCodeService::RESEND_SECONDS))) {
            throw ValidationException::withMessages(['code' => [OneTimeCodeService::MSG_WAIT]]);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $pending->forceFill([
            'code_hash' => self::hash($code), 'attempts' => 0,
            'code_expires_at' => now()->addMinutes(OneTimeCodeService::MINUTES), 'last_sent_at' => now(),
        ])->save();

        try {
            Notification::route('mail', $pending->email)
                ->notify(new OneTimeCodeNotification($code, OneTimeCode::VERIFY_EMAIL, OneTimeCodeService::MINUTES, $pending->payload['first_name'] ?? null));
        } catch (\Throwable $e) {
            report($e);
            $pending->forceFill(['last_sent_at' => null, 'code_hash' => null])->save();
            throw ValidationException::withMessages(['code' => [OneTimeCodeService::MSG_SEND_FAILED]]);
        }
    }

    /** The right code creates the account (verified, active) and ends the hold. */
    public function confirm(string $email, string $code): User
    {
        $pending = $this->find($email);
        $fail = fn (string $m, string $key = 'code') => throw ValidationException::withMessages([$key => [$m]]);
        if (!$pending) {
            $fail(self::MSG_GONE);
        }
        if (!$pending->code_hash || $pending->attempts >= OneTimeCodeService::MAX_ATTEMPTS) {
            $fail($pending->code_hash ? OneTimeCodeService::MSG_TOO_MANY : OneTimeCodeService::MSG_EXPIRED);
        }
        if ($pending->code_expires_at?->isPast()) {
            $fail(OneTimeCodeService::MSG_EXPIRED);
        }
        if (!hash_equals($pending->code_hash, self::hash(preg_replace('/\D/', '', $code)))) {
            $pending->increment('attempts');
            $fail($pending->attempts >= OneTimeCodeService::MAX_ATTEMPTS ? OneTimeCodeService::MSG_TOO_MANY : OneTimeCodeService::MSG_WRONG);
        }

        $d = $pending->payload;

        return DB::transaction(function () use ($pending, $d, $fail) {
            // Someone may have taken the email or student ID since the form was sent.
            if (User::where('email', $d['email'])->exists()) {
                $pending->delete();
                $fail(self::MSG_EMAIL_TAKEN, 'email');
            }
            if (StudentProfile::where('student_id_number', $d['student_id_number'])->exists()) {
                $pending->delete();
                $fail(self::MSG_ID_TAKEN, 'student_id_number');
            }

            $user = new User();
            $user->forceFill([
                'name' => $d['name'], 'email' => $d['email'], 'role' => 'applicant',
                'is_active' => true, 'email_verified_at' => now(),
                // Null only for a sign-up held before the notice existed.
                'privacy_accepted_at' => $d['privacy_accepted_at'] ?? null, 'privacy_version' => $d['privacy_version'] ?? null,
            ]);
            // Already hashed when the form was held (the `hashed` cast leaves a hash as it is).
            $user->setRawAttributes(array_merge($user->getAttributes(), ['password' => $d['password']]));
            $user->save();

            $user->profile()->create(array_intersect_key($d, array_flip([
                'student_id_number', 'first_name', 'middle_name', 'last_name', 'contact_number', 'college', 'program', 'year_level',
            ])));
            $pending->delete();
            AuditLog::record('created', $user, null, null, $user->id);

            return $user;
        });
    }
}
