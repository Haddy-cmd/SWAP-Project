<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StipendHistory extends Model
{
    use HasFactory;

    protected $table = 'stipend_history';

    // Lifecycle (2026-10-05): a release is final → `released`, or `void` with a reason.
    // Legacy, read-only: `pending`/`certified` (claim stubs awaiting the Banking Office,
    // migrated to released) and `claimed` (paid at the Banking Office before the change).
    public const STATUS_RELEASED = 'released';
    public const STATUS_PENDING = 'pending';
    public const STATUS_CERTIFIED = 'certified';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_VOID = 'void';

    /** Statuses that count as paid / live for the period (the one-live-per-period index). */
    public const LIVE_STATUSES = [self::STATUS_PENDING, self::STATUS_CERTIFIED, self::STATUS_CLAIMED, self::STATUS_RELEASED];

    protected $fillable = [
        'user_id',
        'amount',
        'academic_year',
        'semester',
        'period_label',
        'status',
        'control_number',
        'claim_token',
        'certified_by',
        'certified_at',
        'released_by',
        'released_at',
        'claimed_at',
        'receipt_signed_at',
        'releasing_officer_name',
        'slip_path',
        'voided_at',
        'void_reason',
        'remarks',
        // Set when the release went through an approved promissory note: the note,
        // the term's shortfall and the makeup it promised (printed on the stub).
        'via_promissory',
        'promissory_note_id',
        'required_hours',
        'deficient_hours',
        'lacking_hours',
        'makeup_deadline',
    ];

    // claim_token is a bearer-like secret; slip_path is an internal storage detail.
    protected $hidden = [
        'claim_token',
        'slip_path',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'certified_at' => 'datetime',
            'released_at' => 'datetime',
            'claimed_at' => 'datetime',
            'receipt_signed_at' => 'datetime',
            'voided_at' => 'datetime',
            'via_promissory' => 'boolean',
            'required_hours' => 'decimal:2',
            'deficient_hours' => 'decimal:2',
            'lacking_hours' => 'decimal:2',
            'makeup_deadline' => 'date',
        ];
    }

    public function promissoryNote(): BelongsTo
    {
        return $this->belongsTo(PromissoryNote::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public function certifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'certified_by');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(StipendSignature::class);
    }

    public function isCertified(): bool
    {
        return $this->status === self::STATUS_CERTIFIED;
    }

    public function isClaimed(): bool
    {
        return $this->status === self::STATUS_CLAIMED;
    }
}
