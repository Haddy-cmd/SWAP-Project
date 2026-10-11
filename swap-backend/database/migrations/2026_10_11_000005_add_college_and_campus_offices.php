<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-time addition of the college and campus host offices to every database (the live
 * one runs each migration on deploy). Only names are set: the admin fills in the head,
 * location, map pin and capacity on Admin → Offices. An office whose name already exists
 * is left exactly as it is, so nothing changed on the live site is overwritten.
 *
 * No map pin yet, so clock-in there is refused ("no location configured") until one is set.
 * Each office gets a fresh signed QR the first time one is requested.
 */
return new class extends Migration
{
    public const NAMES = [
        // The colleges on the registration list (config/colleges.php).
        'College of Agriculture',
        'College of Business Administration and Accountancy',
        'College of Education',
        'College of Engineering',
        'College of Fisheries and Aquatic Sciences',
        'College of Forestry and Environmental Studies',
        'College of Health Sciences',
        'College of Hospitality and Tourism Management',
        'College of Information and Computing Sciences',
        'College of Natural Sciences and Mathematics',
        'College of Public Affairs',
        'College of Social Sciences and Humanities',
        'College of Sports, Physical Education and Recreation',
        'Division of Engineering Technology',
        'King Faisal Center for Islamic, Arabic and Asian Studies',
        // Campus offices.
        'Office of the Vice Chancellor for Academic Affairs',
        'Office of Admission',
        'Scholarship Center',
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::NAMES as $name) {
            $exists = DB::table('offices')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('offices')->insert([
                'name' => $name,
                'max_recipients' => 50,
                'is_active' => true,
                'geofence_enabled' => false,
                'auto_clock_out' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Data addition only: offices may have assignments by now, so nothing is removed.
    }
};
