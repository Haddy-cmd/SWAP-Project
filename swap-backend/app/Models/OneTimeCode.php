<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OneTimeCode extends Model
{
    public const VERIFY_EMAIL = 'verify_email';
    public const LOGIN = 'login';
    public const PASSWORD_RESET = 'password_reset';

    protected $fillable = ['user_id', 'purpose', 'code_hash', 'attempts', 'expires_at', 'consumed_at'];

    protected $hidden = ['code_hash'];

    protected $casts = [
        'expires_at' => 'datetime',
        'consumed_at' => 'datetime',
        'attempts' => 'integer',
    ];
}
