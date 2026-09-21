<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\ReleaseStipendRequest;
use App\Http\Requests\Stipend\VoidStipendRequest;
use App\Models\StipendHistory;
use App\Resources\StipendResource;
use App\Services\StipendClaimService;
use App\Services\StipendService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StipendController extends Controller
{
    public function __construct(
        private readonly StipendService $stipendService,
        private readonly StipendClaimService $claimService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $records = $this->stipendService->paginateAll(
            $request->only(['status', 'academic_year'])
        );

        return response()->json([
            'data' => StipendResource::collection($records->items()),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
            ],
        ]);
    }

    public function eligible(): JsonResponse
    {
        return response()->json([
            'data' => $this->stipendService->eligibleRecipients(),
        ]);
    }

    /**
     * Release a claim stub for an eligible recipient: creates + certifies it in one
     * step, produces the downloadable stub, and notifies the student it's ready.
     */
    public function release(ReleaseStipendRequest $request): JsonResponse
    {
        $data = $request->safe()->except(['password', 'signature_image']);
        if ($request->hasFile('signature_image')) {
            $data['signature_image_path'] = $request->file('signature_image')
                ->store('stipend-signatures', config('filesystems.documents_disk', 'public'));
        }

        $stipend = $this->claimService->releaseClaimStub($data, $request->user());

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Claim stub released. The recipient has been notified that it is ready to claim.',
        ], 201);
    }

    public function void(VoidStipendRequest $request, int $id): JsonResponse
    {
        $stipend = StipendHistory::findOrFail($id);

        $stipend = $this->claimService->void($stipend, $request->validated()['reason'], $request->user());

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Stipend voided.',
        ]);
    }
}
