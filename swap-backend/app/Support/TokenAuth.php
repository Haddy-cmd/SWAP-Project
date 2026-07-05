<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Resolves the authenticated user for routes that live outside the auth:sanctum
 * middleware because they must work as plain <img src> / new-tab URLs: the token
 * arrives either as a Bearer header or a ?token= query parameter.
 *
 * Returning the USER (not just validating the token) is the point — callers must
 * run a real authorization check (policy) against it, never treat "has a valid
 * token" as "may access the resource".
 */
class TokenAuth
{
    public static function userFromRequest(Request $request): ?User
    {
        $plainTextToken = $request->bearerToken() ?? $request->query('token');

        if (!$plainTextToken) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($plainTextToken);

        if (!$accessToken || ($accessToken->expires_at && $accessToken->expires_at->isPast())) {
            return null;
        }

        // morphTo respects SoftDeletes: a deleted user's token resolves to null,
        // so deactivated/deleted accounts lose file access immediately.
        $user = $accessToken->tokenable;

        return $user instanceof User ? $user : null;
    }
}
