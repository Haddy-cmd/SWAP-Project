<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Who may view a user's profile photo: the user themselves, their supervisor
     * (including co-supervisors of the hosting office), or an admin.
     */
    public function viewAvatar(User $viewer, User $subject): bool
    {
        return $viewer->id === $subject->id
            || $viewer->role === 'admin'
            || $viewer->supervises($subject->id);
    }
}
