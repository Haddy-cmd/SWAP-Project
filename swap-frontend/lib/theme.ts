/**
 * Light / Dark / System theme, remembered per browser. The choice lives in localStorage
 * (`swap-theme`); the applied theme is `data-theme` on <html>, which app/globals.css reads.
 * `THEME_BOOT_SCRIPT` runs in <head> before the page paints, so there's no flash of the
 * wrong theme. Storage can be unavailable (private window): then it just follows the device.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'swap-theme'
export const THEME_EVENT = 'swap-theme-change'

export function getChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolve(choice: ThemeChoice): Theme {
  return choice === 'system' ? systemTheme() : choice
}

export function applyTheme(choice: ThemeChoice = getChoice()): Theme {
  const theme = resolve(choice)
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

export function setChoice(choice: ThemeChoice): Theme {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, choice)
  } catch { /* not remembered; still applied for this page */ }
  const theme = applyTheme(choice)
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { choice, theme } }))
  return theme
}

/** Inline in <head>: same logic as applyTheme, before React loads. */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');}catch(e){}var d=c==='dark'||(c!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');})();`
