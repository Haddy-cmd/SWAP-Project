<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Frontend;
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

    /** Resend the verification link. Always replies success so account existence isn't leaked. */
    public function resend(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $request->email)->first();
        if ($user && !$user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return response()->json([
            'message' => 'If your account still needs verification, a new link has been sent to your email.',
        ]);
    }
}
