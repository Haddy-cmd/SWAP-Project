<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The office code carried no meaning of its own — it existed to name a
     * deploy-time logo file at /offices/{code}.png. Now that offices upload a
     * real logo, the code has nothing left to do.
     */
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->string('logo_path')->nullable()->after('name');
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->dropIndex(['code']);
            $table->dropUnique(['code']);
            $table->dropColumn('code');
        });
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn('logo_path');
            // Re-created nullable: the original values are gone, and a unique
            // NOT NULL column cannot be added back to populated rows.
            $table->string('code', 20)->nullable();
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->index('code');
        });
    }
};
