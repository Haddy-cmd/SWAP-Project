'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { errorText } from '@/lib/utils/apiError'

type Tone = 'success' | 'error' | 'info'

export interface NotifyInput {
  tone?: Tone
  title: string
  detail?: string | null
}

export interface ConfirmInput {
  title: string
  body?: ReactNode
  /** Warnings listed under the body (amber). */
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  /** danger: irreversible / takes something away (focus starts on Cancel). */
  tone?: 'danger' | 'primary'
}

interface Feedback {
  /** The centered pop-out after an action. Success/info close after 3 s; errors stay until OK. */
  notify: (input: NotifyInput) => void
  /** A failed action: `title` says what failed, the detail is the backend's own message. */
  notifyError: (err: unknown, title: string) => void
  /** "Are you sure?" before a risky action. Resolves true only on the confirm button. */
  confirm: (input: ConfirmInput) => Promise<boolean>
}

export const AUTO_CLOSE_MS = 3000

// Without the provider (e.g. a component rendered alone in a test) actions still run.
const fallback: Feedback = { notify: () => {}, notifyError: () => {}, confirm: async () => true }

const FeedbackContext = createContext<Feedback>(fallback)

export function useFeedback(): Feedback {
  return useContext(FeedbackContext)
}

type Note = Required<Pick<NotifyInput, 'tone' | 'title'>> & { detail: string | null; id: number }
type Ask = ConfirmInput & { resolve: (ok: boolean) => void }

const NOTE_STYLE: Record<Tone, { Icon: typeof CheckCircle2; ring: string; icon: string; button: string }> = {
  success: { Icon: CheckCircle2, ring: 'bg-success-50', icon: 'text-success-600', button: 'bg-brand-700 hover:bg-brand-600' },
  error: { Icon: XCircle, ring: 'bg-danger-50', icon: 'text-danger-600', button: 'bg-danger-600 hover:bg-danger-700' },
  info: { Icon: Info, ring: 'bg-brand-50', icon: 'text-brand-700', button: 'bg-brand-700 hover:bg-brand-600' },
}

/**
 * One feedback layer for the whole app (mounted in the root layout): the centered pop-out
 * that confirms an action, and the confirm dialog before a risky one. Rendered into <body>:
 * the top bar's backdrop blur would otherwise trap a fixed overlay inside it.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [paused, setPaused] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const askRef = useRef<Ask | null>(null)
  askRef.current = ask

  useEffect(() => setMounted(true), [])

  const notify = useCallback((input: NotifyInput) => {
    setPaused(false)
    setNote({ tone: input.tone ?? 'success', title: input.title, detail: input.detail ?? null, id: Date.now() + Math.random() })
  }, [])

  const notifyError = useCallback((err: unknown, title: string) => {
    notify({ tone: 'error', title, detail: errorText(err, 'Something went wrong. Please try again.') })
  }, [notify])

  const confirm = useCallback((input: ConfirmInput) => new Promise<boolean>((resolve) => {
    askRef.current?.resolve(false) // a newer question replaces an open one
    setAsk({ ...input, resolve })
  }), [])

  const answer = useCallback((ok: boolean) => {
    askRef.current?.resolve(ok)
    setAsk(null)
  }, [])

  // Success and info close by themselves (hovering pauses); errors wait for OK.
  useEffect(() => {
    if (!note || note.tone === 'error' || paused) return
    const id = setTimeout(() => setNote(null), AUTO_CLOSE_MS)
    return () => clearTimeout(id)
  }, [note, paused])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (askRef.current) answer(false)
      else setNote(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])

  const value = useMemo(() => ({ notify, notifyError, confirm }), [notify, notifyError, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {mounted && note && createPortal(<NotePopOut note={note} onClose={() => setNote(null)} onPause={setPaused} />, document.body)}
      {mounted && ask && createPortal(<ConfirmDialog ask={ask} onAnswer={answer} />, document.body)}
    </FeedbackContext.Provider>
  )
}

function NotePopOut({ note, onClose, onPause }: { note: Note; onClose: () => void; onPause: (p: boolean) => void }) {
  const { Icon, ring, icon, button } = NOTE_STYLE[note.tone]
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { okRef.current?.focus() }, [note.id])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/25 p-4 print:hidden" onClick={onClose}>
      <div
        role={note.tone === 'error' ? 'alert' : 'status'}
        aria-live={note.tone === 'error' ? 'assertive' : 'polite'}
        aria-labelledby="feedback-title"
        onMouseEnter={() => onPause(true)}
        onMouseLeave={() => onPause(false)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-[0_24px_60px_rgba(11,39,22,.28)]"
      >
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${ring}`}>
          <Icon className={`h-8 w-8 ${icon}`} />
        </span>
        <h2 id="feedback-title" className="mt-4 text-base font-bold text-ink-950">{note.title}</h2>
        {note.detail && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-600">{note.detail}</p>}
        <button ref={okRef} onClick={onClose}
          className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${button}`}>
          OK
        </button>
      </div>
    </div>
  )
}

function ConfirmDialog({ ask, onAnswer }: { ask: Ask; onAnswer: (ok: boolean) => void }) {
  const danger = ask.tone === 'danger'
  const cancelRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { (danger ? cancelRef : okRef).current?.focus() }, [danger])

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 print:hidden" onClick={() => onAnswer(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(11,39,22,.32)]">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${danger ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-700'}`}>
            {danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-bold text-ink-950">{ask.title}</h2>
            {ask.body && <div id="confirm-body" className="mt-1 text-sm text-ink-600">{ask.body}</div>}
          </div>
        </div>
        {ask.details && ask.details.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-[12.5px] text-warning-800">
            {ask.details.map((d) => (
              <li key={d} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-warning-600" />{d}</li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <button ref={cancelRef} onClick={() => onAnswer(false)}
            className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-50">
            {ask.cancelLabel ?? 'Cancel'}
          </button>
          <button ref={okRef} onClick={() => onAnswer(true)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${danger ? 'bg-danger-600 hover:bg-danger-700' : 'bg-brand-700 hover:bg-brand-600'}`}>
            {ask.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
