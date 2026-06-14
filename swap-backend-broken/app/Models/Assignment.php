<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'office_id',
        'supervisor_id',
        'academic_year',
        'semester',
        'required_hours',
        'start_date',
        'end_date',
        'status',
        'qr_code',
        'qr_secret',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'required_hours' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function timeLogs(): HasMany
    {
        return $this->hasMany(TimeLog::class);
    }

    public function getRenderedHoursAttribute(): float
    {
        return (float) $this->timeLogs()
            ->whereNotNull('time_out')
            ->sum('duration_hours');
    }

    public function getVerifiedHoursAttribute(): float
    {
        return (float) $this->timeLogs()
            ->where('status', 'verified')
            ->sum('duration_hours');
    }

    public function getRemainingHoursAttribute(): float
    {
        return max(0, $this->required_hours - $this->verified_hours);
    }
}
