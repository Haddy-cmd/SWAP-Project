/**
 * The text to show for a failed API call: the first field error, else the backend's
 * message (the API client already surfaces it verbatim), else the fallback.
 */
export function errorText(err: unknown, fallback: string): string {
  const e = err as { message?: string; errors?: Record<string, string[] | string> } | null | undefined
  const first = e?.errors ? Object.values(e.errors).flat()[0] : undefined
  return (typeof first === 'string' && first) || e?.message || fallback
}
