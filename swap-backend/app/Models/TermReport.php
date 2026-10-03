<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The recipient's end-of-term narrative report — one per assignment, required for payout.
 * The supervisor accepts it and marks the student eligible or not for renewal
 * (TermReportReviewService; review columns are set with forceFill, never by the student).
 */
class TermReport extends Model
{
    protected $fillable = [
        'assignment_id',
        'user_id',
        'content',
        'accomplishments',
        'challenges',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'renewal_eligible' => 'boolean',
        ];
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
