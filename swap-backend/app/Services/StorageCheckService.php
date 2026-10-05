<?php

namespace App\Services;

use App\Models\User;
use App\Support\StoredFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Admin → System Testing → File storage. Says where uploads go, whether that storage
 * really accepts and returns a file, whether image links point at this server, and
 * which accounts' signatures/photos are on record but gone — the reasons a signature
 * shows as a broken image on live.
 */
class StorageCheckService
{
    public const MAX_FILE_CHECKS = 300;

    public const MSG_EPHEMERAL = 'Files are saved on the server itself, which the free hosting plan wipes on every restart. Set DOCUMENTS_DISK=r2 (with the R2 keys) in the Render environment.';

    /** @param string $requestHost the host this request arrived on (what the browser can reach) */
    public function run(string $requestHost): array
    {
        return [
            'disk' => $this->disk(),
            'probe' => $this->probe(),
            'links' => $this->links($requestHost),
            'missing' => $this->missing(),
        ];
    }

    private function disk(): array
    {
        $name = config('filesystems.documents_disk', 'public');
        $driver = config("filesystems.disks.{$name}.driver");
        $durable = $driver === 's3';

        return [
            'name' => $name,
            'driver' => $driver,
            'durable' => $durable,
            'warning' => !$durable && app()->environment('production') ? self::MSG_EPHEMERAL : null,
        ];
    }

    /** Write, read back and delete a small file; the first failing step is reported with the storage's own error. */
    private function probe(): array
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $path = 'storage-check/probe-' . Str::uuid() . '.txt';
        $content = 'SWAP storage check ' . now()->toIso8601String();
        $step = 'write';

        try {
            if ($disk->put($path, $content) === false) {
                return ['ok' => false, 'step' => $step, 'error' => 'The storage refused the file (check the keys and the bucket name).'];
            }
            $step = 'read';
            if ($disk->get($path) !== $content) {
                return ['ok' => false, 'step' => $step, 'error' => 'The file read back is not the one written.'];
            }
            $step = 'delete';
            $disk->delete($path);

            return ['ok' => true, 'step' => null, 'error' => null];
        } catch (\Throwable $e) {
            $root = $e;
            while ($root->getPrevious()) {
                $root = $root->getPrevious();
            }

            return ['ok' => false, 'step' => $step, 'error' => Str::limit($root->getMessage(), 300)];
        }
    }

    /**
     * Signature and photo links are built from APP_URL. Behind the host's proxy the
     * scheme this app sees is http, so only the host is compared; https is checked
     * on APP_URL itself.
     */
    private function links(string $requestHost): array
    {
        $appUrl = rtrim((string) config('app.url'), '/');
        $appHost = parse_url($appUrl, PHP_URL_HOST);
        $warning = match (true) {
            $appHost !== $requestHost => "Image links point to {$appUrl}, but this server is {$requestHost}. Set APP_URL on Render to https://{$requestHost}.",
            app()->environment('production') && !str_starts_with($appUrl, 'https://') => "APP_URL is {$appUrl}. Use https://{$requestHost}, or browsers block the images on the https site.",
            default => null,
        };

        return ['app_url' => $appUrl, 'request_host' => $requestHost, 'warning' => $warning];
    }

    /** Accounts whose signature or photo is on record but not in storage. */
    private function missing(): array
    {
        $users = User::query()
            ->where(fn ($q) => $q->whereNotNull('signature_image_path')->orWhereNotNull('avatar_path'))
            ->orderBy('id')
            ->get(['id', 'name', 'email', 'role', 'signature_image_path', 'avatar_path']);

        $total = $users->sum(fn (User $u) => ($u->signature_image_path ? 1 : 0) + ($u->avatar_path ? 1 : 0));
        $checked = 0;
        $unchecked = 0;
        $files = [];

        foreach ($users as $user) {
            foreach (['signature' => $user->signature_image_path, 'photo' => $user->avatar_path] as $kind => $path) {
                if (!$path || $checked >= self::MAX_FILE_CHECKS) {
                    continue;
                }
                $checked++;
                $gone = StoredFile::missing($path);
                if ($gone === null) {
                    $unchecked++;
                } elseif ($gone) {
                    $files[] = ['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'file' => $kind];
                }
            }
        }

        return ['checked' => $checked, 'total' => $total, 'unchecked' => $unchecked, 'files' => $files];
    }
}
