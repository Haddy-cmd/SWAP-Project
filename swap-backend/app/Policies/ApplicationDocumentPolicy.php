<?php

namespace App\Policies;

use App\Models\ApplicationDocument;
use App\Models\User;

class ApplicationDocumentPolicy
{
    /**
     * Who may view an uploaded application document (COR, grades, letter of
     * intent, ID photo): the applicant who owns it, their supervisor (including
     * co-supervisors of the hosting office), or an admin.
     */
    public function view(User $viewer, ApplicationDocument $document): bool
    {
        $ownerId = $document->application?->user_id;

        if ($ownerId === null) {
            return false;
        }

        return $viewer->id === $ownerId
            || $viewer->role === 'admin'
            || $viewer->supervises($ownerId);
    }
}
