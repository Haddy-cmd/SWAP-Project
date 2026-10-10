'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Eraser, HardDrive, History, Loader2, RefreshCw } from 'lucide-react'
import { testingApi } from '@/lib/api/testing.api'
import { errorText } from '@/lib/utils/apiError'
import type { ApiRequestError } from '@/lib/api/axios'
import type { EarlierTest, StorageCheck, TestingStatus } from '@/types/testing.types'
import { CARD } from './ui'

type WithStatus = { data: TestingStatus; message: string }

/**
 * Where uploads (signatures, photos, documents) are kept and whether they're still there —
 * the reasons a signature shows as a broken image on live. Three summary lines, with the
 * details on request. Works with testing off.
 */
export function StoragePanel() {
  const check = useMutation({ mutationFn: () => testingApi.storageCheck() })
  const [details, setDetails] = useState(false)
  const r: StorageCheck | undefined = check.data

  const missing = r ? r.missing.files.length : 0
  const accounts = r ? new Set(r.missing.files.map((f) => f.user_id)).size : 0
  const lines = r ? [
    { ok: !r.disk.warning, label: r.disk.durable ? 'Cloud storage connected' : 'Storage connected (this computer)', value: r.disk.warning ? 'Check' : 'OK' },
    { ok: r.probe.ok, label: 'Test file saved & read', value: r.probe.ok ? 'OK' : 'Failed' },
    { ok: missing === 0 && r.missing.unchecked === 0, label: 'Missing signatures / photos', value: missing ? `${accounts} account${accounts === 1 ? '' : 's'}` : 'None' },
  ] : []

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-surface-3 text-ink-700"><HardDrive className="h-[19px] w-[19px]" /></span>
        <div className="flex-1">
          <p className="text-[14px] font-bold">File storage</p>
          <p className="text-[11.5px] text-ink-500">Signatures, photos and documents</p>
        </div>
      </div>

      {check.isPending ? (
        <p className="mt-3 flex h-[38px] items-center justify-center gap-2 rounded-[10px] bg-surface-2 text-[12.5px] text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving and reading a test file…
        </p>
      ) : !r ? (
        <button onClick={() => check.mutate()}
          className="mt-3 flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-ink-200 bg-surface text-[13px] font-semibold text-accent-strong hover:border-accent">
          <RefreshCw className="h-4 w-4" /> Check storage
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-[7px]">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-[12.5px]">
              {l.ok ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <AlertTriangle className="h-4 w-4 text-warning-700" />}
              <span className="flex-1">{l.label}</span>
              <span className="font-semibold" style={{ color: l.ok ? 'var(--text-accent)' : 'var(--text-warning-700)' }}>{l.value}</span>
            </div>
          ))}
          {details && (
            <div className="mt-1 space-y-1.5 rounded-[10px] bg-surface-2 p-3 text-xs text-ink-700">
              <p><b>Where files are kept:</b> {r.disk.warning ?? `${r.disk.durable ? 'Cloud storage' : 'This computer'} (${r.disk.name}${r.disk.driver ? `, ${r.disk.driver}` : ''}).`}</p>
              {!r.probe.ok && <p><b>Test file:</b> failed to {r.probe.step}: {r.probe.error}</p>}
              <p><b>Image links:</b> {r.links.warning ?? `Signatures and photos load from ${r.links.app_url}.`}</p>
              {missing > 0 ? (
                <div>
                  <p><b>On record but not in storage</b> — ask them to draw their signature (or upload their photo) again on their Profile:</p>
                  <ul className="mt-1 space-y-0.5">
                    {r.missing.files.map((f) => (
                      <li key={`${f.user_id}-${f.file}`}>{f.name} · {f.role} · {f.file === 'signature' ? 'Signature' : 'Photo'} <span className="font-mono text-ink-500">{f.email}</span></li>
                    ))}
                  </ul>
                </div>
              ) : <p>Every signature and photo on record is in storage.</p>}
              {r.missing.unchecked > 0 && <p>{r.missing.unchecked} couldn&apos;t be checked.</p>}
              {r.missing.checked < r.missing.total && <p>Checked the first {r.missing.checked} of {r.missing.total} files.</p>}
            </div>
          )}
          <div className="mt-1 flex gap-1">
            <button onClick={() => check.mutate()} className="flex h-[30px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-accent-strong hover:bg-ink-50">
              <RefreshCw className="h-3.5 w-3.5" /> Check again
            </button>
            <button onClick={() => setDetails((d) => !d)} className="flex h-[30px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-600 hover:bg-ink-50">
              {details ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {details ? 'Hide details' : 'Show details'}
            </button>
          </div>
        </div>
      )}
      {check.isError && <p className="mt-2 text-xs font-medium text-danger-700">{errorText(check.error as ApiRequestError, 'Could not check the storage.')}</p>}
    </div>
  )
}

/** Accounts tested before restore points existed: what's left over, and a one-time cleanup (only shown when any). */
export function EarlierTestsPanel({ onCleaned }: { onCleaned: (res: WithStatus) => void }) {
  const { data: accounts = [] } = useQuery({ queryKey: ['testing-earlier'], queryFn: testingApi.earlierTests })
  const [open, setOpen] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clean = useMutation({
    mutationFn: (id: number) => testingApi.cleanUpEarlierTest(id),
    onSuccess: (res) => { setOpen(null); onCleaned(res) },
    onError: (e: ApiRequestError) => setError(errorText(e, 'Could not clean up this account.')),
  })

  if (!accounts.length) return null

  return (
    <div className={`${CARD} border-gold-200 p-4`}>
      <p className="flex items-center gap-1.5 text-[14px] font-bold"><History className="h-4 w-4 text-gold-700" /> Tested before restore points</p>
      <p className="mt-1 text-[11.5px] leading-snug text-ink-600">
        Tested before System Testing kept a copy of each record, so some test data is still on them. A cleanup removes what was created
        during the test (going by the audit log), reactivates an earlier placement a renewal replaced, and puts the term result back.
      </p>
      <ul className="mt-2.5 space-y-2">
        {accounts.map((a: EarlierTest) => (
          <li key={a.id} className="rounded-xl border border-gold-200 bg-gold-50/40 px-3 py-2.5 text-[12.5px]">
            <p className="font-semibold text-ink-900">{a.name}</p>
            <p className="font-mono text-[11px] text-ink-500">{a.email}{a.student_id_number ? ` · ID ${a.student_id_number}` : ''}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">Tested {a.tested.join('; ')}{a.picked ? ' (still picked)' : ''}</p>
            {open === a.id ? (
              <div className="mt-2 rounded-lg border border-gold-200 bg-surface p-2.5 text-xs text-gold-900">
                {a.items.length
                  ? <ul className="list-disc space-y-0.5 pl-4">{a.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  : <p>Nothing was created during the test; the cleanup only takes the account out of testing.</p>}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => clean.mutate(a.id)} disabled={clean.isPending} className="rounded-lg bg-accent px-2.5 py-1 font-semibold text-white disabled:opacity-50">
                    {clean.isPending ? 'Cleaning up…' : 'Clean up'}
                  </button>
                  <button onClick={() => setOpen(null)} disabled={clean.isPending} className="font-semibold">Cancel</button>
                </div>
                {error && <p className="mt-2 font-medium text-danger-700">{error}</p>}
              </div>
            ) : (
              <button onClick={() => { setError(null); setOpen(a.id) }}
                className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"><Eraser className="h-3.5 w-3.5" /> Preview cleanup</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
