<?php

namespace App\Providers;

use App\Events\ApplicationApproved;
use App\Events\ApplicationRejected;
use App\Events\ApplicationSubmitted;
use App\Events\HoursRejected;
use App\Events\HoursVerified;
use App\Events\InterviewScheduled;
use App\Events\StipendReleased;
use App\Listeners\SendApplicationApprovedNotification;
use App\Listeners\SendApplicationRejectedNotification;
use App\Listeners\SendApplicationSubmittedNotification;
use App\Listeners\SendHoursRejectedNotification;
use App\Listeners\SendHoursVerifiedNotification;
use App\Listeners\SendInterviewScheduledNotification;
use App\Listeners\SendStipendReleasedNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        ApplicationSubmitted::class => [
            SendApplicationSubmittedNotification::class,
        ],
        ApplicationApproved::class => [
            SendApplicationApprovedNotification::class,
        ],
        ApplicationRejected::class => [
            SendApplicationRejectedNotification::class,
        ],
        InterviewScheduled::class => [
            SendInterviewScheduledNotification::class,
        ],
        HoursVerified::class => [
            SendHoursVerifiedNotification::class,
        ],
        HoursRejected::class => [
            SendHoursRejectedNotification::class,
        ],
        StipendReleased::class => [
            SendStipendReleasedNotification::class,
        ],
    ];
}
