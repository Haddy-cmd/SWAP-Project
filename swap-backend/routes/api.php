<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Shared\ChatbotController;
use App\Http\Controllers\Shared\ConcernController;
use App\Http\Controllers\Shared\AttendancePhotoController;
use App\Http\Controllers\Shared\AvatarController;
use App\Http\Controllers\Shared\OfficeLogoController;
use App\Http\Controllers\Shared\DocumentFileController;
use App\Http\Controllers\Shared\NotificationController;
use App\Http\Controllers\Shared\ProfileController;
use App\Http\Controllers\Shared\ReportController;
use App\Http\Controllers\Shared\ReportExplorerController;
use App\Http\Controllers\Shared\InvitationController;
use App\Http\Controllers\Shared\SettingController;
use App\Http\Controllers\Shared\SignatureController;
use App\Http\Controllers\Admin\PromissoryController as AdminPromissoryController;
use App\Http\Controllers\Recipient\PromissoryController as RecipientPromissoryController;
use App\Http\Controllers\Recipient\StipendClaimController;
use App\Http\Controllers\Supervisor\PromissoryController as SupervisorPromissoryController;
use App\Http\Controllers\Applicant\ApplicationController as ApplicantApplicationController;
use App\Http\Controllers\Applicant\DocumentController;
use App\Http\Controllers\Recipient\AttendanceController;
use App\Http\Controllers\Recipient\HoursController;
use App\Http\Controllers\Recipient\NarrativeController;
use App\Http\Controllers\Recipient\RenewalController;
use App\Http\Controllers\Recipient\TermReportController;
use App\Http\Controllers\Supervisor\OfficeController as SupervisorOfficeController;
use App\Http\Controllers\Supervisor\SettingsController as SupervisorSettingsController;
use App\Http\Controllers\Supervisor\StudentController;
use App\Http\Controllers\Supervisor\VerificationController;
use App\Http\Controllers\Supervisor\TermReportController as SupervisorTermReportController;
use App\Http\Controllers\Admin\ApplicationController as AdminApplicationController;
use App\Http\Controllers\Admin\AssignmentController;
use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Admin\ConcernController as AdminConcernController;
use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\LandingPhotoController;
use App\Http\Controllers\Shared\LandingPhotoController as PublicLandingPhotoController;
use App\Http\Controllers\Admin\OfficeController;
use App\Http\Controllers\Admin\SemesterPeriodController;
use App\Http\Controllers\Admin\TestingController;
use App\Http\Controllers\Admin\StorageCheckController;
use App\Http\Controllers\Admin\StipendController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
// Throttle sensitive auth endpoints to deter brute-force and email-flooding.
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:6,1');
// Email verification — the signed link in the verification email lands here.
Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware('signed')->name('verification.verify');
Route::post('/auth/resend-verification', [EmailVerificationController::class, 'resend'])->middleware('throttle:3,1');
// Public and backed by a paid LLM when GEMINI_API_KEY is set — rate-limit it.
Route::get('/chatbot/query', [ChatbotController::class, 'query'])->middleware('throttle:20,1');
Route::get('/settings/application-status', [SettingController::class, 'applicationStatus']);
// Landing page carousel (managed in Admin → Landing Page). Images are cache-forever.
Route::get('/landing/photos', [PublicLandingPhotoController::class, 'index'])->middleware('throttle:60,1');
Route::get('/landing/photos/{id}/image', [PublicLandingPhotoController::class, 'image']);
// Staff invitations — the invitee opens the emailed link to create their account.
Route::get('/invitations/{token}', [InvitationController::class, 'show'])->middleware('throttle:10,1');
Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept'])->middleware('throttle:6,1');

// Document file serving — auth is handled inside the controller (Bearer header
// OR ?token= query param) so that links opened in new browser tabs still work.
Route::get('/documents/{documentId}/file', [DocumentFileController::class, 'show']);
// Profile photo serving — same in-controller auth so it works in an <img src>.
Route::get('/users/{id}/avatar', [AvatarController::class, 'show']);
// Office logos — public, streamed from storage (works with a private R2 bucket).
Route::get('/offices/{id}/logo', [OfficeLogoController::class, 'show'])->middleware('throttle:120,1');
// Signature specimen serving — same pattern (self, admin, supervising supervisor).
Route::get('/users/{id}/signature', [SignatureController::class, 'show']);
Route::get('/attendance/{logId}/photo', [AttendancePhotoController::class, 'show']);

// ─── AUTHENTICATED ────────────────────────────────────────────────────────────
// `active` refuses deactivated accounts even if they still hold a live token.
Route::middleware(['auth:sanctum', 'active'])->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/photo', [ProfileController::class, 'updatePhoto']);
    Route::delete('/profile/photo', [ProfileController::class, 'deletePhoto']);
    Route::post('/profile/signature', [ProfileController::class, 'updateSignature']);
    Route::delete('/profile/signature', [ProfileController::class, 'deleteSignature']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->middleware('throttle:6,1');
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    // Help page: send a concern to the DSA and read the replies.
    Route::get('/concerns', [ConcernController::class, 'index']);
    Route::post('/concerns', [ConcernController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/concerns/{id}/messages', [ConcernController::class, 'reply'])->middleware('throttle:20,1');

    // ─── APPLICANT ────────────────────────────────────────────────────────────
    Route::middleware('role:applicant')->prefix('applicant')->group(function () {
        Route::get('/applications', [ApplicantApplicationController::class, 'index']);
        Route::post('/applications', [ApplicantApplicationController::class, 'store']);
        Route::get('/applications/{id}', [ApplicantApplicationController::class, 'show']);
        Route::delete('/applications/{id}', [ApplicantApplicationController::class, 'destroy']);
        Route::post('/applications/{id}/documents', [DocumentController::class, 'store']);
    });

    // ─── RECIPIENT ────────────────────────────────────────────────────────────
    Route::middleware('role:recipient')->prefix('recipient')->group(function () {
        Route::get('/assignment', [AttendanceController::class, 'assignment']);
        Route::get('/attendance/current', [AttendanceController::class, 'current']);
        Route::get('/attendance/logs', [AttendanceController::class, 'logs']);
        Route::post('/attendance/time-in-geofence', [AttendanceController::class, 'timeInGeofence']);
        Route::post('/attendance/time-out', [AttendanceController::class, 'timeOut']);
        Route::post('/attendance/auto-clock-out', [AttendanceController::class, 'autoClockOut']);
        Route::post('/narratives', [NarrativeController::class, 'store'])->withoutMiddleware('role:recipient');
        Route::get('/narratives/{logId}', [NarrativeController::class, 'show']);
        Route::get('/hours/summary', [HoursController::class, 'summary']);
        Route::get('/progress', [HoursController::class, 'progress']);
        Route::get('/assignments/history', [AttendanceController::class, 'history']);
        Route::get('/term-report', [TermReportController::class, 'show']);
        Route::put('/term-report', [TermReportController::class, 'update']);
        Route::get('/stipend/history', [ReportController::class, 'stipendHistory']);
        Route::get('/reports/{type}', [ReportExplorerController::class, 'show'])->where('type', '[a-z-]+');
        Route::get('/reports/{type}/export', [ReportExplorerController::class, 'export'])->where('type', '[a-z-]+')->middleware('throttle:20,1');
        Route::get('/stipend/{id}/slip', [StipendClaimController::class, 'slip']);
        Route::get('/promissory', [RecipientPromissoryController::class, 'index']);
        Route::post('/promissory', [RecipientPromissoryController::class, 'store']);
        Route::get('/promissory/{id}/file', [RecipientPromissoryController::class, 'file']);
        Route::get('/renewals', [RenewalController::class, 'index']);
        Route::post('/renewals', [RenewalController::class, 'store']);
    });

    // ─── SUPERVISOR ───────────────────────────────────────────────────────────
    Route::middleware('role:supervisor')->prefix('supervisor')->group(function () {
        Route::get('/office-qr', [SupervisorOfficeController::class, 'qr']);
        Route::get('/settings', [SupervisorSettingsController::class, 'show']);
        Route::put('/settings', [SupervisorSettingsController::class, 'update']);
        Route::get('/students', [StudentController::class, 'index']);
        Route::get('/students/clocked-in', [StudentController::class, 'clockedIn']);
        Route::get('/students/{id}/summary', [StudentController::class, 'summary']);
        Route::get('/students/{id}/logs', [StudentController::class, 'logs']);
        Route::get('/students/{id}/documents', [StudentController::class, 'documents']);
        Route::post('/students/{id}/manual-hours', [StudentController::class, 'addManualHours']);
        Route::put('/students/{id}/required-hours', [StudentController::class, 'updateRequiredHours']);
        Route::post('/students/{id}/required-hours/decision', [StudentController::class, 'decideRequiredHours']);
        Route::post('/students/{id}/mark-deficient', [StudentController::class, 'markDeficient']);
        Route::put('/assignments/{id}/term-report/review', [SupervisorTermReportController::class, 'review'])->whereNumber('id');
        // Analytics & Reports: insights first, so it isn't taken for a report type.
        Route::get('/reports/insights', [ReportController::class, 'supervisorInsights']);
        Route::get('/reports/periods', [ReportExplorerController::class, 'supervisorPeriods']);
        Route::get('/reports/{type}', [ReportExplorerController::class, 'show'])->where('type', '[a-z-]+');
        Route::get('/reports/{type}/export', [ReportExplorerController::class, 'export'])->where('type', '[a-z-]+')->middleware('throttle:20,1');
        Route::get('/verifications/pending', [VerificationController::class, 'pending']);
        Route::get('/verifications/reviewed', [VerificationController::class, 'reviewed']);
        Route::post('/verifications/bulk', [VerificationController::class, 'bulkVerify']);
        Route::put('/verifications/{logId}', [VerificationController::class, 'update']);
        Route::get('/promissory', [SupervisorPromissoryController::class, 'index']);
        Route::post('/promissory/{id}/review', [SupervisorPromissoryController::class, 'review']);
        Route::get('/promissory/{id}/file', [SupervisorPromissoryController::class, 'file']);
    });

    // ─── ADMIN ────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/applications', [AdminApplicationController::class, 'index']);
        Route::get('/applications/{id}', [AdminApplicationController::class, 'show']);
        Route::put('/applications/{id}/review', [AdminApplicationController::class, 'review']);
        Route::post('/applications/{id}/interview', [AdminApplicationController::class, 'interview']);
        Route::put('/applications/{id}/interview', [AdminApplicationController::class, 'rescheduleInterview']);
        Route::post('/applications/{id}/interview/no-show', [AdminApplicationController::class, 'markInterviewNoShow']);
        Route::put('/applications/{id}/decide', [AdminApplicationController::class, 'decide']);

        Route::get('/assignments', [AssignmentController::class, 'index']);
        Route::post('/assignments', [AssignmentController::class, 'store']);
        Route::put('/assignments/{id}', [AssignmentController::class, 'update']);
        Route::post('/assignments/{id}/manual-hours', [AssignmentController::class, 'addManualHours']);
        Route::post('/assignments/{id}/required-hours', [AssignmentController::class, 'requestRequiredHours']);
        Route::post('/assignments/{id}/regenerate-qr', [AssignmentController::class, 'regenerateQr']);

        Route::get('/offices', [OfficeController::class, 'index']);
        Route::post('/offices', [OfficeController::class, 'store']);
        Route::put('/offices/{id}', [OfficeController::class, 'update']);
        Route::delete('/offices/{id}', [OfficeController::class, 'destroy']);
        Route::post('/offices/{id}/qr', [OfficeController::class, 'qr']);
        Route::post('/offices/{id}/logo', [OfficeController::class, 'uploadLogo']);
        Route::delete('/offices/{id}/logo', [OfficeController::class, 'removeLogo']);
        Route::get('/offices/{id}/supervisors', [OfficeController::class, 'supervisors']);
        Route::post('/offices/{id}/supervisors', [OfficeController::class, 'assignSupervisor']);
        Route::delete('/offices/{id}/supervisors/{supervisorId}', [OfficeController::class, 'removeSupervisor']);

        Route::get('/users', [UserController::class, 'index']);
        Route::post('/invitations', [InvitationController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        Route::get('/stipend', [StipendController::class, 'index']);
        Route::get('/stipend/eligible', [StipendController::class, 'eligible']);
        // Page-level step-up gate (throttled like login): one password entry unlocks
        // the release/void calls for a short window instead of per-action passwords.
        Route::post('/stipend/unlock', [StipendController::class, 'unlock'])->middleware('throttle:6,1');
        // These accept the admin password as an alternative to the unlock token,
        // so they get the same throttle — otherwise they're a guessing oracle.
        Route::post('/stipend/release', [StipendController::class, 'release'])->middleware('throttle:6,1');
        Route::post('/stipend/release-bulk', [StipendController::class, 'releaseBulk'])->middleware('throttle:6,1');
        Route::post('/stipend/{id}/void', [StipendController::class, 'void'])->middleware('throttle:6,1');
        Route::get('/promissory', [AdminPromissoryController::class, 'index']);
        Route::get('/promissory/{id}/file', [AdminPromissoryController::class, 'file']);

        Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('/analytics/insights', [AnalyticsController::class, 'insights']);
        Route::get('/analytics/periods', [AnalyticsController::class, 'periods']);
        Route::get('/audit-logs', [AnalyticsController::class, 'auditLogs']);
        Route::get('/analytics/overview/export', [ReportExplorerController::class, 'overviewPdf'])->middleware('throttle:20,1');
        Route::get('/reports/{type}', [ReportExplorerController::class, 'show'])->where('type', '[a-z-]+');
        Route::get('/reports/{type}/export', [ReportExplorerController::class, 'export'])->where('type', '[a-z-]+')->middleware('throttle:20,1');

        // System Testing — 404 unless SWAP_TEST_TOOLS is on; test accounts only.
        Route::get('/testing', [TestingController::class, 'status']);
        Route::put('/testing/switch', [TestingController::class, 'switch']);
        Route::get('/testing/candidates', [TestingController::class, 'candidates']);
        Route::post('/testing/accounts/{id}', [TestingController::class, 'addAccount'])->whereNumber('id');
        Route::delete('/testing/accounts/{id}', [TestingController::class, 'removeAccount'])->whereNumber('id');
        Route::get('/testing/earlier', [TestingController::class, 'earlierTests']);
        Route::post('/testing/earlier/{id}', [TestingController::class, 'cleanUpEarlierTest'])->whereNumber('id');
        Route::post('/testing/recipients/{id}/{action}', [TestingController::class, 'action']);
        Route::delete('/testing', [TestingController::class, 'releaseAll']);
        // File storage check (any time, switch on or off): where uploads go and what's missing.
        Route::get('/storage-check', [StorageCheckController::class, 'show']);
        Route::get('/semester-periods', [SemesterPeriodController::class, 'index']);
        Route::get('/semester-periods/current', [SemesterPeriodController::class, 'current']);
        Route::post('/semester-periods', [SemesterPeriodController::class, 'store']);
        Route::put('/semester-periods/{id}', [SemesterPeriodController::class, 'update']);
        Route::delete('/semester-periods/{id}', [SemesterPeriodController::class, 'destroy']);

        Route::get('/settings', [SettingController::class, 'index']);
        Route::put('/settings', [SettingController::class, 'update']);


        Route::get('/announcements', [AnnouncementController::class, 'index']);
        // Every send emails all active recipients: throttled against double-sends.
        Route::post('/announcements', [AnnouncementController::class, 'store'])->middleware('throttle:5,1');
        Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

        Route::get('/concerns', [AdminConcernController::class, 'index']);
        Route::put('/concerns/{id}', [AdminConcernController::class, 'update']);

        Route::get('/landing/photos', [LandingPhotoController::class, 'index']);
        Route::post('/landing/photos', [LandingPhotoController::class, 'store']);
        Route::put('/landing/photos/order', [LandingPhotoController::class, 'reorder']);
        Route::put('/landing/photos/{id}', [LandingPhotoController::class, 'update']);
        Route::delete('/landing/photos/{id}', [LandingPhotoController::class, 'destroy']);
    });
});
