<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\TestingService;
use App\Support\TestTools;
use Illuminate\Console\Command;

/**
 * Ends System Testing where SWAP_TEST_TOOLS turns it off (live or local): every account still
 * in testing is restored to how it was when picked and leaves testing. start.sh runs this on
 * every boot, so setting SWAP_TEST_TOOLS=false resets testing on the next deploy (locally, run it
 * after changing .env). Does nothing while System Testing is on.
 */
class ShutdownTesting extends Command
{
    protected $signature = 'testing:shutdown';

    protected $description = 'Where SWAP_TEST_TOOLS is off: restore every System Testing account';

    public function handle(TestingService $testing): int
    {
        if (TestTools::enabled()) {
            $this->line('System Testing is on (SWAP_TEST_TOOLS); nothing to do.');

            return self::SUCCESS;
        }

        if (!User::whereNotNull('testing_added_at')->exists()) {
            $this->line('System Testing is off and no account is in testing.');

            return self::SUCCESS;
        }

        $restored = $testing->releaseAll(null);
        $this->info("System Testing is off. Accounts restored and released: {$restored}.");

        return self::SUCCESS;
    }
}
