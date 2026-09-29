<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Photos for the landing page carousel, managed by admins (Admin → Landing Page).
 *
 * Built-in photos ship with the frontend (/public) and are referenced by path.
 * Admin uploads are stored in the database itself: on the free-tier host the
 * server disk is wiped at every deploy, the database is not. Uploads are resized
 * to ≤1600 px (a few hundred KB) and capped in number, so the table stays small.
 *
 * Seeds the 18 photos the carousel shipped with, once — after that the admin can
 * reorder, hide or delete them freely.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_photos', function (Blueprint $table) {
            $table->id();
            $table->string('caption', 160);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            // Built-in photo: a path the frontend serves, e.g. "/campus-9.jpg".
            $table->string('bundled_path')->nullable();
            // Uploaded photo: the resized JPEG, base64-encoded (Laravel binds values as
            // text, which Postgres bytea rejects for raw image bytes).
            $table->longText('image_base64')->nullable();
            $table->string('mime_type', 40)->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('byte_size')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });

        $builtIn = [
            ['/campus.jpg', 'DSA Mental Health Celebration, 2025'],
            ['/campus-9.jpg', 'SWAP registration desk at the Division of Student Affairs'],
            ['/campus-15.jpg', 'Student ushers at Ladiawan, DSA in Action'],
            ['/campus-2.jpg', 'Office of Admissions, waiting area'],
            ['/campus-10.jpg', 'Mental Health Celebration 2025, program host on stage'],
            ['/campus-14.jpg', 'Students waiting in the DSA lobby'],
            ['/campus-3.jpg', 'Preparing event materials at the DSA office'],
            ['/campus-16.jpg', 'DSA staff with a student usherette'],
            ['/campus-11.jpg', '“Ikanta mo ’yan” open mic, Mental Health Celebration'],
            ['/campus-4.jpg', 'Mental Health Celebration, on stage'],
            ['/campus-6.jpg', 'Mental health talk with students'],
            ['/campus-17.jpg', 'Student ushers with DSA staff after the program'],
            ['/campus-12.jpg', 'Certificate awarding, Mental Health Celebration 2025'],
            ['/campus-1.jpg', 'DSA staff at the Mental Health Celebration'],
            ['/campus-13.jpg', 'Students leading an activity on stage'],
            ['/campus-5.jpg', 'Mental Health Celebration, awarding'],
            ['/campus-7.jpg', 'Students at “The Mind Unload” session'],
            ['/campus-8.jpg', 'Group photo, Mental Health Celebration 2025'],
        ];

        $now = now();
        DB::table('landing_photos')->insert(array_map(fn ($row, $i) => [
            'bundled_path' => $row[0],
            'caption' => $row[1],
            'sort_order' => $i + 1,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ], $builtIn, array_keys($builtIn)));
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_photos');
    }
};
