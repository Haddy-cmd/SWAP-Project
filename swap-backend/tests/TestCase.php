<?php

namespace Tests;

use App\Support\TestTools;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // The System Testing switch is memoised statically; each test starts from its own database.
        TestTools::flush();
        // Uploads never touch the real storage folder; tests that need a clean disk fake it again.
        Storage::fake(config('filesystems.documents_disk', 'public'));
    }
}
