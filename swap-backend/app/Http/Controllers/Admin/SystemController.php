<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\TestTools;
use Illuminate\Http\JsonResponse;

/**
 * The admin sidebar's flag: whether System Testing is on on this server (SWAP_TEST_TOOLS).
 * The sidebar shows "System Testing" only then (its own API answers 404 while off).
 */
class SystemController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => ['test_tools_available' => TestTools::available()]]);
    }
}
