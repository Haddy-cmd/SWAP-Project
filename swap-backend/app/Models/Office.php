<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Office extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
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
