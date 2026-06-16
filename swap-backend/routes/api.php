<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\QrCodeController;
use App\Http\Controllers\Shared\ChatbotController;
use App\Http\Controllers\Shared\ConcernController;
use App\Http\Controllers\Shared\NotificationController;
use App\Http\Controllers\Shared\ProfileController;
use App\Http\Controllers\Shared\ReportController;
use App\Http\Controllers\Applicant\ApplicationController as ApplicantApplicationController;
use App\Http\Controllers\Applicant\DocumentController;
use App\Http\Controllers\Recipient\AttendanceController;
use App\Http\Controllers\Recipient\HoursController;
use App\Http\Controllers\Recipient\NarrativeController;
use App\Http\Controllers\Supervisor\StudentController;
use App\Http\Controllers\Supervisor\VerificationController;
use App\Http\Controllers\Admin\ApplicationController as AdminApplicationController;
use App\Http\Controllers\Admin\AssignmentController;
use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\OfficeController;
use App\Http\Controllers\Admin\StipendController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword']);
Route::get('/chatbot/query', [ChatbotController::class, 'query']);
Route::get('/qr-codes/{assignmentId}', [QrCodeController::class, 'show']);
Route::get('/qr-codes/{assignmentId}/view', [QrCodeController::class, 'render']);

// ─── AUTHENTICATED ────────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/concerns', [ConcernController::class, 'store']);

    // ─── APPLICANT ────────────────────────────────────────────────────────────
    Route::middleware('role:applicant')->prefix('applicant')->group(function () {
        Route::get('/applications', [ApplicantApplicationController::class, 'index']);
        Route::post('/applications', [ApplicantApplicationController::class, 'store']);
        Route::get('/applications/{id}', [ApplicantApplicationController::class, 'show']);
        Route::post('/applications/{id}/documents', [DocumentController::class, 'store']);
        Route::get('/applications/{id}/status', [ApplicantApplicationController::class, 'status']);
    });

    // ─── RECIPIENT ────────────────────────────────────────────────────────────
    Route::middleware('role:recipient')->prefix('recipient')->group(function () {
        Route::get('/attendance/current', [AttendanceController::class, 'current']);
        Route::post('/attendance/time-in', [AttendanceController::class, 'timeIn']);
        Route::post('/attendance/time-out', [AttendanceController::class, 'timeOut']);
        Route::post('/narratives', [NarrativeController::class, 'store'])->withoutMiddleware('role:recipient');
        Route::get('/narratives/{logId}', [NarrativeController::class, 'show']);
        Route::get('/hours/summary', [HoursController::class, 'summary']);
        Route::get('/reports/weekly', [ReportController::class, 'weekly']);
        Route::get('/reports/monthly', [ReportController::class, 'monthly']);
        Route::get('/reports/semester', [ReportController::class, 'semester']);
        Route::get('/stipend/history', [ReportController::class, 'stipendHistory']);
    });

    // ─── SUPERVISOR ───────────────────────────────────────────────────────────
    Route::middleware('role:supervisor')->prefix('supervisor')->group(function () {
        Route::get('/students', [StudentController::class, 'index']);
        Route::get('/students/{id}/summary', [StudentController::class, 'summary']);
        Route::get('/students/{id}/logs', [StudentController::class, 'logs']);
        Route::put('/verifications/{logId}', [VerificationController::class, 'update']);
    });

    // ─── ADMIN ────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/applications', [AdminApplicationController::class, 'index']);
        Route::get('/applications/{id}', [AdminApplicationController::class, 'show']);
        Route::put('/applications/{id}/review', [AdminApplicationController::class, 'review']);
        Route::post('/applications/{id}/interview', [AdminApplicationController::class, 'interview']);
        Route::put('/applications/{id}/decide', [AdminApplicationController::class, 'decide']);

        Route::get('/assignments', [AssignmentController::class, 'index']);
        Route::post('/assignments', [AssignmentController::class, 'store']);
        Route::put('/assignments/{id}', [AssignmentController::class, 'update']);
        Route::post('/assignments/{id}/regenerate-qr', [AssignmentController::class, 'regenerateQr']);

        Route::get('/offices', [OfficeController::class, 'index']);
        Route::post('/offices', [OfficeController::class, 'store']);
        Route::put('/offices/{id}', [OfficeController::class, 'update']);
        Route::delete('/offices/{id}', [OfficeController::class, 'destroy']);

        Route::get('/users', [UserController::class, 'index']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        Route::get('/stipend', [StipendController::class, 'index']);
        Route::post('/stipend/release', [StipendController::class, 'release']);

        Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('/audit-logs', [AnalyticsController::class, 'auditLogs']);
        Route::get('/reports/generate', [ReportController::class, 'generateAdminReport']);
    });
});
