<?php

use App\Support\Colleges;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data only: saved student colleges/programs → the official masterlist (config/colleges.php).
 * College of Agriculture becomes COA, Fisheries CFAS; old demo values (CSST, CAS, "BSCS"…) are mapped
 * to their official equivalents (App\Support\Colleges::COLLEGE_MAP / PROGRAM_MAP).
 */
return new class extends Migration
{
    public function up(): void
    {
        Colleges::normalize();
    }

    /** Only the two code renames go back; program names stay official. */
    public function down(): void
    {
        DB::table('student_profiles')->where('college', 'COA')->update(['college' => 'CA']);
        DB::table('student_profiles')->where('college', 'CFAS')->update(['college' => 'CF']);
    }
};
