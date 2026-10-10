<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A photo or document sent with an announcement (stored on the documents disk). */
class AnnouncementAttachment extends Model
{
    protected $fillable = ['announcement_id', 'file_name', 'file_path', 'mime_type', 'file_size', 'is_image', 'position'];

    protected function casts(): array
    {
        return ['file_size' => 'integer', 'is_image' => 'boolean', 'position' => 'integer'];
    }

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(Announcement::class);
    }

    /** Path under the API base (NEXT_PUBLIC_API_URL) to open it at; add ?token= for <img> / new tabs. */
    public function url(): string
    {
        return "/announcements/{$this->announcement_id}/attachments/{$this->id}";
    }

    /** What the portal copy and the API carry about the file. */
    public function summary(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->file_name,
            'mime' => $this->mime_type,
            'size' => $this->file_size,
            'is_image' => $this->is_image,
            'url' => $this->url(),
        ];
    }
}
