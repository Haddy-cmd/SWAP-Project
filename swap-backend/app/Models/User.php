<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'office_id',
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
