<?php

namespace App\Services;

use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
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
 * release the stipend despite the shortfall. There is no makeup deadline: if the
 * student renews, the lacking hours are added to the next term's requirement
 * (RenewalReadinessService::carryHours).
 *
 * Window: from the day after the term ends until renewal for the next semester closes
 * (the first semester period starting after the term; closed = its renewal was opened,
 * then closed — semester_periods.renewal_closed_at).
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
            throw new UnprocessableEntityHttpException(self::msgNoPeriod($assignment));
        }
        if (Carbon::now(self::TIMEZONE)->lt($semesterEnd->copy()->endOfDay())) {
            throw new UnprocessableEntityHttpException('Promissory notes can only be submitted after the semester ends.');
        }
        if ($closed = $this->windowClosed($assignment, $semesterEnd)) {
            throw new UnprocessableEntityHttpException($closed);
        }

        $verified = (float) $assignment->verified_hours;
        $required = (float) $assignment->required_hours;
        if ($required <= 0 || $verified >= $required) {
            throw new UnprocessableEntityHttpException(self::msgNoLacking($verified, $required));
        }
        // A promissory note covers a shortfall, not a term with no service at all.
        if ($verified <= 0) {
            throw new UnprocessableEntityHttpException(self::msgNoHours($assignment));
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
                'deficient_hours' => $lacking,
                'lacking_hours' => $lacking,
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'reason' => $data['reason'] ?? null,
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
                throw new UnprocessableEntityHttpException(self::msgNoPeriod($assignment));
            }
            if ($data['action'] === 'approve') {
                $note->update([
                    'status' => PromissoryNote::STATUS_APPROVED,
                    'lacking_hours' => $data['lacking_hours'],
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
            'review_remarks' => $updated->review_remarks,
        ]);

        return $updated->load(['student', 'reviewer']);
    }

    /** Why no note is needed when the hours are already met (form and API say the same). */
    public static function msgNoLacking(float $verified, float $required): string
    {
        $fmt = fn (float $h) => rtrim(rtrim(number_format($h, 2, '.', ''), '0'), '.');

        return $required <= 0
            ? 'No lacking hours: this term has no required hours, so a promissory note isn\'t needed.'
            : "No lacking hours: {$fmt($verified)} of {$fmt($required)} required hours are verified, so a promissory note isn't needed.";
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
            return ['can_submit' => false, 'reason' => self::msgNoPeriod($assignment), 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }
        if (Carbon::now(self::TIMEZONE)->lt($semesterEnd->copy()->endOfDay())) {
            return ['can_submit' => false, 'reason' => 'Available only after the semester ends.', 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }
        if ($closed = $this->windowClosed($assignment, $semesterEnd)) {
            return ['can_submit' => false, 'reason' => $closed, 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }

        $verified = (float) $assignment->verified_hours;
        $required = (float) $assignment->required_hours;
        if ($required <= 0 || $verified >= $required) {
            return ['can_submit' => false, 'reason' => self::msgNoLacking($verified, $required), 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }
        if ($verified <= 0) {
            return ['can_submit' => false, 'reason' => self::msgNoHours($assignment), 'assignment_id' => $assignment->id, 'lacking_hours' => null];
        }

        $pendingExists = PromissoryNote::where('assignment_id', $assignment->id)
            ->where('status', PromissoryNote::STATUS_PENDING)
            ->exists();
        if ($pendingExists) {
            return ['can_submit' => false, 'reason' => 'A promissory note is already pending review.', 'assignment_id' => $assignment->id, 'lacking_hours' => round($required - $verified, 2)];
        }

        return [
            'can_submit' => true, 'reason' => null, 'assignment_id' => $assignment->id, 'lacking_hours' => round($required - $verified, 2),
            'window_note' => $this->windowNote($semesterEnd),
        ];
    }

    /** The semester after a term: the first semester period that starts after it ends. */
    public function nextPeriod(Carbon $semesterEnd): ?SemesterPeriod
    {
        return SemesterPeriod::where('start_date', '>', $semesterEnd->toDateString())->orderBy('start_date')->first();
    }

    /** Why notes for this term can't be filed any more (renewal for the next semester closed), or null. */
    public function windowClosed(Assignment $assignment, Carbon $semesterEnd): ?string
    {
        $next = $this->nextPeriod($semesterEnd);
        if (!$next || $next->renewal_open || !$next->renewal_closed_at) {
            return null;
        }

        return "Promissory notes for {$assignment->semester} {$assignment->academic_year} closed when renewal for {$next->label()} closed on "
            . $next->renewal_closed_at->timezone(self::TIMEZONE)->format('M j, Y') . '.';
    }

    /** How long the window stays open, for the Stipend page. */
    public function windowNote(Carbon $semesterEnd): string
    {
        $next = $this->nextPeriod($semesterEnd);

        return $next
            ? "You can submit until renewal for {$next->label()} closes."
            : 'You can submit until renewal for the next semester closes.';
    }

    /**
     * The semester end in Manila: the assignment's own end date, else its DSA
     * semester period's (Admin → Semesters). Null when the term isn't set up.
     */
    public function semesterEndFor(Assignment $assignment): ?Carbon
    {
        $end = $assignment->effectiveEndDate();

        return $end ? Carbon::parse($end->toDateString(), self::TIMEZONE) : null;
    }

    public static function msgNoPeriod(Assignment $assignment): string
    {
        return "The semester period for {$assignment->semester} {$assignment->academic_year} isn't set up yet. Ask the DSA to add it under Semesters.";
    }

    public static function msgNoHours(Assignment $assignment): string
    {
        return "A promissory note needs some verified service hours. You have none for {$assignment->semester} {$assignment->academic_year}.";
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
