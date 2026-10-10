<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Audit\AuditLogQueryRequest;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;

/** Admin → Audit Logs, and the History panels on single records. */
class AuditLogController extends Controller
{
    public function __construct(private readonly AuditLogService $audit) {}

    public function index(AuditLogQueryRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $filters['sensitive'] = $request->boolean('sensitive');
        $filters['include_testing'] = $request->boolean('include_testing');

        return response()->json($this->audit->list($filters));
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->audit->options()]);
    }
}
