// Generates the dark theme block in app/globals.css from the light palette in its @theme.
// Run after changing a palette colour:  node scripts/theme-dark.mjs
//
// How the dark palette is built (so a colour works both as a fill and as text):
//   ink (neutrals)          inverted by hand below: canvas/surfaces dark, text light
//   tints 50–200            the colour mixed into the dark surface (pill and badge fills)
//   300–500                 unchanged (300 is the bright gold/ring shade used on the green chrome)
//   600–950                 mid tones (still saturated: white text on them stays readable)
//   text-<colour>-500…950   brightened by the overrides at the end (readable on dark)
// Everything sits inside `@media screen`, so printing always uses the light palette, and a
// `data-theme="light"` element (printouts, signature/QR backings) gets the light values back.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../app/globals.css', import.meta.url)
const START = '/* @generated dark-theme:start — scripts/theme-dark.mjs */'
const END = '/* @generated dark-theme:end */'

const css = readFileSync(FILE, 'utf8')
const theme = css.slice(css.indexOf('@theme {'), css.indexOf('}', css.indexOf('@theme {')))
const light = Object.fromEntries([...theme.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((m) => [m[1], m[2].toUpperCase()]))

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v * t + y[i] * (1 - t))) }

const SURFACE = '#17211B'
const dark = {
  // Neutrals: page, cards, lines, then text from quiet to strong.
  'ink-25': '#0C140F', 'ink-50': '#121C16', 'ink-100': '#1F2C24', 'ink-200': '#2B3A31', 'ink-300': '#3B4C41',
  'ink-350': '#5A695F', 'ink-400': '#7E8C83', 'ink-500': '#9DA9A1', 'ink-600': '#B7C1BA', 'ink-700': '#CED6D0',
  'ink-800': '#DEE4DF', 'ink-900': '#E9EEEA', 'ink-950': '#F2F5F2',
  surface: SURFACE, 'surface-2': '#1C2821', 'surface-3': '#233129', canvas: '#0F1712',
  accent: '#1F8A63', 'accent-hover': '#2BAE7E', 'accent-strong': '#48B488', 'accent-deep': '#1F6B4B',
  'accent-bright': '#34B486', 'accent-muted': '#3A5247',
  'red-accent': '#E0544B', 'red-strong': '#EF8A82',
}
dark['accent-soft'] = mix('#239A6F', SURFACE, 0.24)
dark['accent-tint'] = mix('#239A6F', SURFACE, 0.13)

// Text colours set inline (style={{ color: … }}) read --text-<token>: the colour itself in light,
// the brightened text tone in dark. scripts' codemod points inline `color`/`fg` values at them.
const ACCENT_TEXT = { accent: '#5CCB9E', 'accent-hover': '#7AD6B0', 'accent-strong': '#8FDCBB', 'accent-deep': '#8FDCBB', 'accent-bright': '#7AD6B0', 'red-strong': '#F19A92', 'red-accent': '#F08077', 'gold-accent': '#E6C649' }

const SCALES = ['brand', 'maroon', 'gold', 'success', 'warning', 'danger', 'info', 'violet']
for (const s of SCALES) {
  const v = (n) => light[`${s}-${n}`]
  const base = v(600)
  dark[`${s}-50`] = mix(base, SURFACE, 0.14)
  dark[`${s}-100`] = mix(base, SURFACE, 0.22)
  dark[`${s}-200`] = mix(base, SURFACE, 0.34)
  dark[`${s}-600`] = mix(v(500), v(600), 0.5)
  dark[`${s}-700`] = mix(v(500), v(600), 0.65)
  dark[`${s}-800`] = mix(v(500), v(600), 0.4)
  if (v(900)) dark[`${s}-900`] = v(600)
  if (v(950)) dark[`${s}-950`] = v(700)
}

// Text in these colours, brightened for a dark background.
const textTone = (s, n) => (s === 'gold' ? light['gold-300'] : n <= 600 ? light[`${s}-300`] : n <= 800 ? light[`${s}-200`] : light[`${s}-100`])
const esc = (c) => c.replace(/[:/[\]#.]/g, (m) => `\\${m}`)
const textRules = []
const scope = ':where([data-theme=dark]) '
// Not inside a light island, and not dark text sitting on a bright gold fill (badges, gold buttons).
const notLight = ':not(:where([data-theme=light], [data-theme=light] *)):not([class*="bg-gold-3"], [class*="bg-gold-4"], [class*="bg-gold-5"], [class*="bg-gold-accent"], [class*="from-gold-"], [class*="btn-gold"], [class*="pill-gold"])'
const addText = (cls, color) => {
  textRules.push(`  ${scope}.${esc(cls)}${notLight} { color: ${color}; }`)
  textRules.push(`  ${scope}.${esc(`hover:${cls}`)}:hover${notLight} { color: ${color}; }`)
  textRules.push(`  ${scope}.group:hover .${esc(`group-hover:${cls}`)}${notLight} { color: ${color}; }`)
}
for (const s of SCALES) for (const n of [500, 600, 700, 800, 900, 950]) if (light[`${s}-${n}`]) addText(`text-${s}-${n}`, textTone(s, n))
addText('text-accent', '#5CCB9E')
addText('text-accent-hover', '#7AD6B0')
addText('text-accent-strong', '#8FDCBB')
addText('text-accent-deep', '#8FDCBB')
addText('text-red-strong', '#F19A92')
addText('text-red-accent', '#F08077')

const textTokens = []
for (const s of SCALES) for (const n of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) if (light[`${s}-${n}`]) textTokens.push([`${s}-${n}`, n >= 500 ? textTone(s, n) : null])
for (const [k, val] of Object.entries(ACCENT_TEXT)) textTokens.push([k, val])
for (const k of Object.keys(light)) if (k.startsWith('ink-') || k.startsWith('surface') || k === 'canvas' || k === 'cream' || k === 'accent-soft' || k === 'accent-tint' || k === 'accent-muted') textTokens.push([k, null])
const textVars = (dk) => textTokens.map(([k, val]) => `    --text-${k}: ${dk && val ? val : `var(--color-${k})`};`).join('\n')

const vars = (map) => Object.entries(map).map(([k, val]) => `    --color-${k}: ${val};`).join('\n')
const lightBack = Object.fromEntries(Object.keys(dark).map((k) => [k, light[k]]).filter(([, val]) => val))

const block = `${START}
:root {
${textVars(false)}
}
@media screen {
  :root[data-theme=dark] {
${vars(dark)}
    --hero-gradient: radial-gradient(110% 150% at 100% 0%, rgba(221,187,56,.16), transparent 45%),
      radial-gradient(90% 120% at 0% 100%, rgba(47,165,124,.18), transparent 55%),
      linear-gradient(120deg, #0A3A26 0%, #062A1B 55%, #051F14 100%);
    --hero-gradient-plain: linear-gradient(120deg, #0A3A26, #062A1B);
    --shadow-color: 0, 0, 0;
    --ambient-lift: rgba(255,255,255,0);
    --splash-veil: rgba(15,23,18,.86);
${textVars(true)}
    color-scheme: dark;
  }

  /* Printouts and signature/QR backings keep the light palette inside a dark page. */
  [data-theme=light] {
${vars(lightBack)}
    --hero-gradient-plain: linear-gradient(120deg, #0B5234, #063D27);
    color-scheme: light;
    color: var(--color-ink-900);
${textVars(false)}
  }

${textRules.join('\n')}
}
${END}`

const i = css.indexOf(START)
const next = i >= 0 ? css.slice(0, i) + block + css.slice(css.indexOf(END) + END.length) : `${css.trimEnd()}\n\n${block}\n`
writeFileSync(FILE, next)
console.log(`dark theme: ${Object.keys(dark).length} colours, ${textRules.length} text rules`)
