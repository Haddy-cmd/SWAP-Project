<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Whether an upload recorded in the database is still on the documents disk. A file
 * can be on record and gone — e.g. saved on the server's own disk, which the free
 * hosting plan wipes on every restart, before uploads moved to R2.
 */
final class StoredFile
{
    /** true = gone, false = there (or nothing on record), null = storage couldn't be asked (logged). */
    public static function missing(?string $path): ?bool
    {
        if (!$path) {
            return false;
        }

        try {
            return !Storage::disk(config('filesystems.documents_disk', 'public'))->exists($path);
        } catch (\Throwable $e) {
            Log::warning('Stored file check failed', ['path' => $path, 'error' => $e->getMessage()]);

            return null;
        }
    }
}
