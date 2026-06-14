<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("DROP TYPE IF EXISTS user_role CASCADE");
        DB::statement("CREATE TYPE user_role AS ENUM ('applicant', 'recipient', 'supervisor', 'admin')");

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        DB::statement("ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'applicant'");
        DB::statement('CREATE INDEX users_role_idx ON users (role)');
        DB::statement('CREATE INDEX users_is_active_idx ON users (is_active)');
        DB::statement('CREATE INDEX users_deleted_at_idx ON users (deleted_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        DB::statement('DROP TYPE IF EXISTS user_role');
    }
};
