<?php

namespace App\Repositories;

use App\Models\StipendHistory;
use App\Models\StipendSignature;
use App\Repositories\Contracts\StipendClaimRepositoryInterface;

class StipendClaimRepository implements StipendClaimRepositoryInterface
{
    public function findById(int $id): ?StipendHistory
    {
        return StipendHistory::with(['recipient.profile', 'certifiedBy', 'releasedBy', 'signatures'])->find($id);
    }

    public function findByClaimToken(string $token): ?StipendHistory
    {
        return StipendHistory::with(['recipient.profile', 'signatures'])
            ->where('claim_token', $token)
            ->first();
    }

    public function update(StipendHistory $stipend, array $data): StipendHistory
    {
        $stipend->update($data);

        return $stipend->fresh(['recipient.profile', 'certifiedBy', 'releasedBy', 'signatures']);
    }

    public function addSignature(StipendHistory $stipend, array $data): StipendSignature
    {
        return $stipend->signatures()->create($data);
    }

    public function controlNumberExists(string $controlNumber): bool
    {
        return StipendHistory::where('control_number', $controlNumber)->exists();
    }
}
