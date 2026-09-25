/** Institutional program seal — a maroon crest with a gold ring and mortarboard. */
export function Seal({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="42" fill="#7A181C" />
      <circle cx="44" cy="44" r="42" fill="none" stroke="#F2CC4B" strokeWidth="2.5" />
      <circle cx="44" cy="44" r="34" fill="none" stroke="#F2CC4B" strokeOpacity="0.4" />
      <path d="M22 42 l22 -11 l22 11 l-22 11 z" fill="#F2CC4B" />
      <path d="M44 53 v11 M56 47 v10" stroke="#F2CC4B" strokeWidth="1.6" fill="none" />
    </svg>
  )
}
