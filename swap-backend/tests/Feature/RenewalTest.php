<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
use App\Models\StipendHistory;
use App\Models\TermEvaluation;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\RenewalReadinessService as Gate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Semester renewal: a recipient submits an updated COR (early is fine), the admin
 * approves (no interview) and the assignment rolls into the new term. Approval
 * waits for the renewed term: paid or covered by an approved promissory note,
 * report in, evaluated and passed, and no overdue makeup.
 */
class RenewalTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const TERM = '1st Semester 2024-2025';

    private SemesterPeriod $next;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.documents_disk', 'public'));

        // The DSA calendar: the 1st Semester just ended; renewal is open for the 2nd.
        $today = Carbon::now('Asia/Manila');
        SemesterPeriod::create([
            'academic_year' => '2024-2025', 'semester' => '1st Semester',
            'start_date' => $today->copy()->subMonths(5)->toDateString(), 'end_date' => $today->copy()->subDay()->toDateString(),
        ]);
        $this->next = SemesterPeriod::create([
            'academic_year' => '2024-2025', 'semester' => '2nd Semester',
            'start_date' => $today->copy()->addWeek()->toDateString(), 'end_date' => $today->copy()->addMonths(5)->toDateString(),
            'renewal_open' => true,
        ]);
    }

    /**
     * A recipient with a 1st Semester assignment and 4 verified hours.
     *
     * @return array{0: User, 1: Assignment}
     */
    private function recipientWithTerm(bool $metHours): array
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => $metHours ? 3 : 240]);
        $this->makeClosedLog($assignment, 4);

        return [$recipient, $assignment];
    }

    /** A submitted renewal for the 2nd Semester; with its COR unless `$withCor` is false. */
    private function renewalFor(User $recipient, bool $withCor = true): Application
    {
        $application = Application::create([
            'user_id' => $recipient->id,
            'academic_year' => '2024-2025',
            'semester' => '2nd Semester',
            'status' => 'submitted',
            'type' => 'renewal',
        ]);
        if ($withCor) {
            $application->documents()->create([
                'document_type' => 'cor', 'file_path' => "documents/{$application->id}/cor.pdf", 'file_url' => '/api/documents/0/file',
                'file_name' => 'cor.pdf', 'file_size' => 1000, 'mime_type' => 'application/pdf',
            ]);
        }

        return $application;
    }

    private function pay(Assignment $assignment): void
    {
        StipendHistory::create([
            'user_id' => $assignment->user_id, 'amount' => 5000, 'academic_year' => '2024-2025',
            'semester' => '1st Semester', 'status' => StipendHistory::STATUS_CERTIFIED,
        ]);
    }

    private function evaluate(Assignment $assignment, int $rating): void
    {
        TermEvaluation::create([
            'assignment_id' => $assignment->id, 'evaluator_id' => $assignment->supervisor_id,
            'rating' => $rating, 'remarks' => 'Reliable and punctual.', 'passed' => $rating >= TermEvaluation::PASSING_RATING,
        ]);
    }

    private function approvedNote(Assignment $assignment, string $deadline): PromissoryNote
    {
        return PromissoryNote::create([
            'user_id' => $assignment->user_id, 'assignment_id' => $assignment->id,
            'academic_year' => '2024-2025', 'semester' => '1st Semester', 'reason' => 'Exam weeks.',
            'file_path' => 'promissory/x.pdf', 'file_name' => 'x.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100,
            'verified_hours_snapshot' => 4, 'lacking_hours' => 236, 'deficient_hours' => 236,
            'status' => PromissoryNote::STATUS_APPROVED, 'makeup_deadline' => $deadline,
        ]);
    }

    private function decide(Application $application, string $decision)
    {
        return $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => $decision, 'remarks' => 'Reviewed.',
        ]);
    }

    public function test_approval_waits_while_the_previous_term_is_owed_a_stipend(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        $this->evaluate($previous, 4);
        $renewal = $this->renewalFor($recipient);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->decide($renewal, 'approved')->assertStatus(409)->assertJsonPath('message', Gate::msgOwed(self::TERM));

        // Nothing moved.
        $this->assertSame('submitted', $renewal->fresh()->status);
        $this->assertSame('active', $previous->fresh()->status);
        $this->assertSame(1, Assignment::where('user_id', $recipient->id)->count());
    }

    public function test_a_short_term_without_a_promissory_note_blocks_approval(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: false);
        $this->evaluate($previous, 5);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->decide($this->renewalFor($recipient), 'approved')
            ->assertStatus(409)->assertJsonPath('message', Gate::msgUnpaid(self::TERM));
        $this->assertSame('active', $previous->fresh()->status);
    }

    public function test_evaluation_is_required_and_must_pass(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        $this->pay($previous);
        $renewal = $this->renewalFor($recipient);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->decide($renewal, 'approved')->assertStatus(409)->assertJsonPath('message', Gate::msgNotEvaluated(self::TERM));

        $this->evaluate($previous, 2);
        $this->decide($renewal, 'approved')->assertStatus(409)->assertJsonPath('message', Gate::msgFailed(self::TERM, 2));

        // The admin's review shows the same record.
        $this->getJson("/api/admin/applications/{$renewal->id}")->assertOk()
            ->assertJsonPath('data.renewal_readiness.payment', 'paid')
            ->assertJsonPath('data.renewal_readiness.evaluation.rating', 2)
            ->assertJsonPath('data.renewal_readiness.ready', false)
            ->assertJsonPath('data.renewal_readiness.blocker', Gate::msgFailed(self::TERM, 2));
    }

    public function test_once_paid_and_evaluated_approval_rolls_the_assignment_over(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        $this->pay($previous);
        $this->evaluate($previous, 3);
        $oldLogs = TimeLog::where('assignment_id', $previous->id)->count();
        $renewal = $this->renewalFor($recipient);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson("/api/admin/applications/{$renewal->id}")->assertOk()
            ->assertJsonPath('data.renewal_readiness.ready', true)
            ->assertJsonPath('data.renewal_readiness.blocker', null);

        $this->decide($renewal, 'approved')->assertOk()->assertJsonPath('data.status', 'approved');

        $previous->refresh();
        $this->assertSame('completed', $previous->status);
        // The old term's verdict is recorded at the rollover.
        $this->assertSame(Assignment::TERM_QUALIFIED, $previous->term_status);

        $next = Assignment::where('user_id', $recipient->id)->where('semester', '2nd Semester')->firstOrFail();
        $this->assertSame('active', $next->status);
        $this->assertSame($previous->office_id, $next->office_id);
        $this->assertSame($previous->supervisor_id, $next->supervisor_id);
        $this->assertSame($previous->required_hours, $next->required_hours);
        // The new term follows its semester period, and its hours start at zero:
        // the old logs stay on the old assignment.
        $this->assertSame($this->next->start_date->toDateString(), $next->start_date->toDateString());
        $this->assertNull($next->end_date);
        $this->assertSame($this->next->end_date->toDateString(), $next->effectiveEndDate()->toDateString());
        $this->assertEquals(0.0, $next->verified_hours);
        $this->assertSame($oldLogs, TimeLog::where('assignment_id', $previous->id)->count());
        $this->assertSame(0, TimeLog::where('assignment_id', $next->id)->count());

        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/hours/summary')->assertOk()->assertJsonPath('data.verified', 0);
    }

    public function test_a_promissory_term_needs_its_report_then_rolls_over_and_stays_payable(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: false);
        $this->approvedNote($previous, Carbon::now('Asia/Manila')->addDays(6)->toDateString());
        $this->evaluate($previous, 4);
        $renewal = $this->renewalFor($recipient);
        Sanctum::actingAs($this->makeUser('admin'));

        // Covered by the note but unpaid: the end-of-term report must be in first.
        $this->decide($renewal, 'approved')->assertStatus(409)->assertJsonPath('message', Gate::msgNoReport(self::TERM));

        $this->submitTermReport($previous);
        $this->decide($renewal, 'approved')->assertOk();

        $this->assertSame('completed', $previous->fresh()->status);
        $this->assertSame(Assignment::TERM_DEFICIENT, $previous->fresh()->term_status);
        // The covered term can still be released after the rollover.
        $this->getJson('/api/admin/stipend/eligible')->assertOk()
            ->assertJsonFragment(['user_id' => $recipient->id, 'semester' => '1st Semester', 'via_promissory' => true]);
    }

    public function test_unfinished_makeup_hours_carry_into_the_next_term(): void
    {
        // 240 required, 4 verified, covered by an approved note; 6 makeup hours done before approval.
        [$recipient, $previous] = $this->recipientWithTerm(metHours: false);
        $this->approvedNote($previous, Carbon::now('Asia/Manila')->addDays(6)->toDateString());
        $this->makeClosedLog($previous, 6);
        $this->evaluate($previous, 4);
        $this->submitTermReport($previous);
        $renewal = $this->renewalFor($recipient);
        Sanctum::actingAs($admin = $this->makeUser('admin'));

        $this->getJson("/api/admin/applications/{$renewal->id}")->assertOk()
            ->assertJsonPath('data.renewal_readiness.carry_hours', 230);

        $this->decide($renewal, 'approved')->assertOk();

        $next = Assignment::where('user_id', $recipient->id)->where('semester', '2nd Semester')->firstOrFail();
        $this->assertSame(240 + 230, $next->required_hours);
        $this->assertSame(230, $next->carried_over_hours);
        $this->assertSame($previous->id, $next->carried_from_assignment_id);
        $this->assertSame(240, $next->baseRequiredHours());
        $this->assertDatabaseHas('audit_logs', ['action' => 'renewal_hours_carried', 'user_id' => $admin->id]);

        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/assignment')->assertOk()
            ->assertJsonPath('data.carried_over_hours', 230)
            ->assertJsonPath('data.carried_from_term', self::TERM);
    }

    public function test_a_term_that_met_its_hours_carries_nothing(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        $this->pay($previous);
        $this->evaluate($previous, 4);
        Sanctum::actingAs($this->makeUser('admin'));
        $this->decide($this->renewalFor($recipient), 'approved')->assertOk();

        $next = Assignment::where('user_id', $recipient->id)->where('semester', '2nd Semester')->firstOrFail();
        $this->assertSame(3, $next->required_hours);
        $this->assertSame(0, $next->carried_over_hours);
        $this->assertNull($next->carried_from_assignment_id);
    }

    public function test_an_overdue_makeup_blocks_approval(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: false);
        $due = Carbon::now('Asia/Manila')->subDay();
        $this->approvedNote($previous, $due->toDateString());
        $this->pay($previous);
        $this->evaluate($previous, 5);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->decide($this->renewalFor($recipient), 'approved')
            ->assertStatus(409)->assertJsonPath('message', Gate::msgMakeupOverdue(self::TERM, $due));
    }

    public function test_a_renewal_without_its_cor_or_an_earlier_placement_is_not_approved(): void
    {
        // Even with the term paid and evaluated, a renewal that never came with a COR stays blocked.
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        $this->pay($previous);
        $this->evaluate($previous, 5);
        $renewal = $this->renewalFor($recipient, withCor: false);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->decide($renewal, 'approved')->assertStatus(409)->assertJsonPath('message', Gate::MSG_NO_COR);
        $this->getJson("/api/admin/applications/{$renewal->id}")->assertOk()
            ->assertJsonPath('data.renewal_readiness.cor_attached', false)
            ->assertJsonPath('data.renewal_readiness.blocker', Gate::MSG_NO_COR);
        $this->assertSame('submitted', $renewal->fresh()->status);

        // Nobody to roll over: a "renewal" from someone with no earlier assignment.
        $stranger = $this->renewalFor($this->makeUser('recipient'));
        $this->decide($stranger, 'approved')->assertStatus(409)->assertJsonPath('message', Gate::MSG_NO_PREVIOUS);
    }

    public function test_the_renewal_page_says_approved_only_once_the_new_term_exists(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        // An application marked approved without the rollover (e.g. written straight to the database).
        $this->renewalFor($recipient)->update(['status' => 'approved']);

        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/renewals')->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('meta.placed', false);

        $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, ['semester' => '2nd Semester']);
        $this->getJson('/api/recipient/renewals')->assertOk()->assertJsonPath('meta.placed', true);
    }

    public function test_admin_can_list_renewals_apart_from_new_applications(): void
    {
        [$recipient] = $this->recipientWithTerm(metHours: true);
        $renewal = $this->renewalFor($recipient);
        $fresh = Application::create([
            'user_id' => $this->makeUser('applicant')->id, 'academic_year' => '2024-2025',
            'semester' => '2nd Semester', 'status' => 'submitted', 'type' => 'new',
        ]);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/applications?type=renewal')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $renewal->id)
            ->assertJsonPath('data.0.type', 'renewal')
            // The readiness check runs on the single application, not per row.
            ->assertJsonMissingPath('data.0.renewal_readiness');
        $this->getJson('/api/admin/applications?type=new')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $fresh->id);
        $this->getJson('/api/admin/applications')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/applications?type=renewal&status=submitted')->assertOk()->assertJsonPath('meta.total', 1);

        $this->getJson("/api/admin/applications/{$renewal->id}")->assertOk()
            ->assertJsonPath('data.renewal_readiness.cor_attached', true);
    }

    public function test_rejecting_a_renewal_is_never_blocked(): void
    {
        [$recipient, $previous] = $this->recipientWithTerm(metHours: true);
        $renewal = $this->renewalFor($recipient);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->decide($renewal, 'rejected')->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->assertSame('active', $previous->fresh()->status);
    }

    public function test_submitting_a_renewal_follows_the_window_and_one_per_term(): void
    {
        $cor = fn () => UploadedFile::fake()->create('cor.pdf', 200, 'application/pdf');

        // No previous assignment.
        Sanctum::actingAs($this->makeUser('recipient'));
        $this->post('/api/recipient/renewals', ['cor' => $cor()], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', 'Renewal is only available to recipients with an existing assignment.');

        // Submitting early is fine; only the approval checks the gates.
        [$recipient] = $this->recipientWithTerm(metHours: false);
        Sanctum::actingAs($recipient);
        $this->post('/api/recipient/renewals', ['cor' => $cor()], ['Accept' => 'application/json'])
            ->assertStatus(201)->assertJsonPath('data.type', 'renewal');
        $this->post('/api/recipient/renewals', ['cor' => $cor()], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('message', 'You already have a submission for 2024-2025 — 2nd Semester.');

        // Window closed.
        $this->next->update(['renewal_open' => false]);
        [$other] = $this->recipientWithTerm(metHours: false);
        Sanctum::actingAs($other);
        $this->post('/api/recipient/renewals', ['cor' => $cor()], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', 'The renewal period is not open yet. Please wait for the DSA announcement.');
    }
}
