<?php

namespace Tests\Feature;

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
