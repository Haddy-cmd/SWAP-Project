<?php

namespace Tests\Concerns;

/**
 * Minimal reader for DomPDF output: lists the images a page actually draws, whether
 * each kept its alpha as an SMask, and how many pixels read as dark ink once that
 * alpha is composited onto white paper — enough to prove a transparent signature is
 * visibly on the page (no rasterizer needed).
 */
trait InspectsPdfImages
{
    /**
     * Images drawn on the page, keyed "WxH".
     *
     * @return array<string, array{draws: int, smask: bool, visible_px: int}>
     */
    protected function pdfImages(string $pdf): array
    {
        $objs = $this->pdfStreamObjects($pdf);

        // Resource name (/I2) → object id, from every /XObject << … >> dictionary.
        $names = [];
        preg_match_all('#/XObject\s*<<(.*?)>>#s', $pdf, $blocks);
        foreach ($blocks[1] as $block) {
            preg_match_all('#/(\w+)\s+(\d+) 0 R#', $block, $pairs, PREG_SET_ORDER);
            foreach ($pairs as $p) {
                $names[$p[1]] = (int) $p[2];
            }
        }

        // "/I2 Do" operators in the (Flate-compressed) page content streams.
        $draws = [];
        foreach ($objs as $o) {
            if (str_contains($o['dict'], '/Subtype /Image')) {
                continue;
            }
            $content = @gzuncompress($o['raw']);
            preg_match_all('#/(\w+) Do\b#', $content === false ? $o['raw'] : $content, $ops);
            foreach ($ops[1] as $name) {
                if (isset($names[$name])) {
                    $draws[$names[$name]] = ($draws[$names[$name]] ?? 0) + 1;
                }
            }
        }

        $images = [];
        foreach ($draws as $id => $count) {
            if (!isset($objs[$id]) || !str_contains($objs[$id]['dict'], '/Subtype /Image')) {
                continue;
            }
            [$w, $h, $colors, $px] = $this->pdfDecodeImage($objs[$id]);
            $alpha = preg_match('#/SMask (\d+) 0 R#', $objs[$id]['dict'], $sm) ? $this->pdfDecodeImage($objs[(int) $sm[1]])[3] : null;

            $visible = 0;
            for ($i = 0, $n = $w * $h; $i < $n; $i++) {
                $o = $i * $colors;
                $lum = $colors >= 3
                    ? 0.299 * ord($px[$o]) + 0.587 * ord($px[$o + 1]) + 0.114 * ord($px[$o + 2])
                    : ord($px[$o]);
                $a = $alpha === null ? 1.0 : ord($alpha[$i]) / 255;
                if ($lum * $a + 255 * (1 - $a) < 128) {
                    $visible++;
                }
            }

            $images["{$w}x{$h}"] = ['draws' => $count, 'smask' => $alpha !== null, 'visible_px' => $visible];
        }

        return $images;
    }

    /** @return array<int, array{dict: string, raw: string}> every object that has a stream */
    private function pdfStreamObjects(string $pdf): array
    {
        // Slice at each "N 0 obj" header so a stream-less object never swallows the next.
        preg_match_all('#(?<=[\r\n])(\d+) 0 obj\b#', $pdf, $hdr, PREG_OFFSET_CAPTURE);
        $objs = [];
        $count = count($hdr[0]);
        for ($k = 0; $k < $count; $k++) {
            $from = $hdr[0][$k][1];
            $chunk = substr($pdf, $from, ($k + 1 < $count ? $hdr[0][$k + 1][1] : strlen($pdf)) - $from);
            if (!preg_match('#stream\r?\n#', $chunk, $sm, PREG_OFFSET_CAPTURE)) {
                continue;
            }
            $dict = preg_replace('/\s+/', ' ', substr($chunk, 0, $sm[0][1]));
            if (preg_match('#/Length (\d+)#', $dict, $len)) {
                $objs[(int) $hdr[1][$k][0]] = ['dict' => $dict, 'raw' => substr($chunk, $sm[0][1] + strlen($sm[0][0]), (int) $len[1])];
            }
        }

        return $objs;
    }

    /** @return array{0: int, 1: int, 2: int, 3: string} width, height, colour components, raw 8-bit pixels */
    private function pdfDecodeImage(array $obj): array
    {
        preg_match('#/Width (\d+)#', $obj['dict'], $w);
        preg_match('#/Height (\d+)#', $obj['dict'], $h);
        $colors = str_contains($obj['dict'], '/DeviceRGB') ? 3 : 1;
        $data = gzuncompress($obj['raw']);

        if (str_contains($obj['dict'], '/Predictor')) {
            $data = $this->pngUnpredict($data, (int) $w[1] * $colors, $colors);
        }

        return [(int) $w[1], (int) $h[1], $colors, $data];
    }

    /** Undo PNG row filters (Predictor ≥ 10): each row is prefixed by its filter type. */
    private function pngUnpredict(string $data, int $rowLen, int $bpp): string
    {
        $out = '';
        $prev = array_fill(0, $rowLen, 0);
        for ($pos = 0, $n = strlen($data); $pos < $n; $pos += $rowLen + 1) {
            $type = ord($data[$pos]);
            $cur = [];
            for ($i = 0; $i < $rowLen; $i++) {
                $x = ord($data[$pos + 1 + $i]);
                $a = $i >= $bpp ? $cur[$i - $bpp] : 0;
                $b = $prev[$i];
                $c = $i >= $bpp ? $prev[$i - $bpp] : 0;
                $x += match ($type) {
                    1 => $a,
                    2 => $b,
                    3 => intdiv($a + $b, 2),
                    4 => (function () use ($a, $b, $c) {
                        $p = $a + $b - $c;
                        [$pa, $pb, $pc] = [abs($p - $a), abs($p - $b), abs($p - $c)];

                        return ($pa <= $pb && $pa <= $pc) ? $a : ($pb <= $pc ? $b : $c);
                    })(),
                    default => 0,
                };
                $cur[$i] = $x & 0xFF;
            }
            $out .= pack('C*', ...$cur);
            $prev = $cur;
        }

        return $out;
    }
}
