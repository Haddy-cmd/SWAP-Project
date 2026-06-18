/** Institutional program seal — a maroon crest with a gold ring and mortarboard. */
export function Seal({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="42" fill="#531010" />
      <circle cx="44" cy="44" r="42" fill="none" stroke="#D8B65A" strokeWidth="2.5" />
      <circle cx="44" cy="44" r="34" fill="none" stroke="#D8B65A" strokeOpacity="0.4" />
      <path d="M22 42 l22 -11 l22 11 l-22 11 z" fill="#D8B65A" />
      <path d="M44 53 v11 M56 47 v10" stroke="#D8B65A" strokeWidth="1.6" fill="none" />
    </svg>
  )
}
