<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            // Relative path within the documents disk (e.g. "documents/2/abc123.jpg").
            // Allows serving files through an API route instead of relying on public symlinks.
            $table->string('file_path')->nullable()->after('document_type');
        });

        // Back-fill existing rows: extract the relative path from the stored file_url.
        // Existing URLs look like "https://…/storage/documents/2/abc.jpg".
        DB::table('application_documents')
            ->whereNull('file_path')
            ->whereNotNull('file_url')
            ->get()
            ->each(function ($doc) {
                $parsed = parse_url($doc->file_url, PHP_URL_PATH); // e.g. /storage/documents/2/abc.jpg
                $relative = $parsed ? ltrim(preg_replace('#^/storage/#', '', $parsed), '/') : null;
                if ($relative) {
                    DB::table('application_documents')
                        ->where('id', $doc->id)
                        ->update(['file_path' => $relative]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn('file_path');
        });
    }
};
