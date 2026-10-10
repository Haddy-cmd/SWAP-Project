<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\DeviceName;
use Illuminate\Validation\ValidationException;

/** Profile → Security → "Where you're signed in": the account's live logins, and signing them out. */
class SessionService
{
    /** The token behind this request (null for test/transient auth). */
    public function currentId(User $user): ?int
    {
        $current = $user->currentAccessToken();

        return $current && isset($current->id) ? (int) $current->id : null;
    }

    public function list(User $user): array
    {
        $currentId = $this->currentId($user);

        return $user->tokens()
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->get()
            ->sortByDesc(fn (PersonalAccessToken $t) => [$t->id === $currentId, ($t->last_used_at ?? $t->created_at)?->timestamp])
            ->map(function (PersonalAccessToken $t) use ($currentId) {
                $device = DeviceName::from($t->user_agent);

                return [
                    'id' => $t->id,
                    'device' => $device['label'],
                    'kind' => $device['kind'],
                    'ip_address' => $t->ip_address,
                    'last_used_at' => $t->last_used_at?->toISOString(),
                    'created_at' => $t->created_at?->toISOString(),
                    'current' => $t->id === $currentId,
                ];
            })->values()->all();
    }

    public function revoke(User $user, int $tokenId): void
    {
        $token = $user->tokens()->whereKey($tokenId)->firstOrFail();
        if ($token->id === $this->currentId($user)) {
            throw ValidationException::withMessages(['session' => ['Use Sign out to end this session.']]);
        }

        $device = DeviceName::from($token->user_agent)['label'];
        $token->delete();
        AuditLog::record('session_revoked', $user, null, ['device' => $device]);
    }

    /** Signs out every other login; returns how many ended. */
    public function revokeOthers(User $user): int
    {
        $currentId = $this->currentId($user);
        $count = $user->tokens()->when($currentId, fn ($q) => $q->whereKeyNot($currentId))->delete();
        if ($count > 0) {
            AuditLog::record('sessions_revoked', $user, null, ['count' => $count]);
        }

        return $count;
    }
}
