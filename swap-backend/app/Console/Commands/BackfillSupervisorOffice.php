<?php

namespace App\Console\Commands;

use App\Models\Assignment;
use App\Models\User;
use Illuminate\Console\Command;

class BackfillSupervisorOffice extends Command
{
    protected $signature = 'supervisors:backfill-office
        {--dry-run : Show what would change without saving}
        {--force : Also re-derive office_id for already-linked supervisors when unambiguous}';

    protected $description = 'Set each supervisor\'s office_id from their active assignments when unambiguous; report conflicts.';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        $assigned = 0;
        $ambiguous = [];
        $skipped = 0;

        foreach (User::where('role', 'supervisor')->get() as $supervisor) {
            if ($supervisor->office_id !== null && !$force) {
                $skipped++;
                continue; // already linked — don't override without --force
            }

            $officeIds = Assignment::where('supervisor_id', $supervisor->id)
                ->where('status', 'active')
                ->whereNotNull('office_id')
                ->distinct()
                ->pluck('office_id');

            if ($officeIds->count() === 1) {
                $officeId = (int) $officeIds->first();
                if ($supervisor->office_id === $officeId) {
                    $skipped++;
                    continue; // already correct
                }
                $from = $supervisor->office_id === null ? 'none' : "#{$supervisor->office_id}";
                $this->line("→ {$supervisor->name}: {$from} → office #{$officeId}");
                if (!$dry) {
                    $supervisor->update(['office_id' => $officeId]);
                }
                $assigned++;
            } elseif ($officeIds->count() > 1) {
                $ambiguous[] = "{$supervisor->name} (supervises offices: " . $officeIds->implode(', ') . ')';
            }
        }

        $this->info(($dry ? '[dry-run] ' : '') . "Linked {$assigned} supervisor(s); {$skipped} already linked.");

        if ($ambiguous) {
            $this->warn('Ambiguous (resolve manually on the Offices page — a supervisor must belong to ONE office):');
            foreach ($ambiguous as $line) {
                $this->warn("  • {$line}");
            }
        }

        return self::SUCCESS;
    }
}
