<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SemesterReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'assignment_id',
        'academic_year',
        'semester',
        'required_hours',
        'verified_hours',
        'rendered_hours',
        'rejected_hours',
        'total_days_present',
        'final_status',
    ];

    protected function casts(): array
    {
        return [
            'required_hours' => 'decimal:2',
            'verified_hours' => 'decimal:2',
            'rendered_hours' => 'decimal:2',
            'rejected_hours' => 'decimal:2',
            'completion_rate' => 'decimal:2',
            'total_days_present' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
