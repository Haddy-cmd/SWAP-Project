<?php

namespace App\Support;

use App\Http\Controllers\Shared\ReportController;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A streamed CSV download for the admin's list exports (Stipend History, Audit Logs):
 * a BOM so Excel reads UTF-8 names, and every cell made formula-safe (ReportController::csvSafe).
 */
class CsvDownload
{
    /**
     * @param list<string> $headings
     * @param iterable<list<mixed>> $rows each row in the order of $headings
     */
    public static function stream(string $filename, array $headings, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headings, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $headings);
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($cell) => ReportController::csvSafe($cell), $row));
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
