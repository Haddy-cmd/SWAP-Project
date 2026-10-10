// Shared look for the Profile page (layout "SWAP Profile v2").

export const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-surface shadow-[0_1px_3px_rgba(20,40,30,.05)]'
export const INPUT =
  'h-11 w-full rounded-[11px] border border-ink-200 bg-surface px-3.5 text-sm text-ink-900 placeholder-ink-350 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400'
export const LABEL = 'mb-1.5 block text-[12.5px] font-semibold text-ink-600'
export const BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[11px] bg-accent px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60'
export const BTN_GHOST =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-ink-200 bg-surface px-4 text-[13.5px] font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-60'

/** "0917 123 4567" → "09171234567"; the API strips the same characters. */
export const normalizePhone = (v: string) => v.replace(/[\s-]/g, '')
export const PHONE_OK = (v: string) => /^09\d{9}$/.test(normalizePhone(v))
export const PHONE_MESSAGE = 'Use 11 digits, e.g. 0917 123 4567.'

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24); if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const longDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
