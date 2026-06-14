<?php

use App\Models\Assignment;
use App\Services\QrCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('generates a valid QR token for an assignment', function () {
    $assignment = Assignment::factory()->create([
        'qr_secret' => Str::random(64),
    ]);

    $service = new QrCodeService();
    $token = $service->generateForAssignment($assignment);

    expect($token)->toBeString()->not->toBeEmpty();
    expect(substr_count($token, '.'))->toBe(1);
});

it('validates a correct token and returns the assignment', function () {
    $assignment = Assignment::factory()->create([
        'qr_secret' => Str::random(64),
    ]);

    $service = new QrCodeService();
    $token = $service->generateForAssignment($assignment->fresh());

    $result = $service->validate($token);

    expect($result)->not->toBeNull();
    expect($result->id)->toBe($assignment->id);
});

it('rejects a tampered token', function () {
    $assignment = Assignment::factory()->create([
        'qr_secret' => Str::random(64),
    ]);

    $service = new QrCodeService();
    $token = $service->generateForAssignment($assignment->fresh());

    $tamperedToken = $token . 'tampered';

    expect($service->validate($tamperedToken))->toBeNull();
});

it('rejects token after secret regeneration', function () {
    $assignment = Assignment::factory()->create([
        'qr_secret' => Str::random(64),
    ]);

    $service = new QrCodeService();
    $oldToken = $service->generateForAssignment($assignment->fresh());

    $service->regenerateSecret($assignment->fresh());

    expect($service->validate($oldToken))->toBeNull();
});
