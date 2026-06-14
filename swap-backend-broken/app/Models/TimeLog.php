<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TimeLog extends Model
{
    use HasFactory;

    /**
     * duration_hours is GENERATED ALWAYS AS STORED — never include in fillable.
     */
    protected $fillable = [
        'assignment_id',
        'user_id',
        'date',
        'time_in',
        'time_out',
        'status',
        'verified_by',
        'verified_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'time_in' => 'datetime',
            'time_out' => 'datetime',
            'verified_at' => 'datetime',
            'duration_hours' => 'decimal:2',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function narrativeReport(): HasOne
    {
        return $this->hasOne(NarrativeReport::class);
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(Verification::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function hasNarrative(): bool
    {
        return $this->narrativeReport()->exists();
    }
}
