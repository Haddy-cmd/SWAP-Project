'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'

export type HeroPhoto = { src: string; caption: string }

/**
 * Full-bleed hero backdrop: crossfading campus photos with a slow drift, a row of
 * progress bars (click to jump), the current caption + counter, and prev / play /
 * next controls. `children` (nav + headline) render above the photo veil.
 */
export function HeroSlideshow({
  photos,
  intervalSec = 6,
  children,
}: {
  photos: HeroPhoto[]
  intervalSec?: number
  children: ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const count = photos.length
  const duration = intervalSec * 1000

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count])

  // Re-armed on every slide change, so a manual jump restarts the full interval.
  useEffect(() => {
    if (!playing || count <= 1) return
    const t = setTimeout(() => go(index + 1), duration)
    return () => clearTimeout(t)
  }, [index, playing, count, duration, go])

  const current = photos[index]

  return (
    <>
      {/* Photos */}
      <div className="absolute inset-0" aria-hidden>
        {photos.map((p, k) => (
          <div
            key={p.src}
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
            style={{ opacity: k === index ? 1 : 0, zIndex: k === index ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              // Remount on activation so the drift restarts from the beginning.
              key={k === index ? `on-${index}` : 'off'}
              src={p.src}
              alt=""
              className="hero-drift h-full w-full object-cover"
              style={{ animation: k === index ? `swapDrift ${duration + 1500}ms linear forwards` : 'none' }}
            />
          </div>
        ))}
      </div>

      {/* Veil: dark on the left and bottom so the copy and controls stay legible. */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,32,20,.86) 0%, rgba(10,32,20,.6) 38%, rgba(10,32,20,.08) 72%), linear-gradient(0deg, rgba(10,32,20,.75) 0%, rgba(10,32,20,0) 38%)',
        }}
      />
      {/* Fixed-height top scrim so the nav stays legible on bright photos at any hero height. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-40"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,32,20,.78) 0%, rgba(10,32,20,.45) 55%, rgba(10,32,20,0) 100%)',
        }}
      />

      {children}

      {/* Progress bars · caption · controls */}
      <div className="absolute inset-x-5 bottom-7 z-[3] flex items-end justify-between gap-5 sm:inset-x-14 sm:bottom-9 sm:gap-7">
        <div className="flex max-w-[360px] flex-1 gap-2">
          {photos.map((p, k) => (
            <button
              key={p.src}
              type="button"
              onClick={() => go(k)}
              aria-label={`Show photo ${k + 1}: ${p.caption}`}
              className="flex h-[22px] flex-1 cursor-pointer items-center"
            >
              <span className="relative block h-[2px] w-full overflow-hidden bg-ink-25/30">
                <span
                  key={k === index ? `a-${index}-${playing}` : `s-${k}`}
                  className="absolute inset-y-0 left-0 bg-gold-400"
                  style={{
                    width: k < index || (k === index && !playing) ? '100%' : 0,
                    animation: k === index && playing ? `swapFill ${duration}ms linear forwards` : 'none',
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden text-right leading-[1.45] sm:block" aria-live="polite">
            <div className="font-serif text-[15px] italic text-ink-25">{current.caption}</div>
            <div className="text-[11.5px] tabular-nums text-ink-25/60">
              {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Previous photo', onClick: () => go(index - 1), icon: <ArrowLeft className="h-[18px] w-[18px]" /> },
              {
                label: playing ? 'Pause slideshow' : 'Play slideshow',
                onClick: () => setPlaying((p) => !p),
                icon: playing ? <Pause className="h-[18px] w-[18px]" /> : <Play className="h-[18px] w-[18px]" />,
              },
              { label: 'Next photo', onClick: () => go(index + 1), icon: <ArrowRight className="h-[18px] w-[18px]" /> },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={b.onClick}
                aria-label={b.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-25/35 text-ink-25 transition-colors hover:bg-ink-25/10"
              >
                {b.icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
