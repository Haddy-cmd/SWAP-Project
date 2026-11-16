'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import { MapPin, Search, X } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Default to MSU Marawi campus when no coordinates are set yet.
const DEFAULT_CENTER: [number, number] = [7.9986, 124.2928]

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

interface OfficeMapPickerProps {
  latitude: number | null
  longitude: number | null
  radius: number
  onChange: (lat: number, lng: number, radius: number) => void
  onRadiusChange: (radius: number) => void
  /** Map height in px (default 320). */
  height?: number
}

/** Flies the map to a searched place. */
function FlyTo({ to }: { to: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { if (to) map.flyTo(to, 18, { duration: 0.8 }) }, [to, map])
  return null
}

type Place = { lat: string; lon: string; name?: string; display_name: string }

// Around MSU Marawi, so campus results rank first (lon/lat: west, north, east, south).
const VIEWBOX = '124.24,8.03,124.33,7.96'

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * Office location + geofence radius. A click on the map doesn't move the office straight
 * away: it shows a faded pin and asks first (Move / Keep current, Escape cancels).
 */
export default function OfficeMapPicker({ latitude, longitude, radius, onChange, onRadiusChange, height = 320 }: OfficeMapPickerProps) {
  const phone = typeof window !== 'undefined' && window.innerWidth < 640
  const hasPos = latitude != null && longitude != null
  const center: [number, number] = hasPos ? [latitude as number, longitude as number] : DEFAULT_CENTER
  const [pending, setPending] = useState<[number, number] | null>(null)
  const [fly, setFly] = useState<[number, number] | null>(null)

  // Place search (OpenStreetMap Nominatim): only on Enter / the button, never per keystroke.
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const search = async () => {
    const term = q.trim()
    if (!term) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setSearching(true); setSearchError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ph&viewbox=${VIEWBOX}&bounded=0&q=${encodeURIComponent(term)}`
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept-Language': 'en' } })
      if (!res.ok) throw new Error(String(res.status))
      const found = (await res.json()) as Place[]
      setResults(found)
      if (!found.length) setSearchError('No places found. Try a nearby landmark or click the map.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { setResults(null); setSearchError("Search isn't available right now. Click the map instead.") }
    } finally {
      if (abort.current === ctrl) setSearching(false)
    }
  }

  const choose = (p: Place) => {
    const at: [number, number] = [Number(p.lat), Number(p.lon)]
    setFly(at); setPending(at); setResults(null); setSearchError(null)
  }

  useEffect(() => {
    if (!pending && !results) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setPending(null); setResults(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, results])

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-ink-300 bg-surface px-3 focus-within:border-brand-700">
            <Search className="h-4 w-4 flex-none text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place, e.g. CICS Building, MSU Marawi"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} aria-label="Search a place"
              className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink-900 placeholder:text-ink-350 focus:outline-none" />
            {(q || results) && (
              <button type="button" aria-label="Clear search" onClick={() => { setQ(''); setResults(null); setSearchError(null) }} className="text-ink-400 hover:text-ink-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button type="button" onClick={search} disabled={searching || !q.trim()}
            className="h-10 flex-none rounded-xl bg-brand-700 px-3.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {results && results.length > 0 && (
          <ul role="listbox" aria-label="Places found"
            className="absolute inset-x-0 top-12 z-[1100] max-h-60 overflow-y-auto rounded-xl border border-ink-200 bg-surface p-1 shadow-lg">
            {results.map((p, i) => {
              const [first, ...rest] = p.display_name.split(', ')
              return (
                <li key={`${p.lat},${p.lon},${i}`}>
                  <button type="button" onClick={() => choose(p)} className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50">
                    <MapPin className="mt-0.5 h-4 w-4 flex-none text-brand-700" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900">{p.name || first}</span>
                      <span className="block truncate text-xs text-ink-500">{rest.slice(0, 3).join(', ')}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {searchError && <p className="mt-1.5 text-xs text-warning-700">{searchError}</p>}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-ink-300">
        {/* Phones: a shorter map, leaving room to scroll the page around it. */}
        <MapContainer center={center} zoom={hasPos ? 17 : 15} style={{ height: phone ? Math.min(height, 240) : height, width: '100%' }} scrollWheelZoom>
          <FlyTo to={fly} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={(lat, lng) => setPending([lat, lng])} />
          {hasPos && (
            <>
              <Marker position={[latitude as number, longitude as number]} icon={markerIcon} />
              <Circle
                center={[latitude as number, longitude as number]}
                radius={radius}
                pathOptions={{ color: 'var(--text-brand-700)', fillColor: 'var(--color-brand-700)', fillOpacity: 0.12 }}
              />
            </>
          )}
          {pending && <Marker position={pending} icon={markerIcon} opacity={0.55} />}
        </MapContainer>

        {pending && (
          <div role="alertdialog" aria-label="Confirm the office location"
            className="absolute inset-x-3 bottom-3 z-[1000] flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-surface/95 px-3.5 py-2.5 text-sm shadow-lg">
            <span className="min-w-0 flex-1 font-semibold text-ink-900">
              {hasPos ? 'Move the office location here?' : 'Set the office location here?'}
              <span className="block text-xs font-normal text-ink-500">{pending[0].toFixed(6)}, {pending[1].toFixed(6)}</span>
            </span>
            <button type="button" onClick={() => setPending(null)}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50">
              {hasPos ? 'Keep current' : 'Cancel'}
            </button>
            <button type="button" onClick={() => { onChange(pending[0], pending[1], radius); setPending(null) }}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
              {hasPos ? 'Move' : 'Set location'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-500">
        {hasPos
          ? 'Click the map to move the office center (you will be asked to confirm). Drag the slider to set the geofence radius.'
          : 'Click anywhere on the map to drop the office location pin.'}
      </p>

      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-ink-500 whitespace-nowrap">Radius: {radius} m</label>
        <input
          type="range"
          min={10}
          max={1000}
          step={10}
          value={radius}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="flex-1 accent-brand-700"
        />
      </div>

      {hasPos && (
        <p className="text-xs text-ink-500">
          Lat: {(latitude as number).toFixed(6)} · Lng: {(longitude as number).toFixed(6)}
        </p>
      )}
    </div>
  )
}
