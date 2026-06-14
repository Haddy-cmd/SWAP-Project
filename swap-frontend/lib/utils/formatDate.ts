const PHT_OPTIONS: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila' }

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    ...PHT_OPTIONS,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    ...PHT_OPTIONS,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    ...PHT_OPTIONS,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function formatRelative(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const absDiff = Math.abs(diff)

  if (absDiff < 60) return rtf.format(Math.round(diff), 'second')
  if (absDiff < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (absDiff < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}
