<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Audit\AuditLogQueryRequest;
use App\Models\AuditLog;
use App\Services\AuditLogService;
use App\Support\CsvDownload;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;

/** Admin → Audit Logs, and the History panels on single records. */
class AuditLogController extends Controller
{
    public function __construct(private readonly AuditLogService $audit) {}

    public function index(AuditLogQueryRequest $request): JsonResponse
    {
        return response()->json($this->audit->list($this->filters($request)));
    }

    /** Audit Logs → CSV: every entry the page's filters match (not just one page), audited like the report downloads. */
    public function export(AuditLogQueryRequest $request)
    {
        $filters = $this->filters($request);
        $count = $this->audit->query($filters)->count();
        if ($count > AuditLogService::EXPORT_LIMIT) {
            return response()->json(['message' => AuditLogService::msgExportTooMany($count)], 422);
        }

        AuditLog::record('report_exported', $request->user(), null, [
            'type' => 'audit-log', 'format' => 'csv', 'rows' => $count,
        ] + array_filter(Arr::except($filters, ['page']), fn ($v) => $v !== null && $v !== '' && $v !== false));

        return CsvDownload::stream(
            'audit-log-' . now('Asia/Manila')->format('Ymd') . '.csv',
            AuditLogService::EXPORT_HEADINGS,
            $this->audit->exportRows($filters),
        );
    }

    private function filters(AuditLogQueryRequest $request): array
    {
        $filters = $request->validated();
        $filters['sensitive'] = $request->boolean('sensitive');
        $filters['include_testing'] = $request->boolean('include_testing');

        return $filters;
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->audit->options()]);
    }
}
