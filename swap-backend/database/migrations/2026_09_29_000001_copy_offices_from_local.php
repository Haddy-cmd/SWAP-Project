<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-time copy of the host offices set up on the development database (names,
 * heads, map pins, radius, capacity) into the live database, which runs every
 * migration on deploy. An office whose name already exists is left exactly as it
 * is, so nothing an admin changed on the live site is overwritten.
 *
 * Not copied: logos (the files live only on the development machine; re-upload
 * on Admin → Offices), supervisors (accounts differ per database), and QR codes
 * (each office gets a fresh signed QR the first time one is requested).
 */
return new class extends Migration
{
    private const OFFICES = [
        [
            'name' => 'Division of Student Affairs',
            'description' => 'Manages student welfare programs and activities.',
            'head_name' => 'Dr. Amerah Abutazil',
            'location' => 'Main Building, Ground Floor',
            'max_recipients' => 50, 'is_active' => true,
            'latitude' => 7.99907699, 'longitude' => 124.25887191, 'radius_meters' => 50,
        ],
        [
            'name' => 'University Library',
            'description' => 'Provides library and information services to the university community.',
            'head_name' => 'Mrs. Saidamen Pangcoga',
            'location' => 'Library Building',
            'max_recipients' => 50, 'is_active' => true,
            'latitude' => 7.99864458, 'longitude' => 124.25956929, 'radius_meters' => 50,
        ],
        [
            'name' => 'Office of the Registrar',
            'description' => 'Handles student records, enrollment, and academic credentials.',
            'head_name' => 'Mr. Macmod Disangcopan',
            'location' => 'Administration Building, 2nd Floor',
            'max_recipients' => 50, 'is_active' => true,
            'latitude' => 7.99892294, 'longitude' => 124.25888264, 'radius_meters' => 50,
        ],
        [
            'name' => 'Information and Communication Technology Center',
            'description' => 'Manages ICT infrastructure and provides technical support.',
            'head_name' => 'Engr. Hadji Guimba',
            'location' => 'Technology Building',
            'max_recipients' => 50, 'is_active' => true,
            'latitude' => 7.99824085, 'longitude' => 124.25936544, 'radius_meters' => 50,
        ],
        [
            'name' => 'University Banking Office',
            'description' => 'Manages university finances, budgets, and student financial transactions.',
            'head_name' => 'Mrs. Bai Macarandag',
            'location' => 'Administration Building, 1st Floor',
            'max_recipients' => 50, 'is_active' => false,
            'latitude' => 7.99901006, 'longitude' => 124.25888264, 'radius_meters' => 50,
        ],
        [
            'name' => 'Campo Ranao St.',
            'description' => null,
            'head_name' => 'Norhadi M. Norodin',
            'location' => 'Campo Ranao St. Marawi City',
            'max_recipients' => 50, 'is_active' => true,
            'latitude' => 8.00831200, 'longitude' => 124.28526700, 'radius_meters' => 20,
        ],
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::OFFICES as $office) {
            $exists = DB::table('offices')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($office['name'])])
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('offices')->insert($office + [
                'geofence_enabled' => true,
                'auto_clock_out' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Data copy only: offices may have assignments by now, so nothing is removed.
    }
};
