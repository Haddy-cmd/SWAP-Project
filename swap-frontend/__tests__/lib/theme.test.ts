import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_BOOT_SCRIPT, THEME_KEY, applyTheme, getChoice, setChoice } from '@/lib/theme'

/** Pretend the device prefers dark (or light). */
function deviceDark(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: dark && q.includes('dark'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('theme (lib/theme.ts)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => vi.restoreAllMocks())

  it('follows the device while on System (the default)', () => {
    deviceDark(true)
    expect(getChoice()).toBe('system')
    expect(applyTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    deviceDark(false)
    expect(applyTheme()).toBe('light')
  })

  it('remembers an explicit choice and System clears it', () => {
    deviceDark(false)
    setChoice('dark')
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getChoice()).toBe('dark')

    setChoice('system')
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('falls back to the device when storage is unavailable', () => {
    deviceDark(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(getChoice()).toBe('system')
    expect(applyTheme()).toBe('dark')
  })

  it('the boot script applies the stored theme before React loads', () => {
    deviceDark(false)
    window.localStorage.setItem(THEME_KEY, 'dark')
    new Function(THEME_BOOT_SCRIPT)()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
