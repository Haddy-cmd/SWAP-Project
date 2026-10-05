'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react'
import { landingApi } from '@/lib/api/landing.api'
import type { LandingPhoto } from '@/types/landing.types'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { errorText } from '@/lib/utils/apiError'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']


/** Admin → Landing Page: the photos in the public home page carousel. */
export default function AdminLandingPage() {
  const queryClient = useQueryClient()
  const { notify, notifyError, confirm } = useFeedback()

  const { data, isLoading } = useQuery({ queryKey: ['landing-photos'], queryFn: landingApi.list })
  const photos = useMemo(() => data?.data ?? [], [data])
  const max = data?.meta.max_photos ?? 30
  const shown = photos.filter((p) => p.is_active).length

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['landing-photos'] })
  const fail = (title: string) => (e: unknown) => notifyError(e, title)

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { caption?: string; is_active?: boolean } }) => landingApi.update(id, data),
    onSuccess: (r) => { refresh(); notify({ title: 'Photo updated', detail: r.message ?? null }) },
    onError: fail('Could not update the photo'),
  })

  const reorder = useMutation({
    mutationFn: landingApi.reorder,
    onSuccess: (r) => { queryClient.setQueryData(['landing-photos'], { data: r.data, meta: { max_photos: max } }); notify({ title: 'Order saved', detail: r.message }) },
    onError: fail('Could not save the new order'),
  })

  const remove = useMutation({
    mutationFn: landingApi.remove,
    onSuccess: (r) => { refresh(); notify({ title: 'Photo deleted', detail: r.message }) },
    onError: fail('Could not delete the photo'),
  })

  const move = (index: number, delta: -1 | 1) => {
    const ids = photos.map((p) => p.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  const busy = update.isPending || reorder.isPending || remove.isPending

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">Landing Page</p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-ink-950">Carousel photos</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            The photos that rotate at the top of the public home page. Changes appear there within about a minute.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-ink-50"
        >
          <ExternalLink className="h-4 w-4" /> View landing page
        </a>
      </div>

      <UploadCard
        full={photos.length >= max}
        max={max}
        onUploaded={(message) => { refresh(); notify({ title: 'Photo uploaded', detail: message }) }}
        onError={(text) => notify({ tone: 'error', title: 'Could not upload the photo', detail: text })}
      />


      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h2 className="font-semibold text-ink-900">Slides, in order</h2>
          <span className="text-xs font-medium text-ink-500">
            {shown} shown · {photos.length - shown} hidden · max {max}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-ink-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : photos.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-500">No photos yet — the home page shows its built-in photos until you add some.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {photos.map((photo, i) => (
              <PhotoRow
                key={photo.id}
                photo={photo}
                position={i + 1}
                isFirst={i === 0}
                isLast={i === photos.length - 1}
                busy={busy}
                onMove={(delta) => move(i, delta)}
                onSaveCaption={(caption) => update.mutate({ id: photo.id, data: { caption } })}
                onToggle={() => update.mutate({ id: photo.id, data: { is_active: !photo.is_active } })}
                onDelete={() => {
                  void confirm({ title: 'Delete this photo?', body: `“${photo.caption}” is removed from the landing carousel. This cannot be undone.`, confirmLabel: 'Delete photo', tone: 'danger' })
                    .then((ok) => ok && remove.mutate(photo.id))
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function UploadCard({ full, max, onUploaded, onError }: {
  full: boolean
  max: number
  onUploaded: (message: string) => void
  onError: (text: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const upload = useMutation({
    mutationFn: () => landingApi.upload(file!, caption.trim()),
    onSuccess: (r) => { setFile(null); setCaption(''); onUploaded(r.message ?? 'Photo added to the carousel.') },
    onError: (e) => onError(errorText(e, 'Could not upload the photo.')),
  })

  const pick = (f: File | null) => {
    setFileError(null)
    if (!f) return setFile(null)
    // Same limits the server enforces, checked early so the admin isn't left waiting.
    if (!ACCEPTED.includes(f.type)) return setFileError('The photo must be a JPG, PNG or WEBP image.')
    if (f.size > MAX_UPLOAD_BYTES) return setFileError('The photo must be 8 MB or smaller.')
    setFile(f)
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-brand-700" />
        <h2 className="font-semibold text-ink-900">Add a photo</h2>
      </div>
      {full ? (
        <p className="text-sm text-ink-500">The carousel already has {max} photos. Delete one to add another.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <label className="flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50 text-center text-xs text-ink-500 hover:border-brand-600">
            {preview
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview} alt="Selected photo preview" className="h-full w-full object-cover" />
              : <span className="px-3">Choose a JPG, PNG or WEBP photo (up to 8 MB). Landscape photos look best.</span>}
            <input type="file" accept={ACCEPTED.join(',')} className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="new-caption" className="mb-1.5 block text-sm font-semibold text-ink-600">Caption</label>
              <input
                id="new-caption"
                value={caption}
                maxLength={160}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. SWAP orientation at the DSA office, 2026"
                className="h-11 w-full rounded-xl border border-ink-200 bg-ink-50 px-3.5 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-400">Describe what the photo shows. It appears under the slideshow.</p>
            </div>
            {fileError && <p className="text-sm text-danger-700">{fileError}</p>}
            <button
              type="button"
              onClick={() => upload.mutate()}
              disabled={!file || !caption.trim() || upload.isPending}
              className="flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {upload.isPending ? 'Uploading…' : 'Add to carousel'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoRow({ photo, position, isFirst, isLast, busy, onMove, onSaveCaption, onToggle, onDelete }: {
  photo: LandingPhoto
  position: number
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onMove: (delta: -1 | 1) => void
  onSaveCaption: (caption: string) => void
  onToggle: () => void
  onDelete: () => void
}) {
  const [caption, setCaption] = useState(photo.caption)
  useEffect(() => setCaption(photo.caption), [photo.caption])
  const dirty = caption.trim() !== photo.caption && caption.trim().length > 0

  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 disabled:opacity-40'

  return (
    <li className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${photo.is_active ? '' : 'bg-ink-50/60'}`}>
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-sm font-semibold tabular-nums text-ink-400">{position}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption}
          className={`h-[68px] w-[120px] flex-none rounded-lg object-cover ${photo.is_active ? '' : 'opacity-40 grayscale'}`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex gap-2">
          <input
            aria-label={`Caption for photo ${position}`}
            value={caption}
            maxLength={160}
            onChange={(e) => setCaption(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-700 focus:outline-none"
          />
          {dirty && (
            <button type="button" onClick={() => onSaveCaption(caption.trim())} disabled={busy} className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-400">
          {photo.source === 'built_in' ? 'Built-in photo' : `Uploaded${photo.width ? ` · ${photo.width}×${photo.height}` : ''}`}
          {photo.is_active ? '' : ' · hidden from the home page'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button type="button" onClick={() => onMove(-1)} disabled={busy || isFirst} aria-label="Move up" className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
        <button type="button" onClick={() => onMove(1)} disabled={busy || isLast} aria-label="Move down" className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-label={photo.is_active ? 'Hide from the home page' : 'Show on the home page'}
          className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40 ${photo.is_active ? 'border-success-200 bg-success-50 text-success-800' : 'border-ink-200 bg-white text-ink-500'}`}
        >
          {photo.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {photo.is_active ? 'Shown' : 'Hidden'}
        </button>
        <button type="button" onClick={onDelete} disabled={busy} aria-label="Delete photo" className="flex h-9 w-9 items-center justify-center rounded-lg border border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100 disabled:opacity-40">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}
