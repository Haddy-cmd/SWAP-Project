<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\OneTimeCode;
use App\Models\User;
use App\Services\OneTimeCodeService;
use App\Support\Frontend;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    /**
     * Confirm ownership of the email. The link in the verification email is a
     * signed URL (validated by the 'signed' middleware); we match the hash to the
     * user's email, mark it verified, then bounce to the frontend login.
     */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::find($id);

        if (!$user || !hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return redirect(Frontend::url('/login?verify_error=1'));
        }

        if (!$user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            // Verifying activates a pending applicant account.
            if (!$user->is_active) {
                $user->forceFill(['is_active' => true])->save();
            }
        }

        return redirect(Frontend::url('/login?verified=1'));
    }

    /**
     * Verify by the emailed 6-digit code. An unknown or already-verified address gets the same
     * "isn't right" answer as a wrong code, so the form doesn't reveal which emails are registered.
     */
    public function verifyCode(Request $request, OneTimeCodeService $codes): JsonResponse
    {
        $request->validate(['email' => ['required', 'email'], 'code' => ['required', 'string', 'max:12']]);

        $user = User::where('email', strtolower(trim((string) $request->email)))->first();
        if (!$user || $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages(['code' => [OneTimeCodeService::MSG_WRONG]]);
        }

        $codes->verify($user, OneTimeCode::VERIFY_EMAIL, (string) $request->code);
        $user->markEmailAsVerified();
        // Verifying activates a pending applicant account.
        if (!$user->is_active) {
            $user->forceFill(['is_active' => true])->save();
        }

        return response()->json(['verified' => true, 'message' => 'Email verified. You can sign in now.']);
    }

    /** Send a new verification code. Always replies the same so account existence isn't leaked. */
    public function resend(Request $request, OneTimeCodeService $codes): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        // A mail failure (or the once-a-minute limit) must not surface either: only accounts that
        // exist reach the send, so an error here would reveal the address is registered.
        $user = User::where('email', strtolower(trim((string) $request->email)))->first();
        if ($user && !$user->hasVerifiedEmail()) {
            try {
                $codes->issue($user, OneTimeCode::VERIFY_EMAIL);
            } catch (\Throwable $e) {
                Log::info('Verification code not resent', ['user_id' => $user->id, 'reason' => $e->getMessage()]);
            }
        }

        return response()->json([
            'message' => 'If your account still needs verification, a new code has been sent to your email.',
        ]);
    }
}
