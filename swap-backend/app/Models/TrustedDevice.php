<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrustedDevice extends Model
{
    public const DAYS = 30;

    protected $fillable = ['user_id', 'token_hash', 'user_agent', 'ip_address', 'last_used_at', 'expires_at'];

    protected $hidden = ['token_hash'];

    protected $casts = [
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];
}
