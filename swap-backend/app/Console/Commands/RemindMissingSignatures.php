<?php

namespace App\Console\Commands;

use App\Jobs\SendApplicationNotificationJob;
use App\Models\User;
use App\Notifications\SignatureRequiredNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RemindMissingSignatures extends Command
{
    protected $signature = 'remind:missing-signatures';

    protected $description = 'Nudge active recipients without a signature specimen (in-app + email). Skips anyone already holding an unread reminder so ignored accounts are not spammed weekly.';

    public function handle(): int
    {
        $targets = User::where('role', 'recipient')
            ->where('is_active', true)
            ->whereNull('signature_image_path')
            ->cursor();

        $reminded = 0;
        $skipped = 0;

        foreach ($targets as $user) {
            $alreadyNudged = $user->notifications()
                ->whereNull('read_at')
                ->where('type', SignatureRequiredNotification::class)
                ->exists();

            if ($alreadyNudged) {
                $skipped++;
                continue;
            }

            try {
                SendApplicationNotificationJob::dispatch('signature_required', ['user_id' => $user->id])
                    ->onQueue('notifications');
                $reminded++;
            } catch (\Throwable $e) {
                Log::warning('Signature reminder dispatch failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        $this->info("Reminded {$reminded} recipient(s), skipped {$skipped} already holding an unread reminder.");

        return self::SUCCESS;
    }
}
