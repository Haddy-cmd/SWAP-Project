/**
 * The UI is built on Tailwind CSS v4, which needs Chrome/Edge 111+, Safari/iOS 16.4+, Firefox 128+
 * (current Samsung Internet and Opera too). Older browsers would get a broken layout, so this
 * runs in <head> before paint and, when the needed CSS is missing, marks <html class="unsupported">:
 * globals.css then shows only the plain #browser-notice (components/layout/BrowserNotice.tsx).
 *
 * `?browsercheck=fail` forces the notice, for testing it on a modern browser.
 * Written in ES5 on purpose: it must run in the very browsers it turns away.
 */
export const BROWSER_CHECK_SCRIPT = `(function(){try{var ok=!!(window.CSS&&CSS.supports&&CSS.supports('color','color-mix(in srgb, red, blue)')&&CSS.supports('selector(:where(a))'));if(/[?&]browsercheck=fail/.test(location.search))ok=false;if(!ok)document.documentElement.className+=' unsupported';}catch(e){document.documentElement.className+=' unsupported';}})();`
