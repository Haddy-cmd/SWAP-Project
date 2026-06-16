<?php

namespace Tests\Feature;

use Database\Seeders\FaqSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
