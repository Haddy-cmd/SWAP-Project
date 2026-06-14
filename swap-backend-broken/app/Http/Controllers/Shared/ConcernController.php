<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Concern;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConcernController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $concern = Concern::create([
            'user_id' => $request->user()->id,
            'subject' => $request->subject,
            'message' => $request->message,
        ]);

        return response()->json([
            'data' => $concern,
            'message' => 'Your concern has been submitted. The DSA Office will respond shortly.',
        ], 201);
    }
}
