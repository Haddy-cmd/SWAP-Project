<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Setting;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Resources\UserResource;
use App\Support\StipendUnlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly UserRepositoryInterface $userRepository) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        // Student registration is tied to the application period — block new
        // signups while applications are closed. (Login stays open.)
        if (!Setting::bool('applications_open', false)) {
            return response()->json([
                'message' => Setting::get('applications_closed_message', 'The application period has not started yet. Please check back later.'),
            ], 403);
        }

        // Created inactive/unverified — the account is only activated once the
        // applicant clicks the email verification link (so an unconfirmed signup
        // never shows as an active applicant to the admins).
        //
        // User and profile go in one transaction: a half-written signup used to
        // leave a committed user row behind, and the applicant's retry then hit
        // "email has already been taken" against their own failed attempt.
        $user = DB::transaction(function () use ($request) {
            $user = $this->userRepository->create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => $request->password,
                'role' => 'applicant',
                'is_active' => false,
            ]);

            $user->profile()->create([
                'student_id_number' => $request->student_id_number,
                'first_name' => $request->first_name,
                'middle_name' => $request->middle_name,
                'last_name' => $request->last_name,
                'contact_number' => $request->contact_number,
                'college' => $request->college,
                'program' => $request->program,
                'year_level' => $request->year_level,
            ]);

            return $user;
        });

        // Prove the applicant owns the email before they can sign in: send a
        // verification link and withhold sign-in (no token) until they confirm.
        // A mail outage must not fail the request — the account is already valid
        // and the applicant can use "Resend verification email".
        $verificationSent = true;

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            $verificationSent = false;
            Log::error('Verification email failed to send', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'message' => $verificationSent
                ? 'Registration successful. Please check your email for a verification link before signing in.'
                : 'Account created, but the verification email could not be sent. Use "Resend verification email" below.',
            'verification_required' => true,
            'verification_email_sent' => $verificationSent,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        /** @var User $user */
        $user = Auth::user();

        // Verification is checked first: an unconfirmed new account is inactive,
        // and we want to prompt them to verify rather than say "deactivated".
        if (!$user->hasVerifiedEmail()) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => ['Please verify your email first. Check your inbox for the verification link, or resend it below.'],
            ]);
        }

        if (!$user->is_active) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated. Please contact the DSA Office.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => new UserResource($user->load('profile')),
            'token' => $token,
            'message' => 'Login successful.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        if ($token && ! $token instanceof \Laravel\Sanctum\TransientToken) {
            $token->delete();
        }

        // Signing out also closes an open Stipend Management step-up window.
        StipendUnlock::revoke($request->user());

        return response()->json(['message' => 'Logged out successfully.']);
    }
}
