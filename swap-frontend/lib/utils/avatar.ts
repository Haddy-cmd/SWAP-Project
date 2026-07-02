/**
 * Build the <img src> for a user's avatar. The backend returns the base URL
 * (no token) and the photo is streamed through an authenticated endpoint, so we
 * append the current auth token as a query param. Returns null when there's no
 * avatar or no token (caller falls back to the initial).
 */
export function avatarSrc(avatarUrl?: string | null, token?: string | null): string | null {
  if (!avatarUrl || !token) return null
  const sep = avatarUrl.includes('?') ? '&' : '?'
  return `${avatarUrl}${sep}token=${encodeURIComponent(token)}`
}
