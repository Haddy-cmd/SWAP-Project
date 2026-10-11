<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

/** A sign-up waiting for its emailed code (RegistrationService); pruned once expired. */
class PendingRegistration extends Model
{
    use Prunable;

    public const HOLD_MINUTES = 30;

    protected $fillable = ['email', 'student_id_number', 'payload', 'code_hash', 'attempts', 'code_expires_at', 'last_sent_at', 'expires_at'];

    protected $hidden = ['payload', 'code_hash'];

    protected $casts = [
        'payload' => 'encrypted:array',
        'attempts' => 'integer',
        'code_expires_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function prunable(): Builder
    {
        return static::where('expires_at', '<', now());
    }
}
