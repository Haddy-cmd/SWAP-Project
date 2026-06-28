<?php

namespace App\Services;

use App\Models\FaqKnowledgeBase;
use Illuminate\Support\Facades\Http;

class ChatbotService
{
    private const FALLBACK_RESPONSE = 'Thank you for your question. For assistance, please contact the DSA Office at Mindanao State University – Marawi. You may visit the office during working hours (Monday–Friday, 8:00 AM – 5:00 PM) or call the DSA at +63-63-352-xxxx.';

    public function processQuery(string $message): array
    {
        $normalized = $this->normalize($message);
        $inputWords = $this->extractKeywords($normalized);

        if (empty($inputWords)) {
            return $this->buildFallback();
        }

        $faqs = FaqKnowledgeBase::active()->get();
        $bestMatch = null;
        $bestScore = 0;

        foreach ($faqs as $faq) {
            $keywords = array_merge(
                $faq->keywords ?? [],
                $this->extractKeywords($this->normalize($faq->question))
            );

            $overlap = count(array_intersect($inputWords, $keywords));

            if ($overlap > $bestScore) {
                $bestScore = $overlap;
                $bestMatch = $faq;
            }
        }

        if ($bestMatch && $bestScore >= 1) {
            return [
                'answer' => $bestMatch->answer,
                'faq_id' => $bestMatch->id,
                'confidence' => min(round($bestScore / max(count($inputWords), 1), 2), 1.0),
                'category' => $bestMatch->category,
            ];
        }

        return $this->buildFallback();
    }

    public function processQueryWithAI(string $message): array
    {
        $apiKey = config('swap.gemini_key');

        // No key configured → fall back to the local keyword FAQ matcher.
        if (empty($apiKey)) {
            return $this->processQuery($message);
        }

        $context = FaqKnowledgeBase::active()
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($f) => "Q: {$f->question}\nA: {$f->answer}")
            ->join("\n\n");

        $systemPrompt = 'You are a helpful assistant for the Student Welfare Assistantship Program (SWAP) at '
            . "Mindanao State University – Marawi. Answer using only the FAQ knowledge base below. If the question "
            . "is not covered, advise the student to contact the DSA Office. Keep answers concise, friendly, and in "
            . "plain language.\n\n{$context}";

        $model = config('swap.gemini_model', 'gemini-2.0-flash');

        // Google Gemini (AI Studio) generateContent endpoint. The key goes in the
        // x-goog-api-key header so it never lands in URL/proxy logs.
        $response = Http::withHeaders([
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
            ],
        ]);

        // Gemini unreachable, rate-limited, or rejected the key → keyword fallback.
        if ($response->failed()) {
            return $this->processQuery($message);
        }

        $text = $response->json('candidates.0.content.parts.0.text', '');

        // Empty or safety-blocked completion → fall back rather than reply blank.
        if (empty($text)) {
            return $this->processQuery($message);
        }

        return [
            'answer' => $text,
            'faq_id' => null,
            'confidence' => 0.9,
            'category' => 'ai',
        ];
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
