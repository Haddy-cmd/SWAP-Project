<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\OneTimeCode;
use App\Models\User;
use App\Services\OneTimeCodeService;
use App\Support\PasswordPolicy;
use App\Support\StipendUnlock;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Forgot password → a 6-digit code by email → a new password. */
class PasswordResetController extends Controller
{
    public const MSG_SENT = 'We sent a 6-digit code to your email.';

    public const MSG_NO_ACCOUNT = "We couldn't find an active account with this email. Please check that it's typed correctly.";

    public function __construct(private readonly OneTimeCodeService $codes) {}

    /** The active account for this email, or a 422 that says there isn't one (user-chosen over hiding it). */
    private function activeUser(Request $request): User
    {
        $user = User::where('email', strtolower(trim((string) $request->email)))->first();
        if (!$user || !$user->is_active) {
            throw ValidationException::withMessages(['email' => [self::MSG_NO_ACCOUNT]]);
        }

        return $user;
    }

    /**
     * Email a reset code. An unknown or inactive email is told so (the route's 3-a-minute
     * throttle limits probing); a cooldown or a mail outage is reported as it is.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        $user = $this->activeUser($request);

        try {
            $this->codes->issue($user, OneTimeCode::PASSWORD_RESET);
        } catch (ValidationException $e) {
            throw ValidationException::withMessages(['email' => $e->errors()['code'] ?? [OneTimeCodeService::MSG_SEND_FAILED]]);
        }

        return response()->json(['message' => self::MSG_SENT]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'max:12'],
            'password' => ['required', 'confirmed', PasswordPolicy::rule()],
        ], PasswordPolicy::messages());

        $user = $this->activeUser($request);
        $this->codes->verify($user, OneTimeCode::PASSWORD_RESET, (string) $request->code);

        $user->forceFill(['password' => $request->password, 'remember_token' => Str::random(60)])->save();
        // A new password ends every session, every trusted browser and any stipend step-up window.
        $user->tokens()->delete();
        OneTimeCodeService::forgetDevices($user);
        StipendUnlock::revoke($user);
        event(new PasswordReset($user));
        AuditLog::record('password_changed', $user, null, ['via' => 'reset_code'], $user->id);

        return response()->json(['message' => 'Your password has been reset. You can sign in now.']);
    }
}
