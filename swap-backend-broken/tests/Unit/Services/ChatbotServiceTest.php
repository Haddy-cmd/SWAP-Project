<?php

use App\Models\FaqKnowledgeBase;
use App\Services\ChatbotService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns a matching FAQ answer for a keyword match', function () {
    FaqKnowledgeBase::create([
        'category' => 'eligibility',
        'question' => 'Who is eligible to apply?',
        'answer' => 'Students with financial need and a GPA of 2.0.',
        'keywords' => ['eligible', 'qualify', 'requirement'],
        'is_active' => true,
        'sort_order' => 1,
    ]);

    $service = new ChatbotService();
    $result = $service->processQuery('What are the eligibility requirements?');

    expect($result['faq_id'])->not->toBeNull();
    expect($result['confidence'])->toBeGreaterThan(0);
    expect($result['answer'])->toContain('GPA');
});

it('returns fallback response when no FAQ matches', function () {
    $service = new ChatbotService();
    $result = $service->processQuery('What is the meaning of life?');

    expect($result['faq_id'])->toBeNull();
    expect($result['confidence'])->toBe(0.0);
    expect($result['answer'])->toContain('DSA');
});

it('returns fallback when input is too short or generic', function () {
    $service = new ChatbotService();
    $result = $service->processQuery('hi');

    expect($result['faq_id'])->toBeNull();
    expect($result['confidence'])->toBe(0.0);
});

it('returns highest scoring match when multiple FAQs partially match', function () {
    FaqKnowledgeBase::create([
        'category' => 'stipend',
        'question' => 'How much is the stipend?',
        'answer' => 'The stipend is PHP 5000.',
        'keywords' => ['stipend', 'amount', 'money'],
        'is_active' => true,
        'sort_order' => 1,
    ]);

    FaqKnowledgeBase::create([
        'category' => 'application',
        'question' => 'How do I submit my application?',
        'answer' => 'Submit online through the portal.',
        'keywords' => ['submit', 'apply', 'online'],
        'is_active' => true,
        'sort_order' => 2,
    ]);

    $service = new ChatbotService();
    $result = $service->processQuery('How much stipend money will I receive?');

    expect($result['answer'])->toContain('5000');
});
