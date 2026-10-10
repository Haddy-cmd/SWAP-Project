'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Users, Wallet, CalendarDays, Clock, CalendarX, ImagePlus, X, Trash2, Send, CheckCircle2, AlertTriangle, Info,
  Bell, Mail, Search, Megaphone, ChevronDown, ChevronUp, Copy, Download, MailX,
} from 'lucide-react'
import { announcementsApi, announcementFileUrl } from '@/lib/api/announcements.api'
import { formatDateTime } from '@/lib/utils/formatDate'
import { useAuthStore } from '@/lib/store/authStore'
import type { ApiRequestError } from '@/lib/api/axios'
import type { Announcement } from '@/types/announcement.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { fileKind, fileSize } from '@/components/announcements/fileKind'

const MAX = 5000
const MAX_FILES = 5
const MAX_BYTES = 10 * 1024 * 1024
// Same list as AnnouncementService::FILE_TYPES (the server checks it too).
const TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
const ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
const CARD = 'rounded-[18px] border border-ink-900/[.08] bg-white shadow-[0_1px_3px_rgba(20,40,30,.05)]'
const GREEN = '#17815F'

// Quick starts: fixed text with [brackets] to fill in.
const TEMPLATES = [
  { Icon: Wallet, label: 'Stipend release', title: 'Stipend release schedule',
    message: 'Stipends for this semester will be released on [date] at the [office].\n\nPlease bring your school ID. Only recipients with verified hours will be included.' },
  { Icon: CalendarDays, label: 'Meeting', title: 'General assembly for all recipients',
    message: 'All SWAP recipients are required to attend the general assembly on [date], [time] at [venue].\n\nAttendance will be checked.' },
  { Icon: Clock, label: 'Hours reminder', title: 'Reminder: submit your service hours',
    message: 'Please make sure all your service hours for this month are logged and sent to your supervisor by [date].' },
  { Icon: CalendarX, label: 'No duty', title: 'No duty on [date]',
    message: 'There will be no SWAP duty on [date] because of [reason]. Regular schedules resume on [date].' },
]

interface Draft { id: string; file: File; preview: string | null }

const isImage = (f: File) => f.type.startsWith('image/')
const paragraphs = (text: string) => text.trim().split(/\n\s*\n/).filter(Boolean)

/**
 * Admin → Announcements (layout "SWAP Admin Announcements v2"): write one message — from a
 * template if you like — with up to 5 photos or documents, check how students will see it,
 * and send it to every active recipient (approved students waiting for an office included)
 * in the portal and by email (the email lists the files; the portal opens them). The sent
 * list can be searched, reused as a new draft, or deleted.
 */
export default function AdminAnnouncementsPage() {
  const qc = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const { notify, notifyError, confirm } = useFeedback()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<Draft[]>([])
  const [drag, setDrag] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const filesRef = useRef<Draft[]>([])
  filesRef.current = files

  // Search the sent list on the server, a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])
  // Free the photo previews when leaving the page.
  useEffect(() => () => filesRef.current.forEach((d) => d.preview && URL.revokeObjectURL(d.preview)), [])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-announcements', page, q],
    queryFn: () => announcementsApi.list(page, q),
    placeholderData: keepPreviousData,
  })
  const history = data?.data ?? []
  const audience = data?.meta.active_recipients
  const lastPage = data?.meta.last_page ?? 1

  const resetDraft = () => {
    files.forEach((d) => d.preview && URL.revokeObjectURL(d.preview))
    setTitle(''); setMessage(''); setFiles([])
  }

  const send = useMutation({
    mutationFn: () => announcementsApi.send({ title: title.trim(), message: message.trim(), files: files.map((d) => d.file) }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] })
      resetDraft(); setPage(1); setSearch(''); setOpenId(res.data.id)
      notify({ title: 'Announcement sent', detail: res.message ?? null })
    },
    onError: (e: ApiRequestError) => notifyError(e, 'Could not send the announcement'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => announcementsApi.remove(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] })
      notify({ title: 'Announcement deleted', detail: res.message })
    },
    onError: (e: ApiRequestError) => notifyError(e, 'Could not delete the announcement'),
  })

  // ── Files ──
  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? [])
    const problems: string[] = []
    const ok: Draft[] = []
    for (const f of picked) {
      const ext = (f.name.split('.').pop() ?? '').toLowerCase()
      if (!TYPES.includes(ext)) problems.push(`${f.name}: only photos, PDF, Word, Excel or PowerPoint files can be attached.`)
      else if (f.size > MAX_BYTES) problems.push(`${f.name} is over 10 MB.`)
      else ok.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, preview: isImage(f) ? URL.createObjectURL(f) : null })
    }
    const room = MAX_FILES - files.length
    if (ok.length > room) {
      ok.splice(room).forEach((d) => d.preview && URL.revokeObjectURL(d.preview))
      problems.push(`You can attach up to ${MAX_FILES} files.`)
    }
    if (ok.length) setFiles((cur) => [...cur, ...ok])
    if (problems.length) notify({ tone: 'info', title: 'Some files were not added', detail: problems.join(' ') })
  }
  const removeFile = (id: string) => setFiles((cur) => {
    const d = cur.find((x) => x.id === id)
    if (d?.preview) URL.revokeObjectURL(d.preview)
    return cur.filter((x) => x.id !== id)
  })
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }

  // ── Templates / drafts ──
  async function applyTemplate(t: (typeof TEMPLATES)[number]) {
    if ((title.trim() || message.trim()) && !(await confirm({
      title: 'Replace your draft?', body: `The title and message will be replaced with the "${t.label}" template. Attached files stay.`, confirmLabel: 'Use template',
    }))) return
    setTitle(t.title); setMessage(t.message)
  }
  async function reuse(a: Announcement) {
    if ((title.trim() || message.trim()) && !(await confirm({
      title: 'Replace your draft?', body: `The title and message will be replaced with "${a.title}".`, confirmLabel: 'Use as new draft',
    }))) return
    setTitle(a.title); setMessage(a.message)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (a.attachments?.length) notify({ tone: 'info', title: 'Draft ready', detail: 'Attach the files again if you need them.' })
  }

  async function askSend() {
    const n = audience ?? 0
    const fileNote = files.length ? ` with ${files.length} file${files.length === 1 ? '' : 's'}` : ''
    if (await confirm({
      title: `Send to ${n} student${n === 1 ? '' : 's'}?`,
      body: `"${title.trim()}"${fileNote} will appear in their notifications and inbox right away. You can't unsend it.`,
      confirmLabel: 'Yes, send',
    })) send.mutate()
  }

  async function askDelete(a: Announcement) {
    if (await confirm({
      title: 'Delete this announcement?',
      body: `It disappears from the history and from the notifications of ${a.recipient_count} recipient${a.recipient_count === 1 ? '' : 's'}${a.attachments?.length ? ', and its files are removed' : ''}. Emails already sent can't be recalled.`,
      confirmLabel: 'Delete', tone: 'danger',
    })) remove.mutate(a.id)
  }

  // ── Readiness ──
  const hasText = title.trim().length > 0 && message.trim().length >= 10
  const brackets = /\[[^\]]+\]/.test(title + message)
  const ready = hasText && !!audience && !send.isPending
  const hint = audience === 0
    ? { tone: 'warn', text: 'There are no active recipients to send an announcement to yet.' }
    : !title.trim() ? { tone: 'info', text: 'Add a title to continue.' }
    : message.trim().length < 10 ? { tone: 'info', text: 'Write a message (at least 10 characters) to continue.' }
    : brackets ? { tone: 'warn', text: 'Fill in the [brackets] before sending.' }
    : { tone: 'ok', text: 'Looks good. Check the preview, then send.' }
  const HintIcon = hint.tone === 'ok' ? CheckCircle2 : hint.tone === 'warn' ? AlertTriangle : Info
  const photos = files.filter((d) => d.preview)
  const docs = files.filter((d) => !d.preview)

  return (
    <div className="space-y-[18px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight text-ink-950">Announcements</h1>
          <p className="mt-1 text-[13.5px] text-ink-500">Write once. It goes to every student&apos;s portal notifications and email.</p>
        </div>
        {audience !== undefined && (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-ink-900/10 bg-white py-2 pl-2 pr-3.5">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#DFF0E7] text-[#0B5234]"><Users className="h-[19px] w-[19px]" /></span>
            <div className="leading-tight">
              <p className="text-[13.5px] font-bold">{audience} student{audience === 1 ? '' : 's'} will get this</p>
              <p className="text-[11.5px] text-ink-500">Active recipients + approved students waiting for an office</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
        {/* Composer */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-col gap-[18px] px-6 py-[22px]">
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-600">Start from a template <span className="font-medium text-ink-400">(optional)</span></p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.label} type="button" onClick={() => applyTemplate(t)}
                    className="flex h-[34px] items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-ink-700 hover:border-[#17815F] hover:bg-[#F1F7F3] hover:text-[#0B5234]">
                    <t.Icon className="h-4 w-4 text-[#17815F]" /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-[7px]">
              <span className="text-[13px] font-bold">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Stipend release schedule"
                className="h-[46px] rounded-xl border border-ink-200 bg-white px-3.5 text-[14.5px] text-ink-950 focus:border-[#17815F] focus:outline-none focus:ring-[3px] focus:ring-[#17815F]/10" />
            </label>

            <label className="flex flex-col gap-[7px]">
              <span className="flex justify-between text-[13px] font-bold">
                <span>Message</span>
                <span className="text-xs font-medium text-ink-400">{message.length.toLocaleString()} / {MAX.toLocaleString()}</span>
              </span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MAX} rows={9}
                placeholder="Write the announcement. Leave a blank line between paragraphs."
                className="resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-ink-950 focus:border-[#17815F] focus:outline-none focus:ring-[3px] focus:ring-[#17815F]/10" />
            </label>

            <div className="flex flex-col gap-2">
              <span className="flex justify-between text-[13px] font-bold">
                <span>Photos &amp; attachments <span className="font-medium text-ink-400">(optional)</span></span>
                <span className="text-xs font-medium text-ink-400">{files.length} / {MAX_FILES}</span>
              </span>
              <label onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
                className={`flex cursor-pointer items-center gap-3.5 rounded-xl border-[1.5px] border-dashed px-4 py-3.5 transition-colors ${
                  files.length >= MAX_FILES ? 'pointer-events-none opacity-50' : ''} ${drag ? 'border-[#17815F] bg-[#EEF6F1]' : 'border-ink-300/70 bg-[#FAFBF8] hover:border-[#17815F] hover:bg-[#F7FAF8]'}`}>
                <input type="file" multiple accept={ACCEPT} className="hidden" disabled={files.length >= MAX_FILES}
                  onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[#DFF0E7] text-[#0B5234]"><ImagePlus className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink-950">
                    {files.length >= MAX_FILES ? 'You have attached 5 files' : <>Drop files here or <span className="text-[#17815F] underline">browse</span></>}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">Photos, PDF, Word, Excel or PowerPoint · up to 10 MB each</span>
                </span>
              </label>
              {photos.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
                  {photos.map((d) => (
                    <div key={d.id} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-ink-200 bg-[#EEF1EC]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.preview!} alt={d.file.name} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeFile(d.id)} aria-label={`Remove ${d.file.name}`}
                        className="absolute right-1.5 top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#16241C]/75 text-white"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              {docs.map((d) => {
                const k = fileKind(d.file.name)
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]" style={{ background: k.bg, color: k.fg }}><k.Icon className="h-[19px] w-[19px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{d.file.name}</span>
                      <span className="block text-[11.5px] text-ink-500">{fileSize(d.file.size)}</span>
                    </span>
                    <button type="button" onClick={() => removeFile(d.id)} aria-label={`Remove ${d.file.name}`}
                      className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-ink-500 hover:bg-[#F6E1E0] hover:text-[#A3201F]"><Trash2 className="h-[18px] w-[18px]" /></button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/[.05] bg-[#FAFBF8] px-6 py-4">
            <span className={`flex min-w-[200px] flex-1 items-center gap-1.5 text-[12.5px] ${hint.tone === 'ok' ? 'text-[#0B5234]' : hint.tone === 'warn' ? 'text-warning-700' : 'text-ink-500'}`}>
              <HintIcon className="h-4 w-4 flex-none" /> {hint.text}
            </span>
            {(title || message || files.length > 0) && (
              <button type="button" onClick={resetDraft} disabled={send.isPending}
                className="h-11 rounded-xl border border-ink-200 bg-white px-4 text-[13.5px] font-semibold text-ink-600 hover:bg-ink-50">Clear</button>
            )}
            <button type="button" onClick={askSend} disabled={!ready}
              className="flex h-11 items-center gap-2 rounded-xl px-[22px] text-sm font-bold text-white shadow-[0_2px_8px_rgba(23,129,95,.25)] disabled:cursor-not-allowed disabled:shadow-none"
              style={{ background: ready ? GREEN : '#B9CFC3' }}>
              <Send className="h-[18px] w-[18px]" /> {send.isPending ? 'Sending…' : 'Send announcement'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-[88px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold">How students will see it</span>
            <span className="text-xs text-ink-500">Updates as you type</span>
          </div>
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center gap-2.5 px-[18px] py-3.5" style={{ background: 'linear-gradient(120deg,#0B5234,#063D27)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dsa-logo.png" alt="" className="w-7" />
              <div className="flex-1 leading-tight">
                <p className="text-[12.5px] font-bold text-white">SWAP Portal</p>
                <p className="text-[11px] text-white/70">Division of Student Affairs · just now</p>
              </div>
              <span className="rounded-md bg-[#DDBB38] px-2 py-[3px] text-[10.5px] font-extrabold tracking-[0.1em] text-[#2B2200]">NEW</span>
            </div>
            <div className="px-5 pb-[22px] pt-[18px]">
              <p className={`text-[17px] font-extrabold ${title.trim() ? 'text-ink-950' : 'text-ink-300'}`}>{title.trim() || 'Your title'}</p>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {message.trim()
                  ? paragraphs(message).map((p, i) => <p key={i} className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-700">{p}</p>)
                  : <p className="text-[13.5px] text-ink-300">Your message will show here.</p>}
              </div>
              {photos.length > 0 && (
                <div className={`mt-3.5 grid gap-1.5 overflow-hidden rounded-xl ${photos.length === 1 ? 'grid-cols-1' : photos.length === 2 || photos.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {photos.map((d) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={d.id} src={d.preview!} alt={d.file.name} className={`w-full object-cover ${photos.length === 1 ? 'aspect-[16/10]' : 'aspect-square'}`} />
                  ))}
                </div>
              )}
              {docs.length > 0 && (
                <div className="mt-3.5 flex flex-col gap-1.5">
                  {docs.map((d) => {
                    const k = fileKind(d.file.name)
                    return (
                      <div key={d.id} className="flex items-center gap-2 rounded-[10px] bg-[#F6F7F3] px-2.5 py-2 text-[12.5px]">
                        <k.Icon className="h-[18px] w-[18px] flex-none" style={{ color: k.fg }} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{d.file.name}</span>
                        <Download className="h-4 w-4 text-[#17815F]" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-4 px-1 text-xs text-ink-500">
            <span className="flex items-center gap-1"><Bell className="h-4 w-4 text-[#17815F]" /> Portal notification</span>
            <span className="flex items-center gap-1"><Mail className="h-4 w-4 text-[#17815F]" /> Email{files.length > 0 ? ' (lists the files)' : ''}</span>
          </div>
        </div>
      </div>

      {/* Sent */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/[.05] px-[22px] py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[15.5px] font-bold">Sent announcements</span>
            {!!data?.meta.total && <span className="text-[12.5px] text-ink-500">{data.meta.total}{q ? ' found' : ' sent'}</span>}
          </div>
          <div className="flex h-[38px] w-[260px] max-w-full items-center gap-2 rounded-[10px] bg-[#F4F5F1] px-3">
            <Search className="h-[18px] w-[18px] text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sent" aria-label="Search sent announcements"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-950 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">{[1, 2].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-ink-100" />)}</div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[#F1F3EE] text-ink-400"><MailX className="h-6 w-6" /></span>
            <p className="text-[14px] font-semibold">{q ? 'No matches' : 'Nothing sent yet'}</p>
            <p className="text-[12.5px] text-ink-500">{q ? 'Try a different word.' : 'Your announcements will be listed here after you send them.'}</p>
          </div>
        ) : (
          <ul>
            {history.map((a) => {
              const open = openId === a.id
              const att = a.attachments ?? []
              const pics = att.filter((f) => f.is_image)
              const others = att.filter((f) => !f.is_image)
              return (
                <li key={a.id} className="border-b border-ink-900/[.04] last:border-0">
                  <button type="button" onClick={() => setOpenId(open ? null : a.id)} aria-expanded={open}
                    className="flex w-full items-center gap-3.5 px-[22px] py-3.5 text-left hover:bg-[#FAFBF8]">
                    <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-[#DFF0E7] text-[#0B5234]"><Megaphone className="h-[19px] w-[19px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{a.title}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-500">{a.message.replace(/\s+/g, ' ')}</span>
                    </span>
                    <span className="hidden flex-none text-right leading-snug sm:block">
                      <span className="block text-[12.5px] font-semibold">{a.created_at ? formatDateTime(a.created_at) : ''}</span>
                      <span className="block text-[11.5px] text-ink-500">
                        Sent to {a.recipient_count}{att.length ? ` · ${att.length} file${att.length === 1 ? '' : 's'}` : ''}
                      </span>
                    </span>
                    {open ? <ChevronUp className="h-5 w-5 flex-none text-ink-400" /> : <ChevronDown className="h-5 w-5 flex-none text-ink-400" />}
                  </button>
                  {open && (
                    <div className="flex flex-col gap-3 px-[22px] pb-[18px] sm:pl-[74px]">
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-700">{a.message}</p>
                      {pics.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {pics.map((f) => (
                            <a key={f.id} href={announcementFileUrl(f.url, token)} target="_blank" rel="noreferrer" title={f.name}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={announcementFileUrl(f.url, token)} alt={f.name} className="h-[90px] w-[120px] rounded-[10px] border border-ink-200 object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {others.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {others.map((f) => {
                            const k = fileKind(f.name)
                            return (
                              <a key={f.id} href={announcementFileUrl(f.url, token)} target="_blank" rel="noreferrer"
                                className="flex h-8 items-center gap-1.5 rounded-[9px] bg-[#F6F7F3] px-2.5 text-[12.5px] font-semibold hover:bg-ink-100">
                                <k.Icon className="h-4 w-4" style={{ color: k.fg }} /> {f.name} <span className="font-normal text-ink-500">{fileSize(f.size)}</span>
                              </a>
                            )
                          })}
                        </div>
                      )}
                      <p className="flex flex-wrap gap-x-3 text-xs text-ink-500">
                        <span>{a.recipient_count} recipient{a.recipient_count === 1 ? '' : 's'}</span>
                        <span className={a.emailed_count < a.recipient_count ? 'font-semibold text-warning-700' : ''}>{a.emailed_count} emailed</span>
                        {a.sent_by && <span>by {a.sent_by}</span>}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => reuse(a)}
                          className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-ink-700 hover:border-[#17815F] hover:text-[#0B5234]">
                          <Copy className="h-4 w-4" /> Use as new draft
                        </button>
                        <button type="button" onClick={() => askDelete(a)} disabled={remove.isPending}
                          className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-danger-700 hover:border-danger-200 hover:bg-danger-50 disabled:opacity-50">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-ink-900/[.05] py-3 text-sm">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-500 disabled:opacity-40">Previous</button>
            <span className="text-ink-500">Page {page} of {lastPage}</span>
            <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}
              className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-500 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}
