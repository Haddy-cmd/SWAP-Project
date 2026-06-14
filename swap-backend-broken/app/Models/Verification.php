<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Verification extends Model
{
    use HasFactory;

    protected $fillable = [
        'time_log_id',
        'verified_by',
        'action',
        'feedback',
    ];

    public function timeLog(): BelongsTo
    {
        return $this->belongsTo(TimeLog::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
