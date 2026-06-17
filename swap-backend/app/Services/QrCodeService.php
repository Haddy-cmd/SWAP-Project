<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\Office;
use Illuminate\Support\Str;

class QrCodeService
{
    public function generateForOffice(Office $office): string
    {
        if (empty($office->qr_secret)) {
            $office->update(['qr_secret' => Str::random(64)]);
        }

        $payload = base64_encode(json_encode([
            'office_id' => $office->id,
            'issued_at' => now()->toISOString(),
        ]));

        $signature = $this->sign($payload, $office->qr_secret);

        $token = "{$payload}.{$signature}";
        $office->update(['qr_code' => $token]);

        return $token;
    }

    public function validateOffice(string $token): ?Office
    {
        $lastDot = strrpos($token, '.');
        if ($lastDot === false) {
            return null;
        }

        $payload = substr($token, 0, $lastDot);
        $signature = substr($token, $lastDot + 1);

        $decoded = json_decode(base64_decode($payload), true);
        if (!$decoded || empty($decoded['office_id'])) {
            return null;
        }

        $office = Office::find($decoded['office_id']);
        if (!$office || empty($office->qr_secret)) {
            return null;
        }

        $expectedSignature = $this->sign($payload, $office->qr_secret);

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        return $office;
    }


    public function generateForAssignment(Assignment $assignment): string
    {
        if (empty($assignment->qr_secret)) {
            $assignment->update(['qr_secret' => Str::random(64)]);
        }

        $payload = base64_encode(json_encode([
            'assignment_id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'issued_at' => now()->toISOString(),
        ]));

        $signature = $this->sign($payload, $assignment->qr_secret);

        $token = "{$payload}.{$signature}";
        $assignment->update(['qr_code' => $token]);

        return $token;
    }

    public function validate(string $token): ?Assignment
    {
        $lastDot = strrpos($token, '.');
        if ($lastDot === false) {
            return null;
        }

        $payload = substr($token, 0, $lastDot);
        $signature = substr($token, $lastDot + 1);

        $decoded = json_decode(base64_decode($payload), true);
        if (!$decoded || empty($decoded['assignment_id'])) {
            return null;
        }

        $assignment = Assignment::find($decoded['assignment_id']);
        if (!$assignment || empty($assignment->qr_secret)) {
            return null;
        }

        $expectedSignature = $this->sign($payload, $assignment->qr_secret);

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        return $assignment;
    }

    public function regenerateSecret(Assignment $assignment): string
    {
        $newSecret = Str::random(64);
        $assignment->update(['qr_secret' => $newSecret, 'qr_code' => null]);

        return $this->generateForAssignment($assignment->fresh());
    }

    private function sign(string $payload, string $secret): string
    {
        return hash_hmac('sha256', $payload, $secret);
    }
}
