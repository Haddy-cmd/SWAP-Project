<?php

namespace App\Services;

use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\PromissoryNote;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Promissory notes for recipients who fell short of their required hours after
 * the semester end. The student uploads the note, a governing supervisor
 * approves it (recording the lacking hours), and the approval lets the admin
 * release the stipend despite the shortfall.
 *
 * Policy: the makeup deadline is fixed at exactly 1 week after the semester
 * end — server-computed, never client input.
 */
class PromissoryService
{
    /** Asia/Manila: every semester-end comparison is made in the app's rule zone. */
    private const TIMEZONE = 'Asia/Manila';

    public function submit(User $recipient, array $data, UploadedFile $file): PromissoryNote
    {
        $assignment = Assignment::where('id', $data['assignment_id'])
            ->where('user_id', $recipient->id)
            ->where('status', 'active')
            ->first();

        if (!$assignment) {
            throw new NotFoundHttpException('Assignment not found.');
        }

        $semesterEnd = $this->semesterEndFor($assignment);
        if ($semesterEnd === null) {
            throw new UnprocessableEntityHttpException('Semester end date is not set. Ask the admin to set it first.');
        }
        if (Carbon::now(self::TIMEZONE)->lt($semesterEnd->copy()->endOfDay())) {
            throw new UnprocessableEntityHttpException('Promissory notes can only be submitted after the semester ends.');
        }

        $verified = (float) $assignment->verified_hours;
        $required = (float) $assignment->required_hours;
        if ($required <= 0 || $verified >= $required) {
            throw new UnprocessableEntityHttpException('No lacking hours — a promissory note is not needed.');
        }

        $pendingExists = PromissoryNote::where('assignment_id', $assignment->id)
            ->where('status', PromissoryNote::STATUS_PENDING)
            ->exists();
        if ($pendingExists) {
            throw new UnprocessableEntityHttpException('There is already a pending promissory note for this assignment.');
        }

        $path = $this->storeFile($assignment, $file);
        $lacking = round($required - $verified, 2);

        $note = DB::transaction(function () use ($recipient, $assignment, $data, $file, $path, $verified, $lacking) {
            $note = PromissoryNote::create([
                'assignment_id' => $assignment->id,
                'user_id' => $recipient->id,
                'academic_year' => $assignment->academic_year,
                'semester' => $assignment->semester,
                'verified_hours_snapshot' => $verified,
                'lacking_hours' => $lacking,
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'reason' => $data['reason'],
                'status' => PromissoryNote::STATUS_PENDING,
            ]);

            AuditLog::record('submitted', $note, null, $note->only(['status', 'lacking_hours']), $recipient->id);

            return $note;
        });

        foreach ($assignment->governingSupervisors() as $supervisor) {
            $this->dispatchQuietly('promissory_submitted', [
                'user_id' => $supervisor->id,
                'promissory_id' => $note->id,
                'student_name' => $recipient->name,
                'lacking_hours' => $lacking,
            ]);
        }

        return $note->load(['student', 'assignment']);
    }

    public function review(User $supervisor, PromissoryNote $note, array $data): PromissoryNote
    {
        if (!$note->isPending()) {
            throw new UnprocessableEntityHttpException('This promissory note has already been reviewed.');
        }

        $assignment = $note->assignment;
        $governedIds = $assignment->governingSupervisors()->pluck('id')->all();
        if (!in_array($supervisor->id, $governedIds, true)) {
            throw new NotFoundHttpException('Student not found or not assigned to you.');
        }

        $before = $note->only(['status']);

        $updated = DB::transaction(function () use ($note, $data, $supervisor, $assignment, $before) {
            // Recomputed inside the transaction; also guards a semester-end change mid-review.
            $semesterEnd = $this->semesterEndFor($assignment);
            if ($data['action'] === 'approve' && $semesterEnd === null) {
                throw new UnprocessableEntityHttpException('Semester end date is not set. Ask the admin to set it first.');
            }
            if ($data['action'] === 'approve') {
                $note->update([
                    'status' => PromissoryNote::STATUS_APPROVED,
                    'lacking_hours' => $data['lacking_hours'],
                    'makeup_deadline' => $semesterEnd->copy()->addDays(7)->toDateString(),
                    'review_remarks' => $data['review_remarks'] ?? null,
                    'reviewed_by' => $supervisor->id,
                    'reviewed_at' => now(),
                ]);
            } else {
                $note->update([
                    'status' => PromissoryNote::STATUS_REJECTED,
                    'review_remarks' => $data['review_remarks'] ?? null,
                    'reviewed_by' => $supervisor->id,
                    'reviewed_at' => now(),
                ]);
            }

            AuditLog::record('reviewed', $note->fresh(), $before, ['status' => $note->status], $supervisor->id);

            return $note->fresh();
        });

        $this->dispatchQuietly('promissory_reviewed', [
            'user_id' => $note->user_id,
            'promissory_id' => $note->id,
            'decision' => $updated->status,
            'lacking_hours' => $updated->lacking_hours,
            'makeup_deadline' => $updated->makeup_deadline?->toDateString(),
            'review_remarks' => $updated->review_remarks,
        ]);

        return $updated->load(['student', 'reviewer']);
    }

    /**
     * What the recipient UI needs: whether a note can be submitted right now
     * (and why not), plus the existing notes. Reads the latest active assignment.
     *
     * @return array{can_submit: bool, reason: ?string, assignment_id: ?int, lacking_hours: ?float}
     */
    public function submissionState(User $recipient): array
    {
        $assignment = Assignment::where('user_id', $recipient->id)
            ->where('status', 'active')
            ->latest('id')
            ->first();

        if (!$assignment) {
            return ['can_submit' => false, 'reason' => 'No active assignment.', 'assignment_id' => null, 'lacking_hours' => null];
        }

        $semesterEnd = $this->semesterEndFor($assignment);
        if ($semesterEnd === null) {
            return ['can_submit' => false, 'reason' => 'Semester end date is not set yet.', 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }
        if (Carbon::now(self::TIMEZONE)->lt($semesterEnd->copy()->endOfDay())) {
            return ['can_submit' => false, 'reason' => 'Available only after the semester ends.', 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }

        $verified = (float) $assignment->verified_hours;
        $required = (float) $assignment->required_hours;
        if ($required <= 0 || $verified >= $required) {
            return ['can_submit' => false, 'reason' => 'No lacking hours.', 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }

        $pendingExists = PromissoryNote::where('assignment_id', $assignment->id)
            ->where('status', PromissoryNote::STATUS_PENDING)
            ->exists();
        if ($pendingExists) {
            return ['can_submit' => false, 'reason' => 'A promissory note is already pending review.', 'assignment_id' => $assignment->id, 'lacking_hours' => round($required - $verified, 2)];
        }

        return ['can_submit' => true, 'reason' => null, 'assignment_id' => $assignment->id, 'lacking_hours' => round($required - $verified, 2)];
    }

    /**
     * The semester end in Manila: the assignment's end_date, else the admin-set
     * `semester_end_date` setting. Null when neither exists.
     */
    public function semesterEndFor(Assignment $assignment): ?Carbon
    {
        if ($assignment->end_date) {
            return Carbon::parse($assignment->end_date->toDateString(), self::TIMEZONE);
        }

        $fallback = Setting::get('semester_end_date');
        if ($fallback) {
            try {
                return Carbon::parse($fallback, self::TIMEZONE);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    /** Store the promissory document; storage misconfig surfaces as a 500 with the root cause. */
    private function storeFile(Assignment $assignment, UploadedFile $file): string
    {
        $disk = config('filesystems.documents_disk', 'public');

        try {
            $path = $file->store("promissory/{$assignment->id}", $disk);
            if ($path === false) {
                throw new \Exception('File storage driver returned false (check credentials and permissions).');
            }

            return $path;
        } catch (\Throwable $e) {
            $root = $e;
            while ($root->getPrevious()) {
                $root = $root->getPrevious();
            }
            Log::error('Promissory upload failed', [
                'disk' => $disk,
                'error' => $e->getMessage(),
                'cause' => $root->getMessage(),
            ]);
            throw new HttpException(500, 'Failed to upload the promissory document.');
        }
    }

    private function dispatchQuietly(string $type, array $data): void
    {
        try {
            SendApplicationNotificationJob::dispatch($type, $data)->onQueue('notifications');
        } catch (\Throwable $e) {
            Log::warning('Promissory notification dispatch failed', ['type' => $type, 'error' => $e->getMessage()]);
        }
    }
}
