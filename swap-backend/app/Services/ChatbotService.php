<?php

namespace App\Services;

use App\Models\FaqKnowledgeBase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ChatbotService
{
    private const FALLBACK_RESPONSE = 'Thank you for your question. For assistance, please contact the DSA Office at Mindanao State University – Marawi. You may visit the office during working hours (Monday–Friday, 8:00 AM – 5:00 PM) or email dsa@msumain.edu.ph.';

    /** How many best-matching FAQ entries the AI receives as context. */
    private const AI_CONTEXT_SIZE = 15;

    /** Always sent to the AI so it can explain the overall flow. */
    private const OVERVIEW_QUESTION = 'How does the SWAP Portal system work?';

    /** Identical questions reuse the AI's answer for this long. */
    private const AI_CACHE_SECONDS = 6 * 3600;

    public function processQuery(string $message): array
    {
        $inputWords = $this->extractKeywords($this->normalize($message));

        if (empty($inputWords)) {
            return $this->buildFallback();
        }

        $best = $this->rankFaqs($inputWords)->first();

        if ($best) {
            return [
                'answer' => $best['faq']->answer,
                'faq_id' => $best['faq']->id,
                'confidence' => min(round($best['score'] / max(count($inputWords), 1), 2), 1.0),
                'category' => $best['faq']->category,
            ];
        }

        return $this->buildFallback();
    }

    /**
     * Active FAQs that share at least one keyword with the question, best first.
     * The sort is stable, so on a tie the earlier entry still wins (the old rule).
     *
     * @return Collection<int, array{faq: FaqKnowledgeBase, score: int}>
     */
    private function rankFaqs(array $inputWords): Collection
    {
        return FaqKnowledgeBase::active()->get()
            ->map(fn (FaqKnowledgeBase $faq) => [
                'faq' => $faq,
                'score' => count(array_intersect($inputWords, array_merge(
                    $faq->keywords ?? [],
                    $this->extractKeywords($this->normalize($faq->question))
                ))),
            ])
            ->filter(fn (array $row) => $row['score'] > 0)
            ->sortByDesc('score')
            ->values();
    }

    /**
     * The entries the AI answers from: the best keyword matches plus the portal
     * overview. Sending all ~100 entries on every question made each reply slow;
     * a question with no keyword match at all still gets the full set.
     */
    private function aiContextFaqs(string $message): Collection
    {
        $inputWords = $this->extractKeywords($this->normalize($message));
        $ranked = $inputWords ? $this->rankFaqs($inputWords) : collect();

        if ($ranked->isEmpty()) {
            return FaqKnowledgeBase::active()->orderBy('sort_order')->get();
        }

        $faqs = $ranked->take(self::AI_CONTEXT_SIZE)->pluck('faq');

        if (!$faqs->contains('question', self::OVERVIEW_QUESTION)) {
            $overview = FaqKnowledgeBase::active()->where('question', self::OVERVIEW_QUESTION)->first();
            if ($overview) {
                $faqs->push($overview);
            }
        }

        return $faqs;
    }

    public function processQueryWithAI(string $message): array
    {
        $apiKey = config('swap.gemini_key');

        // No key configured → fall back to the local keyword FAQ matcher.
        if (empty($apiKey)) {
            return $this->processQuery($message);
        }

        $model = config('swap.gemini_model', 'gemini-2.0-flash');

        // Many students ask the same things. Reuse an answer for an identical
        // question; the newest FAQ edit is part of the key, so re-seeding the
        // knowledge base on deploy retires stale answers automatically.
        $cacheKey = 'chatbot:ai:' . md5(implode('|', [
            $model,
            (string) FaqKnowledgeBase::max('updated_at'),
            trim(preg_replace('/\s+/', ' ', $this->normalize($message))),
        ]));
        if ($cached = Cache::get($cacheKey)) {
            return $cached;
        }

        $context = $this->aiContextFaqs($message)
            ->map(fn ($f) => "Q: {$f->question}\nA: {$f->answer}")
            ->join("\n\n");

        $systemPrompt = 'You are a helpful assistant for the Student Welfare Assistantship Program (SWAP) at '
            . "Mindanao State University – Marawi. Answer using only the FAQ knowledge base below. If the question "
            . "is not covered, advise the student to contact the DSA Office. Keep answers concise, friendly, and in "
            . "plain language.\n\n{$context}";

        // Google Gemini (AI Studio) generateContent endpoint. The key goes in the
        // x-goog-api-key header so it never lands in URL/proxy logs. Tight timeouts:
        // the API runs on a single `php artisan serve` process, so a hung upstream
        // call would stall every other request.
        try {
            $response = Http::timeout(8)->connectTimeout(3)->withHeaders([
                'Content-Type' => 'application/json',
                'x-goog-api-key' => $apiKey,
            ])->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                'system_instruction' => [
                    'parts' => [['text' => $systemPrompt]],
                ],
                'contents' => [
                    ['role' => 'user', 'parts' => [['text' => $message]]],
                ],
                'generationConfig' => [
                    'maxOutputTokens' => 512,
                    'temperature' => 0.3,
                    // Gemini 2.5 Flash "thinks" before answering unless told not to.
                    // For FAQ look-ups that only adds seconds, and the thinking also
                    // eats into maxOutputTokens (sometimes leaving an empty reply).
                    'thinkingConfig' => ['thinkingBudget' => 0],
                ],
            ]);
        } catch (ConnectionException) {
            // Timed out or unreachable → keyword fallback, same as a failed response.
            return $this->processQuery($message);
        }

        // Gemini unreachable, rate-limited, or rejected the key → keyword fallback.
        if ($response->failed()) {
            return $this->processQuery($message);
        }

        $text = $response->json('candidates.0.content.parts.0.text', '');

        // Empty or safety-blocked completion → fall back rather than reply blank.
        if (empty($text)) {
            return $this->processQuery($message);
        }

        $result = [
            'answer' => $text,
            'faq_id' => null,
            'confidence' => 0.9,
            'category' => 'ai',
        ];

        Cache::put($cacheKey, $result, self::AI_CACHE_SECONDS);

        return $result;
    }

    private function normalize(string $text): string
    {
        return strtolower(preg_replace('/[^a-z0-9\s]/i', '', $text));
    }

    private function extractKeywords(string $text): array
    {
        $stopWords = ['what', 'when', 'where', 'how', 'who', 'the', 'and', 'for', 'are', 'can', 'you', 'your', 'this', 'that', 'with', 'have', 'will'];
        $words = array_filter(
            explode(' ', $text),
            fn ($word) => strlen($word) > 3 && !in_array($word, $stopWords)
        );

        return array_values(array_unique($words));
    }

    private function buildFallback(): array
    {
        return [
            'answer' => self::FALLBACK_RESPONSE,
            'faq_id' => null,
            'confidence' => 0.0,
            'category' => 'fallback',
        ];
    }
}
