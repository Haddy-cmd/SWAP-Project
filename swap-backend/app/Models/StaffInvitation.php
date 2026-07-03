<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffInvitation extends Model
{
    /** How long an invitation link stays usable. */
    public const EXPIRES_DAYS = 3;

    protected $fillable = [
        'email',
        'name',
        'role',
        'office_id',
        'token',
        'invited_by',
        'expires_at',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isUsable(): bool
    {
        return $this->accepted_at === null && $this->expires_at->isFuture();
    }

    /** Look an invitation up by the plain token from the emailed link. */
    public static function findByPlainToken(string $plainToken): ?self
    {
        return self::where('token', hash('sha256', $plainToken))->first();
    }
}
