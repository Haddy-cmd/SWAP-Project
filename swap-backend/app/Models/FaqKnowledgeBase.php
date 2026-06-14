<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FaqKnowledgeBase extends Model
{
    use HasFactory;

    protected $table = 'faq_knowledge_base';

    protected $fillable = [
        'category',
        'question',
        'answer',
        'keywords',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByCategory($query, string $category)
    {
        return $query->where('category', $category);
    }
}
