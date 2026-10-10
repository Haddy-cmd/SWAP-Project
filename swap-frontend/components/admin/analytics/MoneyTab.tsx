'use client'

import Link from 'next/link'
import { ArrowRight, Wallet } from 'lucide-react'
import { GOLD, GREEN, READY, Card, Skeleton, plural, useAnalytics, type TabProps } from './shared'

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

/**
 * Stipend & renewals: where the term's renewals stand (approved / ready / blocked and why),
 * the stipends, and the term's results. Term-result tiles open the Term Results report.
 */
export function MoneyTab({ academicYear, semester, onDrill }: TabProps) {
  const { insights, loading } = useAnalytics(academicYear, semester)
  if (loading && !insights) return <div className="grid gap-5 lg:grid-cols-2"><Skeleton h="h-80" /><Skeleton h="h-80" /></div>
  if (!insights) return null

  const r = insights.renewals
  const ready = r.waiting_reasons.find((w) => w.reason === READY)?.count ?? 0
  const blockedReasons = r.waiting_reasons.filter((w) => w.reason !== READY)
  const blocked = blockedReasons.reduce((s, w) => s + w.count, 0)
  const st = insights.stipend
  const tr = insights.term_results
  const nothingPaid = st.released === 0 && st.ready_to_release === 0 && st.missing_requirements === 0

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card title="Renewals"
        hint={r.submitted ? `${plural(r.submitted, 'returning student applied', 'returning students applied')} · ${r.approved} approved${r.rejected ? ` · ${r.rejected} rejected` : ''}` : 'No renewals this semester yet.'}>
        {r.submitted > 0 && (
          <>
            <div className="mt-[18px] flex h-7 gap-[3px] overflow-hidden rounded-lg bg-[#EEF1EC]">
              {r.approved > 0 && <div style={{ flex: r.approved, background: GREEN }} title={`Approved: ${r.approved}`} />}
              {ready > 0 && <div style={{ flex: ready, background: '#9CC9B5' }} title={`Ready to approve: ${ready}`} />}
              {blocked > 0 && <div style={{ flex: blocked, background: GOLD }} title={`Blocked: ${blocked}`} />}
              {r.rejected > 0 && <div style={{ flex: r.rejected, background: '#D9DDD5' }} title={`Rejected: ${r.rejected}`} />}
            </div>
            <div className="mt-3.5 flex flex-col text-[13.5px]">
              {[
                ['Approved', r.approved, GREEN, null],
                ['Ready to approve now', ready, '#9CC9B5', null],
                ['Blocked', blocked, GOLD, blockedReasons.map((w) => `${w.reason.toLowerCase()} (${w.count})`).join(', ')],
                ...(r.rejected ? [['Rejected', r.rejected, '#D9DDD5', null] as const] : []),
              ].map(([label, n, color, detail]) => (
                <div key={label as string} className="flex items-start gap-2.5 border-b border-ink-900/[.05] py-2.5 last:border-0">
                  <span className="mt-1 h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color as string }} />
                  <span className="flex-1">{label}{detail ? <span className="text-ink-500"> — {detail}</span> : null}</span>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
            {r.renewal_rate != null && r.previous_term && (
              <p className="mt-2 text-xs text-ink-500">{r.renewal_rate}% of {r.previous_term}&apos;s {r.previous_recipients} recipients renewed so far.</p>
            )}
            {ready > 0 && (
              <Link href="/admin/applications?type=renewal" className="mt-3.5 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#17815F] hover:text-[#0F6A4D]">
                Review the {plural(ready, 'ready renewal', 'ready renewals')} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
      </Card>

      <div className="flex flex-col gap-5">
        <Card title="Stipends">
          {nothingPaid ? (
            <div className="mt-3.5 flex items-center gap-3.5 rounded-[14px] bg-[#F6F7F3] p-4">
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-white text-ink-400"><Wallet className="h-[22px] w-[22px]" /></span>
              <div>
                <p className="text-[14px] font-bold">Nothing released yet this term</p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">Stipends open once students finish their hours and submit their report.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                <Tile label="Released" value={st.released} sub={peso(st.released_amount)} bg="#DFF0E7" fg="#0B5234" />
                <Tile label="Ready to release" value={st.ready_to_release} sub="signature + report in" bg="#FBF1C7" fg="#7A5E00" />
                <Tile label="Missing a requirement" value={st.missing_requirements} sub="signature or report" bg="#F6F7F3" fg="#5B6B62" />
              </div>
              {(st.via_promissory > 0 || st.voided > 0) && (
                <p className="mt-2.5 text-xs text-ink-500">
                  {st.via_promissory > 0 && `${st.via_promissory} released through a promissory note. `}{st.voided > 0 && `${st.voided} voided.`}
                </p>
              )}
            </>
          )}
          <Link href="/admin/stipend" className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#17815F] hover:text-[#0F6A4D]">
            Go to Stipend <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card title="Term results" hint={tr.in_progress === tr.placements ? 'Final results appear when the term ends' : `${tr.placements} placements this term`}>
          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            {/* The filter values are the Term Results report's verdict labels. */}
            {([['In progress', 'In Progress', tr.in_progress, '#E3ECF6', '#2E5C8A'], ['Qualified', 'Qualified', tr.qualified, '#DFF0E7', '#0B5234'], ['Deficient', 'Deficient', tr.deficient, '#F6E1E0', '#A3201F']] as const).map(([label, verdict, n, bg, fg]) => (
              <button key={label} onClick={() => onDrill({ tab: 'term-results', filters: { verdict: [verdict] } })}
                className="rounded-xl px-3.5 py-3 text-left transition-shadow hover:shadow-[0_4px_12px_rgba(19,36,26,0.08)]"
                style={{ background: n ? bg : '#F6F7F3' }} title={`See the ${label.toLowerCase()} recipients`}>
                <p className="text-xs font-semibold" style={{ color: n ? fg : '#5B6B62' }}>{label}</p>
                <p className="mt-0.5 text-[22px] font-extrabold">{n}</p>
              </button>
            ))}
          </div>
          {(tr.deficient_hours > 0 || tr.promissory.filed > 0) && (
            <p className="mt-2.5 text-xs text-ink-500">
              {tr.deficient_hours > 0 && `${tr.deficient_hours}h short in total. `}
              {tr.promissory.filed > 0 && `Promissory notes: ${tr.promissory.approved} approved, ${tr.promissory.pending} waiting, ${tr.promissory.rejected} rejected.`}
              {tr.carried_hours > 0 && ` ${tr.carried_hours}h carried into the next term.`}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, bg, fg }: { label: string; value: number; sub: string; bg: string; fg: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: bg }}>
      <p className="text-xs font-semibold" style={{ color: fg }}>{label}</p>
      <p className="mt-0.5 text-[22px] font-extrabold">{value}</p>
      <p className="text-[11px] text-ink-500">{sub}</p>
    </div>
  )
}
