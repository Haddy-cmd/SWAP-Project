<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationDocument extends Model
{
    use HasFactory;

    /**
     * Applications imported from the DSA's lists have no uploaded files: their documents point at a
     * "not submitted" placeholder bundled in resources/placeholders (served by DocumentFileController).
     */
    public const PLACEHOLDER_PREFIX = 'placeholder/';
    public const PLACEHOLDER_PDF = 'placeholder/no-document.pdf';
    public const PLACEHOLDER_PHOTO = 'placeholder/no-photo.png';

    protected $fillable = [
        'application_id',
        'document_type',
        'file_path',
        'file_url',
        'file_name',
        'file_size',
        'mime_type',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
