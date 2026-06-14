<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use Illuminate\Http\Response;

class QrCodeController extends Controller
{
    public function show($assignmentId)
    {
        $assignment = Assignment::find($assignmentId);

        if (!$assignment || !$assignment->qr_code) {
            return response()->json(['message' => 'QR code not found'], 404);
        }

        $svg = $this->generateQrCodeSvg($assignment->qr_code);

        return response()->json([
            'assignment_id' => $assignment->id,
            'user' => $assignment->user->name,
            'qr_code_data' => $assignment->qr_code,
            'qr_code_svg' => $svg,
        ]);
    }

    public function render($assignmentId)
    {
        $assignment = Assignment::find($assignmentId);

        if (!$assignment || !$assignment->qr_code) {
            abort(404, 'QR code not found');
        }

        $svg = $this->generateQrCodeSvg($assignment->qr_code);

        $html = <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>QR Code - {$assignment->user->name}</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 500px;
                }
                h1 {
                    color: #333;
                    margin: 0 0 10px 0;
                    font-size: 24px;
                }
                p {
                    color: #666;
                    margin: 5px 0;
                }
                .qr-code {
                    margin: 30px 0;
                    padding: 20px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                .qr-code svg {
                    max-width: 100%;
                    height: auto;
                }
                .info {
                    background: #f0f4ff;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-size: 14px;
                    color: #666;
                }
                .button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    text-decoration: none;
                    display: inline-block;
                }
                .button:hover {
                    background: #764ba2;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Assignment QR Code</h1>
                <p><strong>{$assignment->user->name}</strong></p>
                <p>Academic Year: {$assignment->academic_year}</p>
                <p>Semester: {$assignment->semester}</p>

                <div class="qr-code">
                    {$svg}
                </div>

                <div class="info">
                    📱 Scan this QR code with your phone camera or QR code reader to log your time or attendance.
                </div>

                <button class="button" onclick="window.print()">🖨️ Print QR Code</button>
            </div>
        </body>
        </html>
        HTML;

        return response($html)->header('Content-Type', 'text/html');
    }

    private function generateQrCodeSvg($data): string
    {
        $size = 200;
        $modules = $this->encodeQr($data);
        $moduleSize = $size / count($modules);

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $size . '" height="' . $size . '">';

        foreach ($modules as $y => $row) {
            foreach ($row as $x => $module) {
                if ($module) {
                    $px = $x * $moduleSize;
                    $py = $y * $moduleSize;
                    $svg .= '<rect x="' . $px . '" y="' . $py . '" width="' . $moduleSize . '" height="' . $moduleSize . '" fill="black"/>';
                }
            }
        }

        $svg .= '</svg>';
        return $svg;
    }

    private function encodeQr($text): array
    {
        $size = 21;
        $modules = array_fill(0, $size, array_fill(0, $size, false));

        for ($i = 0; $i < strlen($text); $i++) {
            $byte = ord($text[$i]);
            for ($bit = 0; $bit < 8; $bit++) {
                $x = ($i * 8 + $bit) % $size;
                $y = intdiv($i * 8 + $bit, $size);
                if ($y < $size) {
                    $modules[$y][$x] = ($byte & (128 >> $bit)) != 0;
                }
            }
        }

        return $modules;
    }
}
