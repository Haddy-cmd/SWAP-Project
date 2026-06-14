<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            OfficeSeeder::class,
            FaqSeeder::class,
            AssignmentSeeder::class,
        ]);
    }
}
