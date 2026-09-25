<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'require_clock_in_selfie',
        'office_id',
        'avatar_path',
        'signature_image_path',
        'position_title',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'require_clock_in_selfie' => 'boolean',
        ];
    }

    public function profile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    /** The office this supervisor is assigned to (supervisors only). */
    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    public function assignment(): HasOne
    {
        return $this->hasOne(Assignment::class);
    }

    /**
     * Streamed profile-photo URL (the client appends the auth token). The ?v=
     * hash busts the browser cache whenever a new photo is uploaded. Reusable
     * anywhere a user is exposed, not just the full UserResource.
     */
    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar_path
            ? rtrim(config('app.url'), '/') . '/api/users/' . $this->id . '/avatar?v=' . substr(md5($this->avatar_path), 0, 8)
            : null;
    }

    /**
     * Whether this user, as a supervisor, manages the given student — either as
     * the assigned supervisor or as a co-supervisor of the hosting office (the
     * same reach used across the supervisor surface via visibleToSupervisor).
     */
    public function supervises(int $studentUserId): bool
    {
        if ($this->role !== 'supervisor') {
            return false;
        }

        return Assignment::where('user_id', $studentUserId)
            ->visibleToSupervisor($this)
            ->exists();
    }

    /**
     * Whether this user, as a recipient, is supervised by the given user on their
     * active assignment (the supervisor of record — not office co-supervisors).
     */
    public function isSupervisedBy(int $supervisorUserId): bool
    {
        if ($this->role !== 'recipient') {
            return false;
        }

        return Assignment::where('user_id', $this->id)
            ->where('status', 'active')
            ->where('supervisor_id', $supervisorUserId)
            ->exists();
    }

    /**
     * Streamed signature specimen URL (the client appends the auth token), or null
     * when none is on file. The ?v= hash changes with each new specimen so the
     * browser cache busts. Single definition for every payload that exposes it.
     */
    public function signatureUrl(): ?string
    {
        return $this->signature_image_path
            ? rtrim(config('app.url'), '/') . '/api/users/' . $this->id . '/signature?v=' . substr(md5($this->signature_image_path), 0, 8)
            : null;
    }

    public function timeLogs(): HasMany
    {
        return $this->hasMany(TimeLog::class);
    }

    public function notifications(): MorphMany
    {
        return $this->morphMany(Notification::class, 'notifiable')
            ->latest();
    }

    public function stipendHistory(): HasMany
    {
        return $this->hasMany(StipendHistory::class);
    }

    public function concerns(): HasMany
    {
        return $this->hasMany(Concern::class);
    }

    public function tokens(): MorphMany
    {
        return $this->morphMany(PersonalAccessToken::class, 'tokenable');
    }

    public function createToken(string $name): object
    {
        $token = bin2hex(random_bytes(32));
        $this->tokens()->create([
            'name' => $name,
            'token' => hash('sha256', $token),
        ]);
        return (object) ['plainTextToken' => $token];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isRecipient(): bool
    {
        return $this->role === 'recipient';
    }

    public function isSupervisor(): bool
    {
        return $this->role === 'supervisor';
    }

    public function isApplicant(): bool
    {
        return $this->role === 'applicant';
    }
}
