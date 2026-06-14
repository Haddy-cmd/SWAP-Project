<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Services\ChatbotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatbotController extends Controller
{
    public function __construct(private readonly ChatbotService $chatbotService) {}

    public function query(Request $request): JsonResponse
    {
        $request->validate([
            'message' => ['required', 'string', 'min:2', 'max:500'],
        ]);

        $result = $this->chatbotService->processQuery($request->message);

        return response()->json(['data' => $result]);
    }
}
