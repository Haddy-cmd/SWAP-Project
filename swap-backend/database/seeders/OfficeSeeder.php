<?php

namespace Database\Seeders;

use App\Models\Office;
use Illuminate\Database\Seeder;

class OfficeSeeder extends Seeder
{
    public function run(): void
    {
        $offices = [
            ['name' => 'Office of the Dean of Students Affairs', 'code' => 'ODS', 'description' => 'Manages student welfare programs and activities.', 'head_name' => 'Dr. Amerah Abutazil', 'location' => 'Main Building, Ground Floor', 'max_recipients' => 8],
            ['name' => 'University Library', 'code' => 'LIB', 'description' => 'Provides library and information services to the university community.', 'head_name' => 'Mrs. Saidamen Pangcoga', 'location' => 'Library Building', 'max_recipients' => 6],
            ['name' => 'Office of the Registrar', 'code' => 'REG', 'description' => 'Handles student records, enrollment, and academic credentials.', 'head_name' => 'Mr. Macmod Disangcopan', 'location' => 'Administration Building, 2nd Floor', 'max_recipients' => 5],
            ['name' => 'Information Technology Center', 'code' => 'ITC', 'description' => 'Manages ICT infrastructure and provides technical support.', 'head_name' => 'Engr. Hadji Guimba', 'location' => 'Technology Building', 'max_recipients' => 4],
            ['name' => 'Finance and Accounting Office', 'code' => 'FAO', 'description' => 'Manages university finances, budgets, and student financial transactions.', 'head_name' => 'Mrs. Bai Macarandag', 'location' => 'Administration Building, 1st Floor', 'max_recipients' => 5],
        ];

        foreach ($offices as $office) {
            Office::create(array_merge($office, ['is_active' => true]));
        }
    }
}
