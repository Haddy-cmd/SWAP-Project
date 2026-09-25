'use client'

import { useEffect, useState } from 'react'

/**
 * Crossfading hero slideshow. Cycles through `images` every `interval` ms.
 * Any image that fails to load (file not added yet) is dropped automatically,
 * so missing files never show as a blank maroon slide.
 */
export function HeroCarousel({ images, interval = 2500 }: { images: string[]; interval?: number }) {
  const [available, setAvailable] = useState<string[]>(images)
  const [index, setIndex] = useState(0)

  // Auto-advance only when there's more than one usable image.
  useEffect(() => {
    if (available.length <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % available.length), interval)
    return () => clearInterval(id)
  }, [available.length, interval])

  // Keep the active index in range if the list shrinks.
  useEffect(() => {
    setIndex((i) => (i >= available.length ? 0 : i))
  }, [available.length])

  const dropBroken = (src: string) => setAvailable((prev) => prev.filter((s) => s !== src))

  return (
    <>
      {available.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          onError={() => dropBroken(src)}
          className={`hero-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Green gradient veil */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg, rgba(22,69,43,0.42) 0%, rgba(16,51,31,0.30) 45%, rgba(11,39,22,0.62) 100%)' }}
      />

      {/* Slide dots */}
      {available.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {available.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-gold-300' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </>
  )
}
