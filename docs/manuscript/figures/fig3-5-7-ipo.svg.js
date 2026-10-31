// IPO figures (3.5–3.7) in the template style: dark-blue tabs, grey arrows, rounded bullet boxes.
// Usage: node ipo_svg.js <outDir>   → fig3-5-ipo-account.svg, fig3-6-ipo-time.svg, fig3-7-ipo-reports.svg
const fs = require('fs')
const path = require('path')

const FIGS = {
  'fig3-5-ipo-account': {
    input: ['Name, Student ID, College, Program & Year Level', 'Institutional Email', 'Password', 'Email Verification Code'],
    process: ['Data validation', 'Send 6-digit email code', 'Verify the code', 'User profile creation', 'Store to database'],
    output: ['Applicant Account Created', 'Signed in automatically'],
  },
  'fig3-6-ipo-time': {
    input: ['Office QR Code', 'GPS Location', 'Selfie (if required)', 'Task Description', "Supervisor's Decision"],
    process: ['Check office, day & time', 'Check geofence', 'Record time-in/out', 'Compute duration', 'Verify or reject log'],
    output: ['Time Logs', 'Verified Hours', 'Duty Slip', 'Term Result'],
  },
  'fig3-7-ipo-reports': {
    input: ['Report Type', 'Term (Year & Semester)', 'Filters & Sorting', 'Download Request'],
    process: ['Check role access', 'Filter & group records', 'Compute totals & charts', 'Generate PDF/CSV', 'Record in audit log'],
    output: ['On-screen Tables & Charts', 'PDF Report', 'CSV File'],
  },
}

const BLUE = '#1F5C80', BORDER = '#1F5C80', GREY = '#A7B4BF', FONT = "Cambria, 'Times New Roman', serif"
const SIZE = 17, LH = 21, CHARS = 19 // wrap width in characters
const COL = 250, GAP = 50, TAB_H = 40, BOX_W = 180, PAD = 14

function wrap(text) {
  const words = text.split(' '), lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > CHARS && cur) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  return lines
}
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')

for (const [name, fig] of Object.entries(FIGS)) {
  const cols = [['Input', fig.input], ['Process', fig.process], ['Output', fig.output]]
  const wrapped = cols.map(([, items]) => items.map(wrap))
  const linesIn = (w) => w.reduce((n, l) => n + l.length, 0) + (w.length - 1) * 0.25
  const boxH = Math.max(150, Math.ceil(Math.max(...wrapped.map(linesIn)) * LH + PAD * 2 + 26))
  const W = COL * 3 + GAP * 2 + 10, H = TAB_H + boxH + 22
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}"><rect width="100%" height="100%" fill="#fff"/>`
  cols.forEach(([title], i) => {
    const x = 5 + i * (COL + GAP)
    // tab
    svg += `<path d="M${x},4 h${COL - 8} q8,0 8,8 v${TAB_H - 4} h-${COL} z" fill="${BLUE}"/>`
    svg += `<text x="${x + 12}" y="${4 + TAB_H / 2 + 2}" font-size="20" fill="#fff" dominant-baseline="middle">${title}</text>`
    // arrow to the next tab
    if (i < 2) {
      const ax = x + COL + 8, ay = 4 + TAB_H / 2
      svg += `<path d="M${ax},${ay - 10} h18 v-10 l16,20 l-16,20 v-10 h-18 z" fill="${GREY}"/>`
    }
    // bullet box
    const bx = x + (COL - BOX_W) / 2 + 14, by = 4 + TAB_H - 10
    svg += `<rect x="${bx}" y="${by}" width="${BOX_W}" height="${boxH}" rx="14" fill="#fff" stroke="${BORDER}" stroke-width="2.5"/>`
    const w = wrapped[i]
    const total = linesIn(w) * LH
    let y = i === 2 ? by + (boxH - total) / 2 + LH / 2 : by + PAD + 18
    for (const item of w) {
      item.forEach((line, k) => {
        if (k === 0) svg += `<text x="${bx + 12}" y="${y}" font-size="${SIZE}" dominant-baseline="middle">•</text>`
        svg += `<text x="${bx + 24}" y="${y}" font-size="${SIZE}" dominant-baseline="middle">${esc(line)}</text>`
        y += LH
      })
      y += LH * 0.25
    }
  })
  svg += '</svg>'
  fs.writeFileSync(path.join(process.argv[2], `${name}.svg`), svg)
  console.log('wrote', name)
}
