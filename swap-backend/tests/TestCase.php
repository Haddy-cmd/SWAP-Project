<?php

namespace Tests;

use App\Support\TestTools;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // The System Testing switch is memoised statically; each test starts from its own database.
        TestTools::flush();
    }
}
