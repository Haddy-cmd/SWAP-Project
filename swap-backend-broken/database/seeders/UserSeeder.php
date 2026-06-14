<?php

namespace Database\Seeders;

use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'name' => 'DSA Administrator',
            'email' => 'admin@msu-marawi.edu.ph',
            'password' => Hash::make('Admin@12345'),
            'role' => 'admin',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $sup1 = User::create([
            'name' => 'Prof. Sittie Hadja',
            'email' => 'supervisor1@msu-marawi.edu.ph',
            'password' => Hash::make('Super@12345'),
            'role' => 'supervisor',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $sup2 = User::create([
            'name' => 'Prof. Omar Macabato',
            'email' => 'supervisor2@msu-marawi.edu.ph',
            'password' => Hash::make('Super@12345'),
            'role' => 'supervisor',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $applicants = [
            ['name' => 'Ali Hassan', 'email' => 'ali@student.msu-marawi.edu.ph', 'sid' => '2020-0001', 'college' => 'CSST', 'program' => 'BSCS', 'year' => 3],
            ['name' => 'Fatima Macarambong', 'email' => 'fatima@student.msu-marawi.edu.ph', 'sid' => '2020-0002', 'college' => 'CSST', 'program' => 'BSIT', 'year' => 2],
            ['name' => 'Amir Alonto', 'email' => 'amir@student.msu-marawi.edu.ph', 'sid' => '2021-0003', 'college' => 'CED', 'program' => 'BSED', 'year' => 2],
        ];

        foreach ($applicants as $data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make('Student@12345'),
                'role' => 'applicant',
                'is_active' => true,
                'email_verified_at' => now(),
            ]);

            $names = explode(' ', $data['name']);
            StudentProfile::create([
                'user_id' => $user->id,
                'student_id_number' => $data['sid'],
                'first_name' => $names[0],
                'last_name' => $names[1] ?? 'Student',
                'college' => $data['college'],
                'program' => $data['program'],
                'year_level' => $data['year'],
                'gpa' => round(mt_rand(175, 200) / 50, 2),
            ]);
        }

        $recipients = [
            ['name' => 'Norhana Macarimbang', 'email' => 'norhana@student.msu-marawi.edu.ph', 'sid' => '2019-0004', 'college' => 'CAS', 'program' => 'BSMATH', 'year' => 4],
            ['name' => 'Ibrahim Disomimba', 'email' => 'ibrahim@student.msu-marawi.edu.ph', 'sid' => '2019-0005', 'college' => 'CSST', 'program' => 'BSCS', 'year' => 4],
        ];

        foreach ($recipients as $data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make('Student@12345'),
                'role' => 'recipient',
                'is_active' => true,
                'email_verified_at' => now(),
            ]);

            $names = explode(' ', $data['name']);
            StudentProfile::create([
                'user_id' => $user->id,
                'student_id_number' => $data['sid'],
                'first_name' => $names[0],
                'last_name' => $names[1] ?? 'Student',
                'college' => $data['college'],
                'program' => $data['program'],
                'year_level' => $data['year'],
                'gpa' => round(mt_rand(175, 200) / 50, 2),
            ]);
        }
    }
}
