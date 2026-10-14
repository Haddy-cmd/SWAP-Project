<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // System Testing is on in tests (SWAP_TEST_TOOLS defaults on outside production); tests of "off" turn it off.
        config(['swap.test_tools' => true]);
        // Uploads never touch the real storage folder; tests that need a clean disk fake it again.
        Storage::fake(config('filesystems.documents_disk', 'public'));
    }
}
