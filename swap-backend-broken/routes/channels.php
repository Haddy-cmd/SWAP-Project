<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{id}', function (User $user, int $id) {
    return $user->id === $id;
});

Broadcast::channel('supervisor.{id}', function (User $user, int $id) {
    return $user->isSupervisor() && $user->id === $id;
});
