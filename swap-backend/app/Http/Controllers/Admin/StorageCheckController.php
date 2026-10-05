<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\StorageCheckService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin → System Testing → File storage (works with the System Testing switch off). */
class StorageCheckController extends Controller
{
    public function show(Request $request, StorageCheckService $check): JsonResponse
    {
        return response()->json(['data' => $check->run($request->getHost())]);
    }
}
