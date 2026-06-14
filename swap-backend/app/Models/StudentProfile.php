<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'student_id_number',
        'first_name',
        'middle_name',
        'last_name',
        'date_of_birth',
        'gender',
        'contact_number',
        'address',
        'college',
        'program',
        'year_level',
        'gpa',
        'photo_url',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'gpa' => 'decimal:2',
            'year_level' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getFullNameAttribute(): string
    {
        $parts = array_filter([$this->first_name, $this->middle_name, $this->last_name]);

        return implode(' ', $parts);
    }
}
