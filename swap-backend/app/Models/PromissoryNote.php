<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromissoryNote extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'assignment_id',
        'user_id',
        'academic_year',
        'semester',
        'verified_hours_snapshot',
        'lacking_hours',
        'file_path',
        'file_name',
        'mime_type',
        'file_size',
        'reason',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_remarks',
        'makeup_deadline',
    ];

    // file_path stays internal; clients use the signed file_url instead.
    protected $hidden = [
        'file_path',
    ];

    protected function casts(): array
    {
        return [
            'verified_hours_snapshot' => 'decimal:2',
            'lacking_hours' => 'decimal:2',
            'file_size' => 'integer',
            'reviewed_at' => 'datetime',
            'makeup_deadline' => 'date',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }
}
