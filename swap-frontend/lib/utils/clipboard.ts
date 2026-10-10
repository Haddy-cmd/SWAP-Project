/**
 * Copy text in every browser. `navigator.clipboard` only exists on HTTPS/localhost (not on a plain
 * http LAN address) and can be refused, so this falls back to a hidden textarea + execCommand.
 * Returns whether it worked.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.fontSize = '16px' // no iOS zoom
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
