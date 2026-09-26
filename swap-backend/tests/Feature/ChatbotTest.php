<?php

namespace Tests\Feature;

use App\Models\FaqKnowledgeBase;
use Database\Seeders\FaqSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ChatbotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FaqSeeder::class);
    }

    public function test_chatbot_is_public_and_answers_faq_questions(): void
    {
        $res = $this->getJson('/api/chatbot/query?message='.urlencode('How long does the application review take?'));

        $res->assertStatus(200)->assertJsonStructure(['data' => ['answer', 'faq_id', 'confidence', 'category']]);
        $this->assertNotEmpty($res->json('data.answer'));
        $this->assertNotNull($res->json('data.faq_id'));
    }

    public function test_chatbot_returns_fallback_for_gibberish(): void
    {
        $res = $this->getJson('/api/chatbot/query?message='.urlencode('zxqwv plplpl qwzxnm'));

        $res->assertStatus(200);
        $this->assertNull($res->json('data.faq_id'));
        $this->assertNotEmpty($res->json('data.answer'));
    }

    public function test_chatbot_validates_message(): void
    {
        $this->getJson('/api/chatbot/query?message=a')->assertStatus(422);
    }

    /** Without an AI key, common questions from every role reach the right built-in answer. */
    public function test_common_questions_reach_the_right_answer(): void
    {
        $expected = [
            'how do I claim my stipend' => 'How do I claim my stipend?',
            'what is a promissory note' => 'What is a promissory note?',
            'I forgot my password' => 'I forgot my password. How do I reset it?',
            'why cant I clock in on sunday' => 'What time can I clock in?',
            'what documents are required' => 'What documents are required for the SWAP application?',
            'why are the signatures missing on my duty slip' => 'Why are the signatures missing from my duty slip?',
            'how do I renew next semester' => 'How do I renew my SWAP slot for next semester?',
            'can I use gmail to register' => 'Why can’t I register with my Gmail or personal email?',
            'how do I give bonus hours' => 'How do I give a student bonus hours?',
            'how do I release stipends' => 'How do I release stipends?',
            'how do I add my digital signature' => 'How do I add my digital signature?',
            'how do I void a claim stub' => 'How do I void a claim stub?',
        ];

        foreach ($expected as $message => $question) {
            $faqId = $this->getJson('/api/chatbot/query?message='.urlencode($message))->assertOk()->json('data.faq_id');
            $this->assertSame($question, FaqKnowledgeBase::find($faqId)?->question, "\"{$message}\" reached the wrong answer");
        }
    }

    public function test_the_knowledge_base_has_no_stale_facts(): void
    {
        $active = FaqKnowledgeBase::active()->get();

        $this->assertSame($active->count(), $active->pluck('question')->unique()->count(), 'duplicate questions');
        foreach ($active as $faq) {
            $this->assertStringNotContainsString('120 hours', $faq->answer, $faq->question);
            $this->assertStringNotContainsString('₱', $faq->answer, $faq->question);
            $this->assertStringNotContainsString('xxxx', $faq->answer, $faq->question);
            $this->assertStringNotContainsString('dsaoffice@msu-marawi', $faq->answer, $faq->question);
        }

    }

    public function test_reseeding_switches_off_superseded_answers(): void
    {
        // A live database still holds the old entry from before the merge.
        FaqKnowledgeBase::create([
            'category' => 'service_hours',
            'question' => 'How do I record my time-in and time-out?',
            'answer' => 'Old answer.',
            'keywords' => ['time'],
            'sort_order' => 7,
            'is_active' => true,
        ]);

        $this->seed(FaqSeeder::class);

        $this->assertFalse(FaqKnowledgeBase::where('question', 'How do I record my time-in and time-out?')->value('is_active'));
    }

    /** A fake Gemini reply, and the knowledge-base text each request carried. */
    private function fakeGemini(): void
    {
        config(['swap.gemini_key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => 'AI answer.']]]]],
        ])]);
    }

    private function entriesSent(\Illuminate\Http\Client\Request $request): int
    {
        return substr_count($request['system_instruction']['parts'][0]['text'], 'Q: ');
    }

    public function test_ai_call_turns_thinking_off_and_sends_only_relevant_entries(): void
    {
        $this->fakeGemini();

        $this->getJson('/api/chatbot/query?message='.urlencode('how do I claim my stipend'))
            ->assertOk()->assertJsonPath('data.answer', 'AI answer.');

        Http::assertSent(function ($request) {
            return $request['generationConfig']['thinkingConfig']['thinkingBudget'] === 0
                && $this->entriesSent($request) <= 16
                && str_contains($request['system_instruction']['parts'][0]['text'], 'How do I claim my stipend?')
                && str_contains($request['system_instruction']['parts'][0]['text'], 'How does the SWAP Portal system work?');
        });
    }

    public function test_ai_gets_the_whole_knowledge_base_when_nothing_matches(): void
    {
        $this->fakeGemini();

        $this->getJson('/api/chatbot/query?message='.urlencode('zxqwv plplpl qwzxnm'))->assertOk();

        $all = FaqKnowledgeBase::active()->count();
        Http::assertSent(fn ($request) => $this->entriesSent($request) === $all);
    }

    public function test_a_repeated_question_reuses_the_ai_answer(): void
    {
        $this->fakeGemini();

        $this->getJson('/api/chatbot/query?message='.urlencode('How do I claim my stipend?'))->assertOk();
        $this->getJson('/api/chatbot/query?message='.urlencode('how do i claim my  stipend'))
            ->assertOk()->assertJsonPath('data.answer', 'AI answer.');

        Http::assertSentCount(1);
    }

    public function test_chatbot_falls_back_to_the_faq_when_the_ai_call_times_out(): void
    {
        config(['swap.gemini_key' => 'test-key']);
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out'));

        $res = $this->getJson('/api/chatbot/query?message='.urlencode('How long does the application review take?'));

        $res->assertStatus(200);
        $this->assertNotNull($res->json('data.faq_id'));
    }

    public function test_chatbot_is_rate_limited(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $this->getJson('/api/chatbot/query?message='.urlencode('application requirements'))->assertStatus(200);
        }

        $this->getJson('/api/chatbot/query?message='.urlencode('application requirements'))->assertStatus(429);
    }
}
