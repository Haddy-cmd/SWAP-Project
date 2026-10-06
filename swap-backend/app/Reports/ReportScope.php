<?php

namespace App\Reports;

use App\Models\User;

/**
 * Who is asking and for which term. Every dataset narrows its rows through this:
 * an admin sees the program, a supervisor only the students visibleToSupervisor()
 * gives them, a recipient only their own records.
 */
final class ReportScope
{
    public function __construct(
        public readonly User $user,
        public readonly ?string $academicYear = null,
        public readonly ?string $semester = null,
    ) {}

    public function isSupervisor(): bool
    {
        return $this->user->role === 'supervisor';
    }

    public function hasTerm(): bool
    {
        return $this->academicYear !== null && $this->semester !== null;
    }

    public function termLabel(): ?string
    {
        return $this->hasTerm() ? "{$this->semester} {$this->academicYear}" : null;
    }
}
