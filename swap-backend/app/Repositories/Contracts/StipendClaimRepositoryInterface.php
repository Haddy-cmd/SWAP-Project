<?php

namespace App\Repositories\Contracts;

use App\Models\StipendHistory;
use App\Models\StipendSignature;

interface StipendClaimRepositoryInterface
{
    public function findById(int $id): ?StipendHistory;

    /** Resolve a claim by its single-use token (for the Banking Office verify endpoint). */
    public function findByClaimToken(string $token): ?StipendHistory;

    public function update(StipendHistory $stipend, array $data): StipendHistory;

    public function addSignature(StipendHistory $stipend, array $data): StipendSignature;

    /** True while no live stipend row exists for this recipient + period (control-number uniqueness aside). */
    public function controlNumberExists(string $controlNumber): bool;
}
