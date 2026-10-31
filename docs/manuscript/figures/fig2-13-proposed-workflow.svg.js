// Figure 2.13 Proposed Workflow as a swimlane chart (black and white, like the original figure).
// Usage: node wf_svg.js <out.svg>
const fs = require('fs')

const W = 1160, LANE = 285, TOP = 10, HEAD = 34, H = 1460
const lanes = ['Student Applicant', 'DSA Administrator', 'SWAP Recipient', 'Office Supervisor']
const cx = (i) => 15 + LANE * i + LANE / 2

const nodes = {}
const box = (id, x, y, text, w = 200, h = 46) => (nodes[id] = { kind: 'box', x, y, w, h, text })
const end = (id, x, y, text, w = 150, h = 34) => (nodes[id] = { kind: 'end', x, y, w, h, text })
const dia = (id, x, y, text, w = 150, h = 84) => (nodes[id] = { kind: 'dia', x, y, w, h, text })

// Student Applicant
const a = cx(0)
end('A1', a, 80, 'Start')
box('A2', a, 145, 'Create Account')
box('A3', a, 215, 'Confirm Email Code')
box('A4', a, 285, 'Fill Application Form')
box('A5', a, 360, 'Upload Requirements|COR, Grades, Letter, Photo')
box('A6', a, 440, 'Submit Application')

// DSA Administrator
const d = cx(1), dl = d - 72, dr = d + 72
box('D1', d, 440, 'Review Application|& Requirements')
box('D2', d, 515, 'Schedule Interview')
dia('D3', d, 610, 'Application|Decision')
box('D6', dl, 715, 'Set Status: Approved|Becomes Recipient', 116, 50)
box('D4', dr, 715, 'Notify Applicant', 116)
box('D7', dl, 795, 'Assign Office,|Supervisor & Hours', 116, 50)
end('D5', dr, 790, 'End - Rejected', 116)
dia('D8', d, 975, 'Stipend|Requirements Met?', 160, 90)
box('D9', dl, 1085, 'Release Stipend|Signed Stub', 116, 50)
box('D10', dr, 1085, 'Remind Recipient', 116)
box('D11', d, 1225, 'Review Renewal')
dia('D12', d, 1310, 'Renewal|Decision', 140, 76)
box('D13', dl, 1400, 'New Term|Assignment', 116, 46)
end('D14', dr, 1400, 'End - Not Renewed', 116)

// SWAP Recipient
const r = cx(2)
box('R1', r, 80, 'View Dashboard')
box('R2', r, 150, 'Scan Office QR|to Log Time-In')
dia('R3', r, 250, 'Allowed Time,|Inside Area?')
box('R4', r, 350, 'Perform Assigned Duties')
box('R5', r, 420, 'Write Task Description|& Log Time-Out')
box('R6', r, 495, 'System Saves Log Status:|Pending Verification')
dia('R7', r, 595, 'Semester|Ended?')
box('R8', r, 695, 'Submit End-of-Term|Report')
dia('R9', r, 795, 'Short on|Hours?')
box('R10', r, 895, 'File Promissory Note')
box('R11', r, 1140, 'Apply for Renewal')

// Office Supervisor
const s = cx(3), sl = s - 76, sr = s + 76
box('S1', s, 495, 'View Pending|Time Logs')
box('S2', s, 570, 'Review Time-In/Out|& Task Description')
dia('S3', s, 665, 'Log|Validation')
box('S4', sl, 765, 'Reject Log|with Reason', 128)
box('S5', sr, 765, 'Mark as Verified', 128)
box('S6', s, 860, 'Review End-of-Term Report|Eligible / Not Eligible', 210)
box('S7', s, 935, 'Approve or Reject|Promissory Note')

// ── edges: list of [x,y] points, optional label {x,y,t}, dashed ──
const top = (id) => [nodes[id].x, nodes[id].y - nodes[id].h / 2]
const bot = (id) => [nodes[id].x, nodes[id].y + nodes[id].h / 2]
const lft = (id) => [nodes[id].x - nodes[id].w / 2, nodes[id].y]
const rgt = (id) => [nodes[id].x + nodes[id].w / 2, nodes[id].y]
const edges = []
const e = (pts, label, dashed = false) => edges.push({ pts, label, dashed })
const down = (a, b) => e([bot(a), top(b)])

// Applicant
down('A1', 'A2'); down('A2', 'A3'); down('A3', 'A4'); down('A4', 'A5'); down('A5', 'A6')
e([rgt('A6'), lft('D1')])
// Admin: application
down('D1', 'D2'); down('D2', 'D3')
e([[d - 75, 610], [dl, 610], top('D6')], { x: dl - 8, y: 600, t: 'Approved', anchor: 'end' })
e([[d + 75, 610], [dr, 610], top('D4')], { x: dr + 8, y: 600, t: 'Rejected', anchor: 'start' })
down('D6', 'D7'); down('D4', 'D5')
// Assignment → recipient starts (up the lane gap, like the original figure)
e([bot('D7'), [dl, 840], [580, 840], [580, 80], lft('R1')])
// Recipient duty cycle
down('R1', 'R2'); down('R2', 'R3')
e([lft('R3'), [r - 125, 250], [r - 125, 150], lft('R2')], { x: r - 98, y: 242, t: 'No' })
e([bot('R3'), top('R4')], { x: r + 8, y: 307, t: 'Yes', anchor: 'start' })
down('R4', 'R5'); down('R5', 'R6'); down('R6', 'R7')
e([lft('R7'), [r - 135, 595], [r - 135, 160], [r - 100, 160]], { x: r - 98, y: 587, t: 'No' })
e([bot('R7'), top('R8')], { x: r + 8, y: 650, t: 'Yes', anchor: 'start' })
down('R8', 'R9')
e([bot('R9'), top('R10')], { x: r + 8, y: 852, t: 'Yes', anchor: 'start' })
// Logs to the supervisor (dotted, like "Logs sent for review")
e([rgt('R6'), lft('S1')], { x: 849, y: 458, t: 'Logs|sent', anchor: 'middle' }, true)
down('S1', 'S2'); down('S2', 'S3')
e([[s - 75, 665], [sl, 665], top('S4')], { x: sl - 8, y: 655, t: 'Invalid', anchor: 'end' })
e([[s + 75, 665], [sr, 665], top('S5')], { x: sr + 8, y: 655, t: 'Valid', anchor: 'start' })
// Report and promissory to the supervisor
e([rgt('R8'), [860, 695], [860, 860], lft('S6')])
e([rgt('R10'), [885, 895], [885, 935], lft('S7')])
// Supervisor decisions → stipend check
e([rgt('S6'), [s + 125, 860], [s + 125, 990], [s, 990]])
e([bot('S7'), [s, 1010], [575, 1010], [575, 975], rgt('D8')])
// Stipend
e([[d - 80, 975], [dl, 975], top('D9')], { x: dl - 8, y: 965, t: 'Yes', anchor: 'end' })
e([[d + 80, 975], [dr, 975], top('D10')], { x: dr + 8, y: 965, t: 'No', anchor: 'start' })
e([bot('D9'), [dl, 1140], lft('R11')])
// Renewal
e([bot('R11'), [r, 1225], rgt('D11')])
down('D11', 'D12')
e([[d - 70, 1310], [dl, 1310], top('D13')], { x: dl - 8, y: 1300, t: 'Approved', anchor: 'end' })
e([[d + 70, 1310], [dr, 1310], top('D14')], { x: dr + 8, y: 1300, t: 'Rejected', anchor: 'start' })

// ── draw ──
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (x, y, t, size = 12.5) => {
  const lines = t.split('|')
  const lh = size + 3
  const y0 = y - ((lines.length - 1) * lh) / 2
  return lines.map((l, i) => `<text x="${x}" y="${y0 + i * lh}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${esc(l)}</text>`).join('')
}
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#000"/></marker></defs>
<rect width="100%" height="100%" fill="#fff"/>`
lanes.forEach((l, i) => {
  const x = 15 + LANE * i
  out += `<rect x="${x}" y="${TOP}" width="${LANE}" height="${H - TOP - 10}" fill="#fff" stroke="#000" stroke-width="1.2"/>`
  out += `<text x="${x + 10}" y="${TOP + 20}" font-size="14" font-weight="bold">${l}</text>`
})
for (const ed of edges) {
  const d = ed.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  out += `<path d="${d}" fill="none" stroke="#000" stroke-width="1.1" ${ed.dashed ? 'stroke-dasharray="2,3"' : ''} marker-end="url(#ar)"/>`
  if (ed.label) ed.label.t.split('|').forEach((t, i) => { out += `<text x="${ed.label.x}" y="${ed.label.y + i * 13}" font-size="11.5" text-anchor="${ed.label.anchor ?? 'middle'}">${t}</text>` })
}
for (const n of Object.values(nodes)) {
  const { x, y, w, h } = n
  if (n.kind === 'box') out += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="1.2"/>`
  if (n.kind === 'end') out += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" stroke="#000" stroke-width="1.2"/>`
  if (n.kind === 'dia') out += `<path d="M${x},${y - h / 2} L${x + w / 2},${y} L${x},${y + h / 2} L${x - w / 2},${y} z" fill="#fff" stroke="#000" stroke-width="1.2"/>`
  out += text(x, y, n.text, n.w < 140 ? 11.5 : 12.5)
}
out += '</svg>'
fs.writeFileSync(process.argv[2], out)
console.log('wrote', process.argv[2])
