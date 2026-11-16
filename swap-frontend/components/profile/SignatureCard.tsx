'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth.api'
import { avatarSrc } from '@/lib/utils/avatar'
import { SignaturePad } from '@/components/shared/SignaturePad'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { User } from '@/types/auth.types'
import type { ApiError } from '@/types/api.types'
import { BTN_GHOST, CARD } from './ui'

/**
 * Digital-signature specimen: admins certify with it, supervisors co-sign with it,
 * recipients sign their stubs with it (and cannot clock in without it).
 */
export function SignatureCard({ user }: { user: User }) {
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const queryClient = useQueryClient()
  const { notify, confirm } = useFeedback()
  const [sigMsg, setSigMsg] = useState<string | null>(null)
  const [showPad, setShowPad] = useState(false)
  // The saved image failed to load in this browser; reset whenever a new one is saved.
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [user.signature_url])

  const role = user.role
  const after = (updated: User) => {
    setAuth(updated, useAuthStore.getState().token ?? '')
    queryClient.invalidateQueries({ queryKey: ['student-summary'] })
    queryClient.invalidateQueries({ queryKey: ['profile-activity'] })
    queryClient.invalidateQueries({ queryKey: ['recipient-progress'] })
    setSigMsg(null)
  }
  const upload = useMutation({
    mutationFn: (file: File) => authApi.uploadSignature(file),
    onSuccess: (updated) => { after(updated); setShowPad(false); notify({ title: 'Signature saved', detail: 'It signs your stubs and receipts from now on.' }) },
    onError: (err: ApiError) => setSigMsg(err.message ?? 'Signature upload failed.'),
  })
  const remove = useMutation({
    mutationFn: () => authApi.removeSignature(),
    onSuccess: (updated) => { after(updated); notify({ title: 'Signature removed' }) },
    onError: (err: ApiError) => setSigMsg(err.message ?? 'Could not remove signature.'),
  })

  const unusable = !!user.signature_url && (!!user.signature_missing || broken)
  const saved = !!user.signature_url && !unusable

  return (
    <section id="field-signature" className={`${CARD} p-4 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-ink-950">Signature</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            {role === 'admin' ? 'Drawn on every claim stub you certify as Director.'
              : role === 'supervisor' ? 'Drawn on every stub you co-sign as SWAP Mentor.'
              : 'Signs your stipend stub and receipt. Needed before you can clock in or be paid.'}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          saved ? 'bg-accent-soft text-accent-strong' : 'bg-warning-50 text-warning-700'}`}>
          {saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : 'Not saved yet'}
        </span>
      </div>

      {sigMsg && <div className="mt-4 rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{sigMsg}</div>}

      {unusable ? (
        <p className="mt-4 rounded-lg bg-danger-50 px-4 py-2.5 text-[13px] font-semibold text-danger-700">
          {user.signature_missing
            ? "Your saved signature can't be found in storage. Please draw it again."
            : "Your saved signature couldn't be loaded. If it still doesn't show after refreshing the page, draw it again."}
        </p>
      ) : saved ? (
        <div className="mt-4">
          {/* Always a white backing: the ink is dark, like on the printed stub. */}
          <div data-theme="light" className="rounded-xl border border-ink-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(user.signature_url, token) ?? ''} alt="Your saved signature" onError={() => setBroken(true)}
              className="h-20 w-auto max-w-full" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setSigMsg(null); setShowPad((s) => !s) }} className={BTN_GHOST}>
              {showPad ? 'Close pad' : 'Redraw'}
            </button>
            <button type="button" disabled={remove.isPending}
              onClick={async () => {
                setSigMsg(null)
                const ok = await confirm({
                  title: 'Remove your signature?',
                  body: role === 'recipient'
                    ? "Your stipend can't be released until you save a new one."
                    : 'New claim stubs will show your printed name instead of your signature.',
                  confirmLabel: 'Remove',
                  tone: 'danger',
                })
                if (ok) remove.mutate()
              }}
              className="rounded-[11px] px-3 text-[13px] font-semibold text-ink-400 transition-colors hover:text-danger-700 disabled:opacity-60">
              {remove.isPending ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <p className={`mt-4 text-[13px] ${role === 'recipient' ? 'font-semibold text-danger-700' : 'text-ink-500'}`}>
          {role === 'recipient'
            ? 'Your stipend cannot be released until you save a signature. Draw it below, or upload an image.'
            : 'No signature yet. Stubs show your printed name instead. Draw it below, or upload an image.'}
        </p>
      )}

      {(!saved || showPad) && (
        <div className="mt-4">
          <SignaturePad busy={upload.isPending} onSave={(file) => { setSigMsg(null); upload.mutate(file) }} />
        </div>
      )}
    </section>
  )
}
