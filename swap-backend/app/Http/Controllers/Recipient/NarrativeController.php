<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreNarrativeRequest;
use App\Models\TimeLog;
use App\Resources\NarrativeResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NarrativeController extends Controller
{
    public function store(StoreNarrativeRequest $request): JsonResponse
    {
        $log = TimeLog::where('id', $request->integer('time_log_id'))
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$log) {
            return response()->json(['message' => 'Time log not found.'], 404);
        }

        if ($log->narrativeReport) {
            return response()->json(['message' => 'Narrative report already submitted for this log.'], 409);
        }

        $narrative = $log->narrativeReport()->create([
            'content' => $request->content,
            'activities_done' => $request->activities_done,
            'challenges' => $request->challenges,
            'submitted_at' => now(),
        ]);

        return response()->json([
            'data' => new NarrativeResource($narrative),
            'message' => 'Narrative report submitted successfully.',
        ], 201);
    }

    public function show(Request $request, int $logId): JsonResponse
    {
        $log = TimeLog::where('id', $logId)
            ->where('user_id', $request->user()->id)
            ->with('narrativeReport')
            ->first();

        if (!$log) {
            return response()->json(['message' => 'Time log not found.'], 404);
        }

        if (!$log->narrativeReport) {
            return response()->json(['message' => 'No narrative report for this log.'], 404);
        }

        return response()->json(['data' => new NarrativeResource($log->narrativeReport)]);
    }
}
