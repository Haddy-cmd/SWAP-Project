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
        'auto_clock_out',
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
            'auto_clock_out' => 'boolean',
        ];
    }

    /**
     * URL of the uploaded logo, or null when the office has none. Streamed through the
     * API (OfficeLogoController) so it works with a private storage bucket; ?v= changes
     * whenever a new logo is uploaded, so browsers never show a stale one.
     */
    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }

        return rtrim(config('app.url'), '/') . "/api/offices/{$this->id}/logo?v=" . substr(md5($this->logo_path), 0, 8);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function activeAssignments(): HasMany
    {
        return $this->hasMany(Assignment::class)->where('status', 'active');
    }

    /**
     * What still blocks new placements here (Admin → Offices "Still needs"): a supervisor, a map
     * pin (clock-in checks it) and a clock-in area (geofence on with a radius). Uses a loaded
     * supervisors_count when present.
     *
     * @return list<string>
     */
    public function missingSetup(): array
    {
        $supervisors = $this->supervisors_count ?? $this->supervisors()->count();

        return array_values(array_filter([
            $supervisors > 0 ? null : 'supervisor',
            $this->latitude !== null && $this->longitude !== null ? null : 'location',
            $this->geofence_enabled && $this->radius_meters ? null : 'clock_in_area',
        ]));
    }

    /** Open for new placements: active and fully set up. */
    public function isReady(): bool
    {
        return $this->is_active && $this->missingSetup() === [];
    }

    /** Supervisors assigned to this office (an office needs at least one). */
    public function supervisors(): HasMany
    {
        return $this->hasMany(User::class)->where('role', 'supervisor');
    }
}
