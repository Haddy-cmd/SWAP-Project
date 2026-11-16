<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rejected applicants:
 * - applications.rejection_reason: the DSA's reason category (App\Support\RejectionReasons);
 * - application_documents.purged_at: when a rejected applicant's uploaded file was removed
 *   once a newer semester started (applications:purge-rejected-documents).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('rejection_reason', 40)->nullable()->after('remarks');
        });

        Schema::table('application_documents', function (Blueprint $table) {
            $table->timestamp('purged_at')->nullable()->after('mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('rejection_reason');
        });

        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn('purged_at');
        });
    }
};
