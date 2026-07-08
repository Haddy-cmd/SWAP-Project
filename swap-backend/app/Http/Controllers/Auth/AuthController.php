<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Setting;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

        $user = $this->userRepository->create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password,
            'role' => 'applicant',
            'is_active' => true,
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

        // Prove the applicant owns the email before they can sign in: send a
        // verification link and withhold sign-in (no token) until they confirm.
        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Registration successful. Please check your email for a verification link before signing in.',
            'verification_required' => true,
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

        if (!$user->is_active) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated. Please contact the DSA Office.'],
            ]);
        }

        if (!$user->hasVerifiedEmail()) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => ['Please verify your email first. Check your inbox for the verification link, or resend it below.'],
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

        return response()->json(['message' => 'Logged out successfully.']);
    }
}
