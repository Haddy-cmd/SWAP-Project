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

    /**
     * Same circle as the photo — the owner, an admin, or a supervising supervisor —
     * plus one addition: a recipient may see the specimen of the supervisor on their
     * own active assignment, because that ink prints on the recipient's own duty slip
     * (and already reaches them on their claim stub). Nobody else's.
     */
    public function viewSignature(User $viewer, User $subject): bool
    {
        return $this->viewAvatar($viewer, $subject)
            || $viewer->isSupervisedBy($subject->id);
    }
}
