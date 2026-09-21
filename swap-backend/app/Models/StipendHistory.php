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

    // Claim lifecycle. 'released' is the legacy one-shot status kept read-only for
    // rows created before the claim workflow existed (see the 2026_09_21 migration).
    public const STATUS_PENDING = 'pending';
    public const STATUS_CERTIFIED = 'certified';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_VOID = 'void';

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
        ];
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
