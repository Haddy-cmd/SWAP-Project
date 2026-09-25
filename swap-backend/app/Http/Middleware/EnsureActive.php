<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Refuses deactivated accounts on every authenticated route. Login already
 * blocks them, but a token issued before deactivation would otherwise keep
 * working — deactivation revokes tokens too, this is the backstop.
 */
class EnsureActive
{
    /** Same wording as the login refusal (AuthController::login). */
    public const MESSAGE = 'Your account has been deactivated. Please contact the DSA Office.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && !$user->is_active) {
            return response()->json(['message' => self::MESSAGE], 403);
        }

        return $next($request);
    }
}
