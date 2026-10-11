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
    public const MSG_SENT = 'If an account uses this email, we sent a code to it.';

    public function __construct(private readonly OneTimeCodeService $codes) {}

    /** Always the same reply, so the form doesn't reveal which emails have accounts. */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', strtolower(trim((string) $request->email)))->first();
        if ($user) {
            try {
                $this->codes->issue($user, OneTimeCode::PASSWORD_RESET);
            } catch (\Throwable $e) {
                Log::info('Password reset code not sent', ['user_id' => $user->id, 'reason' => $e->getMessage()]);
            }
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

        $user = User::where('email', strtolower(trim((string) $request->email)))->first();
        if (!$user) {
            throw ValidationException::withMessages(['code' => [OneTimeCodeService::MSG_WRONG]]);
        }
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
