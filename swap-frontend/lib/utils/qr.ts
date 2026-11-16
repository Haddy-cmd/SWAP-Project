/**
 * The office token inside whatever was scanned or typed. The printed office QR holds the full
 * "https://…/scan?t=<token>" link (so a phone camera opens the scan page); the in-app scanner
 * reads that same link, and someone may paste it into "Enter the code instead". The server
 * accepts both too (QrCodeService::tokenFrom).
 */
export function qrTokenFrom(text: string): string {
  const raw = text.trim()
  if (/^https?:\/\//i.test(raw)) {
    try {
      const t = new URL(raw).searchParams.get('t')
      if (t) return t.trim()
    } catch {
      /* not a valid URL: use the text as it is */
    }
  }
  return raw
}
