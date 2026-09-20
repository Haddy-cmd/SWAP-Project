<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Office extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'logo_path',
        'description',
        'head_name',
        'location',
        'max_recipients',
        'is_active',
        'latitude',
        'longitude',
        'radius_meters',
        'geofence_enabled',
        'qr_code',
        'qr_secret',
    ];

    protected $hidden = [
        'qr_secret',
    ];

    /** Serialized alongside the office so lists can render the logo directly. */
    protected $appends = [
        'logo_url',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'max_recipients' => 'integer',
            'latitude' => 'decimal:8',
            'longitude' => 'decimal:8',
            'radius_meters' => 'integer',
            'geofence_enabled' => 'boolean',
        ];
    }

    /** Public URL of the uploaded logo, or null when the office has none. */
    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }

        return Storage::disk(config('filesystems.documents_disk', 'public'))->url($this->logo_path);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function activeAssignments(): HasMany
    {
        return $this->hasMany(Assignment::class)->where('status', 'active');
    }

    /** Supervisors assigned to this office (an office needs at least one). */
    public function supervisors(): HasMany
    {
        return $this->hasMany(User::class)->where('role', 'supervisor');
    }
}
