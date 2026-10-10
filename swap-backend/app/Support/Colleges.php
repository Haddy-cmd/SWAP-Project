<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/** The official college/program list (config/colleges.php) and the one-time cleanup of older saved values. */
class Colleges
{
    public const MSG_COLLEGE = 'Choose your college from the list.';

    public const MSG_PROGRAM = "Choose a program from your college's list.";

    /** @return list<string> */
    public static function codes(): array
    {
        return array_keys(config('colleges'));
    }

    /** @return list<string> */
    public static function programsOf(?string $code): array
    {
        return config("colleges.{$code}.programs", []);
    }

    public static function label(?string $code): ?string
    {
        return $code ? config("colleges.{$code}.label") : null;
    }

    /** Old code → official code (renames and values that were never MSU colleges). */
    public const COLLEGE_MAP = [
        'CA' => 'COA',
        'CF' => 'CFAS',
        'CSST' => 'CICS',
        'CAS' => 'CNSM',
        'College of Information and Computing Sciences' => 'CICS',
    ];

    /**
     * [official college, old program] → official program. A list spreads the rows across
     * several programs (by profile id) where the old value named no specific major.
     */
    public const PROGRAM_MAP = [
        'COA' => [
            'BS Agriculture' => 'BS Agriculture major in Agronomy',
            'BS Food Technology' => 'BSA major in Food Processing',
            'BS Agribusiness' => 'BS Agribusiness Management',
        ],
        'CICS' => [
            'BSCS' => 'BS Computer Science',
            'BSIT' => 'BS Information Technology (Database Systems)',
            'BS Information Technology' => ['BS Information Technology (Database Systems)', 'BS Information Technology (Network Systems)'],
        ],
        'CNSM' => [
            'BSMATH' => 'BS Mathematics',
            'BS Biology' => 'BS Biology (Animal Biology)',
        ],
        'CBAA' => [
            'BS Management Accounting' => 'BS Accountancy',
            'BS Business Administration' => 'BSBA Business Economics',
        ],
        'CED' => [
            'BSED' => 'BSEd English',
            'Bachelor of Elementary Education' => 'Bachelor of Elementary Education (BEEd)',
            'Bachelor of Secondary Education' => ['BSEd English', 'BSEd Filipino', 'BSEd Mathematics', 'BSEd Sciences', 'BSEd Social Studies'],
            'Bachelor of Special Needs Education' => 'Bachelor of Early Childhood Education (BECEd)',
        ],
        'CoE' => [
            'BS Computer Engineering' => 'BS Electronics Engineering',
        ],
        'CSPEAR' => [
            'Bachelor of Physical Education' => 'BS Physical Education',
            'BS Exercise and Sports Sciences' => 'BS Physical Education',
        ],
        'CSSH' => [
            'AB Political Science' => 'BA Political Science',
            'AB Communication' => 'AB Communication Studies major in Journalism',
            'AB English' => 'BA English Language Studies',
            'AB History' => 'BA History Philippine and Asian History Track',
        ],
        'KFCIAAS' => [
            'AB Arabic Language' => 'BS Teaching Arabic',
            'AB Islamic Studies' => 'AB Islamic Studies major in Shariah',
        ],
    ];

    /**
     * Rewrites saved student profiles to the official codes and program names. Safe to run
     * again (already-official rows are untouched). Returns how many rows changed.
     */
    public static function normalize(): int
    {
        $changed = 0;
        DB::transaction(function () use (&$changed) {
            foreach (self::COLLEGE_MAP as $old => $new) {
                $changed += DB::table('student_profiles')->where('college', $old)->update(['college' => $new]);
            }
            foreach (self::PROGRAM_MAP as $college => $programs) {
                foreach ($programs as $old => $new) {
                    $rows = DB::table('student_profiles')->where('college', $college)->where('program', $old)->pluck('id');
                    foreach ($rows as $id) {
                        $target = is_array($new) ? $new[$id % count($new)] : $new;
                        $changed += DB::table('student_profiles')->where('id', $id)->update(['program' => $target]);
                    }
                }
            }
        });

        return $changed;
    }
}
