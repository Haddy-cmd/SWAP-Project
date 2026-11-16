<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\OneTimeCode;
use App\Models\Setting;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Services\OneTimeCodeService;
use App\Services\RegistrationService;
use App\Resources\UserResource;
use App\Support\StipendUnlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
        private readonly OneTimeCodeService $codes,
        private readonly RegistrationService $registrations,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        // Student registration is tied to the application period — block new
        // signups while applications are closed. (Login stays open.)
        if (!Setting::bool('applications_open', false)) {
            return response()->json([
                'message' => Setting::get('applications_closed_message', 'The application period has not started yet. Please check back later.'),
            ], 403);
        }

        // Nothing is created yet: the form is held and a code is emailed. The account only
        // exists once the code is confirmed (registerVerify), and then it's signed in.
        $pending = $this->registrations->start($request->validated());

        return response()->json([
            'pending' => true,
            'email' => $pending->email,
            'message' => RegistrationService::MSG_SENT,
        ], 202);
    }

    /** Step two of sign-up: the right code creates the account and signs it in (no sign-in code). */
    public function registerVerify(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email'], 'code' => ['required', 'string', 'max:12']]);
        $user = $this->registrations->confirm((string) $request->email, (string) $request->code);
        $token = $user->createToken('auth_token', $request)->plainTextToken;

        return response()->json([
            'data' => new UserResource($user->load(['profile', 'office:id,name'])),
            'token' => $token,
            'message' => 'Welcome to SWAP! Your account is ready.',
        ], 201);
    }

    /** A new sign-up code (once a minute) while the form is still held. */
    public function registerResend(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        $pending = $this->registrations->find((string) $request->email);
        if (!$pending) {
            throw ValidationException::withMessages(['code' => [RegistrationService::MSG_GONE]]);
        }
        $this->registrations->sendCode($pending);

        return response()->json(['message' => 'We sent a new code.']);
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
                'email' => ['Please verify your email first. Enter the code we emailed you, or ask for a new one.'],
            ]);
        }

        if (!$user->is_active) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated. Please contact the DSA Office.'],
            ]);
        }

        // Second step: an emailed code, unless the switch is off or this browser is trusted.
        if (OneTimeCodeService::loginCodeRequired() && !$this->codes->isTrusted($user, $request->input('device_token'))) {
            Auth::logout();
            // Signing in again within the minute reuses the code that was just emailed.
            if ($this->codes->cooldown($user, OneTimeCode::LOGIN) === 0) {
                $this->codes->issue($user, OneTimeCode::LOGIN);
            }
            $challenge = Str::random(40);
            Cache::put(self::CHALLENGE . hash('sha256', $challenge), $user->id, now()->addMinutes(OneTimeCodeService::MINUTES));

            return response()->json([
                'otp_required' => true,
                'challenge' => $challenge,
                'email_hint' => self::maskEmail($user->email),
                'message' => 'We sent a 6-digit code to your email.',
            ]);
        }

        return $this->signedIn($user, $request);
    }

    private const CHALLENGE = 'login_otp:';

    /** The sign-in waiting for its code, or a 422 when it expired. */
    private function challengeUser(Request $request): User
    {
        $request->validate(['challenge' => ['required', 'string', 'max:100']]);
        $id = Cache::get(self::CHALLENGE . hash('sha256', (string) $request->input('challenge')));
        $user = $id ? User::find($id) : null;
        if (!$user || !$user->is_active || !$user->hasVerifiedEmail()) {
            throw ValidationException::withMessages(['code' => ['This sign-in has expired. Enter your password again.']]);
        }

        return $user;
    }

    /** Step two: the emailed code (and optionally "trust this browser for 30 days"). */
    public function verifyLogin(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'max:12'], 'trust_device' => ['sometimes', 'boolean']]);
        $user = $this->challengeUser($request);
        $this->codes->verify($user, OneTimeCode::LOGIN, (string) $request->input('code'));
        Cache::forget(self::CHALLENGE . hash('sha256', (string) $request->input('challenge')));

        $deviceToken = $request->boolean('trust_device') ? $this->codes->trust($user, $request) : null;

        return $this->signedIn($user, $request, $deviceToken);
    }

    /** Step two: email a fresh code (once a minute). */
    public function resendLogin(Request $request): JsonResponse
    {
        $user = $this->challengeUser($request);
        $this->codes->issue($user, OneTimeCode::LOGIN);

        return response()->json(['message' => 'We sent a new code.']);
    }

    private function signedIn(User $user, Request $request, ?string $deviceToken = null): JsonResponse
    {
        $token = $user->createToken('auth_token', $request)->plainTextToken;

        return response()->json(array_filter([
            'data' => new UserResource($user->load(['profile', 'office:id,name'])),
            'token' => $token,
            'device_token' => $deviceToken,
            'message' => 'Login successful.',
        ], fn ($v) => $v !== null));
    }

    /** "n***@s.msumain.edu.ph" */
    public static function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($local, 0, 1) . str_repeat('*', max(2, min(6, mb_strlen($local) - 1))) . '@' . $domain;
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
