<?php

namespace App\Http\Middleware;

use App\Support\TestTools;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin → System Testing exists only where SWAP_TEST_TOOLS allows it (config swap.test_tools,
 * off on the live server). Elsewhere its API answers 404 as if it weren't there.
 */
class EnsureTestToolsAvailable
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!TestTools::available()) {
            return response()->json(['message' => TestTools::MSG_UNAVAILABLE], 404);
        }

        return $next($request);
    }
}
