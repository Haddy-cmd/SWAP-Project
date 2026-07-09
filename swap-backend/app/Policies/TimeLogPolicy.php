<?php

namespace App\Policies;

use App\Models\TimeLog;
use App\Models\User;

class TimeLogPolicy
{
    /**
     * Who may view a clock-in selfie: the recipient it belongs to, their
     * supervisor (incl. same-office co-supervisors), or an admin.
     */
    public function viewPhoto(User $viewer, TimeLog $log): bool
    {
        return $viewer->id === $log->user_id
            || $viewer->role === 'admin'
            || $viewer->supervises($log->user_id);
    }
}
