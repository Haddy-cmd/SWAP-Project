<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A supervisor's end-of-term evaluation of one placement (TermEvaluationService). */
class TermEvaluation extends Model
{
    /** 1 Poor … 5 Excellent; this rating or higher passes. */
    public const PASSING_RATING = 3;

    public const RATING_LABELS = [1 => 'Poor', 2 => 'Fair', 3 => 'Satisfactory', 4 => 'Very good', 5 => 'Excellent'];

    protected $fillable = [
        'assignment_id',
        'evaluator_id',
        'rating',
        'remarks',
        'passed',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'passed' => 'boolean',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    public function toPayload(): array
    {
        return [
            'rating' => $this->rating,
            'rating_label' => self::RATING_LABELS[$this->rating] ?? null,
            'remarks' => $this->remarks,
            'passed' => $this->passed,
            'evaluator' => $this->evaluator?->name,
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
