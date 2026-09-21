<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StipendSignature extends Model
{
    use HasFactory;

    // Certification is co-signed by the supervisor (SWAP Mentor, attested via the
    // hours they verified) and the admin (DSA). Receipt is signed by the
    // beneficiary and the external releasing officer.
    public const ROLE_SUPERVISOR = 'supervisor';
    public const ROLE_DIRECTOR = 'director';
    public const ROLE_BENEFICIARY = 'beneficiary';
    public const ROLE_RELEASING_OFFICER = 'releasing_officer';

    public const METHOD_AUTHENTICATED = 'authenticated';
    public const METHOD_DRAWN = 'drawn';

    protected $fillable = [
        'stipend_history_id',
        'signatory_role',
        'user_id',
        'printed_name',
        'method',
        'signature_image_path',
        'signed_at',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'signed_at' => 'datetime',
        ];
    }

    public function stipend(): BelongsTo
    {
        return $this->belongsTo(StipendHistory::class, 'stipend_history_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
