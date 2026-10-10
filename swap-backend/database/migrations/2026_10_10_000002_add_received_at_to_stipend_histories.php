<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When the recipient first opened (viewed or downloaded) their released stub. The stub stays
 * `released`; admins see "Received {date}" / "Not yet opened" in Stipend → History.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stipend_history', function (Blueprint $table) {
            $table->timestamp('received_at')->nullable()->after('released_at');
        });
    }

    public function down(): void
    {
        Schema::table('stipend_history', function (Blueprint $table) {
            $table->dropColumn('received_at');
        });
    }
};
