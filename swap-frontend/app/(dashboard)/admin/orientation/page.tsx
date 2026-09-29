'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Presentation, CalendarPlus, MapPin, Video, Users, Pencil, Trash2, Send, Check, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { orientationApi } from '@/lib/api/orientation.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import { manilaToISO } from '@/lib/utils/interviewWindow'
import type { ApiRequestError } from '@/lib/api/axios'
import type {
  OrientationAttendanceStatus, OrientationCandidate, OrientationMode, OrientationSession, OrientationSessionInput,
} from '@/types/orientation.types'

const STATUS_META: Record<OrientationCandidate['orientation_status'], { label: string; cls: string }> = {
  not_invited: { label: 'Not invited', cls: 'bg-ink-100 text-ink-500' },
  invited: { label: 'Invited', cls: 'bg-info-50 text-brand-700' },
  attended: { label: 'Attended', cls: 'bg-success-50 text-success-700' },
  absent: { label: 'Absent', cls: 'bg-danger-50 text-danger-700' },
}

type Form = { title: string; when: string; mode: OrientationMode; location: string; meeting_link: string; notes: string }
const EMPTY: Form = { title: '', when: '', mode: 'in_person', location: '', meeting_link: '', notes: '' }

/** ISO instant → the Manila-local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function isoToManilaInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`
}

function toInput(f: Form): OrientationSessionInput {
  const [ymd, hm = '00:00'] = f.when.split('T')
  const [h, m] = hm.split(':').map(Number)
  return {
    title: f.title.trim(),
    scheduled_at: manilaToISO(ymd, h * 60 + m),
    mode: f.mode,
    location: f.mode === 'in_person' ? f.location.trim() || null : null,
    meeting_link: f.mode === 'online' ? f.meeting_link.trim() || null : null,
    notes: f.notes.trim() || null,
  }
}

const firstError = (e: ApiRequestError, fallback: string) =>
  Object.values(e.errors ?? {}).flat()[0] ?? e.message ?? fallback

export default function AdminOrientationPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(EMPTY)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ id: number; text: string; error?: boolean } | null>(null)

  const { data: sessions = [], isLoading } = useQuery({ queryKey: ['admin-orientation'], queryFn: orientationApi.getSessions })
  const { data: candidates = [] } = useQuery({ queryKey: ['admin-orientation-candidates'], queryFn: orientationApi.getCandidates })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-orientation'] })
    qc.invalidateQueries({ queryKey: ['admin-orientation-candidates'] })
  }

  const save = useMutation({
    mutationFn: () => (editingId ? orientationApi.updateSession(editingId, toInput(form)) : orientationApi.createSession(toInput(form))),
    onSuccess: (res) => {
      refresh()
      setForm(EMPTY); setEditingId(null); setFormError(null)
      setOpenId(res.data.id)
      setNotice({ id: res.data.id, text: res.message ?? 'Saved.' })
    },
    onError: (e: ApiRequestError) => setFormError(firstError(e, 'Could not save the session.')),
  })

  const remove = useMutation({
    mutationFn: (id: number) => orientationApi.deleteSession(id),
    onSuccess: () => { refresh(); setNotice(null) },
    onError: (e: ApiRequestError, id) => setNotice({ id, text: e.message, error: true }),
  })

  const invite = useMutation({
    mutationFn: (v: { id: number; userIds?: number[] }) => orientationApi.invite(v.id, v.userIds),
    onSuccess: (res, v) => { refresh(); setNotice({ id: v.id, text: res.message ?? 'Invited.' }) },
    onError: (e: ApiRequestError, v) => setNotice({ id: v.id, text: firstError(e, 'Could not send the invitations.'), error: true }),
  })

  const mark = useMutation({
    mutationFn: (v: { id: number; userId: number; status: OrientationAttendanceStatus }) =>
      orientationApi.markAttendance(v.id, v.userId, v.status),
    onSuccess: () => refresh(),
    onError: (e: ApiRequestError, v) => setNotice({ id: v.id, text: firstError(e, 'Could not save attendance.'), error: true }),
  })

  function startEdit(s: OrientationSession) {
    setEditingId(s.id)
    setFormError(null)
    setForm({
      title: s.title, when: isoToManilaInput(s.scheduled_at), mode: s.mode,
      location: s.location ?? '', meeting_link: s.meeting_link ?? '', notes: s.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const counts = useMemo(() => ({
    total: candidates.length,
    attended: candidates.filter((c) => c.orientation_status === 'attended').length,
    waiting: candidates.filter((c) => c.orientation_status !== 'attended').length,
  }), [candidates])

  const canSave = form.title.trim() && form.when && (form.mode === 'in_person' ? form.location.trim() : form.meeting_link.trim())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Orientation</h1>
        <p className="mt-1 text-sm text-ink-500">
          Brief approved applicants before office placement. A new applicant must attend an orientation before they can be placed; renewing recipients are exempt.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Approved, not yet placed" value={counts.total} />
        <Stat label="Attended an orientation" value={counts.attended} />
        <Stat label="Still to attend" value={counts.waiting} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Sessions */}
        <div className="space-y-3">
          {isLoading ? (
            [1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-ink-200" />)
          ) : !sessions.length ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-200 bg-white py-14 text-center">
              <Presentation className="h-10 w-10 text-ink-300" />
              <p className="text-sm text-ink-350">No orientation sessions yet. Schedule one to invite approved applicants.</p>
            </div>
          ) : sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              candidates={candidates}
              open={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
              onEdit={() => startEdit(s)}
              onDelete={() => { if (confirm(`Delete "${s.title}"? Invited applicants are not notified.`)) remove.mutate(s.id) }}
              onInvite={(userIds) => invite.mutate({ id: s.id, userIds })}
              onMark={(userId, status) => mark.mutate({ id: s.id, userId, status })}
              busy={invite.isPending || mark.isPending || remove.isPending}
              notice={notice?.id === s.id ? notice : null}
            />
          ))}
        </div>

        {/* Create / edit */}
        <div className="h-fit rounded-2xl border border-ink-200 bg-white p-5 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-brand-700" />
            <h2 className="font-semibold text-ink-900">{editingId ? 'Edit session' : 'Schedule a session'}</h2>
          </div>
          <div className="mt-4 space-y-3">
            <Field label="Title">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150}
                placeholder="e.g. SWAP Orientation — Batch 1" className={INPUT} />
            </Field>
            <Field label="Date and time (Manila)">
              <input type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {(['in_person', 'online'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setForm({ ...form, mode: m })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${form.mode === m ? 'border-brand-700 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'}`}>
                  {m === 'online' ? <Video className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {m === 'online' ? 'Online' : 'In person'}
                </button>
              ))}
            </div>
            {form.mode === 'in_person' ? (
              <Field label="Venue">
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={255}
                  placeholder="e.g. DSA Conference Room" className={INPUT} />
              </Field>
            ) : (
              <Field label="Meeting link">
                <input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} maxLength={500}
                  placeholder="https://" className={INPUT} />
              </Field>
            )}
            <Field label="Notes (optional)">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={2000}
                placeholder="What to bring, dress code…" className={INPUT} />
            </Field>
            {formError && <p className="text-sm text-danger-700">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setFormError(null); save.mutate() }} disabled={save.isPending || !canSave}
                className="flex-1 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                {save.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Create session'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setForm(EMPTY); setFormError(null) }}
                  className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50">Cancel</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Who still needs it */}
      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="font-semibold text-ink-900">Approved applicants awaiting placement</h2>
          <p className="mt-0.5 text-xs text-ink-500">Their orientation status, as the Assignments page sees it.</p>
        </div>
        {!candidates.length ? (
          <p className="px-5 py-8 text-center text-sm text-ink-350">No approved applicants are waiting for placement.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {candidates.map((c) => (
              <li key={c.user_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">{[c.student_id, c.email].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[c.orientation_status].cls}`}>
                    {STATUS_META[c.orientation_status].label}
                  </span>
                  {c.session_title && <p className="mt-0.5 text-[11px] text-ink-350">{c.session_title}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SessionCard({
  session: s, candidates, open, onToggle, onEdit, onDelete, onInvite, onMark, busy, notice,
}: {
  session: OrientationSession
  candidates: OrientationCandidate[]
  open: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onInvite: (userIds?: number[]) => void
  onMark: (userId: number, status: OrientationAttendanceStatus) => void
  busy: boolean
  notice: { text: string; error?: boolean } | null
}) {
  const [picked, setPicked] = useState<number[]>([])
  const attendees = s.attendees ?? []
  const inSession = new Set(attendees.map((a) => a.user_id))
  const invitable = candidates.filter((c) => !inSession.has(c.user_id) && c.orientation_status !== 'attended')
  const tally = (st: OrientationAttendanceStatus) => attendees.filter((a) => a.status === st).length
  const past = new Date(s.scheduled_at).getTime() < Date.now()

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900">{s.title}</h3>
            {past && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">Past</span>}
          </div>
          <p className="mt-0.5 text-sm text-ink-500">{formatDateTime(s.scheduled_at)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
            {s.mode === 'online' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {s.mode === 'online'
              ? <a href={s.meeting_link ?? '#'} target="_blank" rel="noreferrer" className="truncate text-brand-700 underline">{s.meeting_link}</a>
              : s.location}
          </p>
          {s.notes && <p className="mt-1 text-xs italic text-ink-500">{s.notes}</p>}
          <p className="mt-2 text-xs text-ink-500">
            {tally('invited')} invited · <span className="text-success-700">{tally('attended')} attended</span> · <span className="text-danger-700">{tally('absent')} absent</span>
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button onClick={onEdit} title="Edit" className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} title="Delete" disabled={busy} className="rounded-lg border border-ink-200 p-2 text-danger-700 hover:bg-danger-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
          <button onClick={onToggle} className="flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-ink-50">
            Manage {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {notice && <p className={`mt-3 text-xs font-medium ${notice.error ? 'text-danger-700' : 'text-success-700'}`}>{notice.text}</p>}

      {open && (
        <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
          {/* Invite */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Invite</p>
              <div className="flex gap-2">
                {picked.length > 0 && (
                  <button onClick={() => { onInvite(picked); setPicked([]) }} disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                    <Send className="h-3.5 w-3.5" /> Invite {picked.length} selected
                  </button>
                )}
                <button onClick={() => onInvite()} disabled={busy || !invitable.length}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-ink-50 disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> Invite all eligible ({invitable.length})
                </button>
              </div>
            </div>
            {invitable.length > 0 ? (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {invitable.map((c) => (
                  <label key={c.user_id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
                    <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={picked.includes(c.user_id)}
                      onChange={() => setPicked((p) => p.includes(c.user_id) ? p.filter((x) => x !== c.user_id) : [...p, c.user_id])} />
                    <span className="text-ink-900">{c.name}</span>
                    <span className="text-xs text-ink-350">{c.student_id}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-350">Every approved applicant who still needs an orientation is already on this session.</p>
            )}
          </div>

          {/* Attendance */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Attendance</p>
            {!attendees.length ? (
              <p className="mt-2 text-xs text-ink-350">Nobody is invited yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-ink-100 rounded-xl border border-ink-100">
                {attendees.map((a) => (
                  <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900">{a.name}</p>
                      <p className="text-[11px] text-ink-350">{a.student_id}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_META[a.status].cls}`}>{STATUS_META[a.status].label}</span>
                      <button onClick={() => onMark(a.user_id, 'attended')} disabled={busy || a.status === 'attended'} title="Mark attended"
                        className="rounded-lg border border-ink-200 p-1.5 text-success-700 hover:bg-success-50 disabled:opacity-40"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => onMark(a.user_id, 'absent')} disabled={busy || a.status === 'absent'} title="Mark absent"
                        className="rounded-lg border border-ink-200 p-1.5 text-danger-700 hover:bg-danger-50 disabled:opacity-40"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-ink-300 bg-ink-50 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-700">{value}</p>
    </div>
  )
}
