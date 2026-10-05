'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet'
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
}

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
export default function OfficeMapPicker({ latitude, longitude, radius, onChange, onRadiusChange }: OfficeMapPickerProps) {
  const hasPos = latitude != null && longitude != null
  const center: [number, number] = hasPos ? [latitude as number, longitude as number] : DEFAULT_CENTER
  const [pending, setPending] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPending(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-ink-300">
        <MapContainer center={center} zoom={hasPos ? 17 : 15} style={{ height: 320, width: '100%' }} scrollWheelZoom>
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
                pathOptions={{ color: '#1F5B3A', fillColor: '#1F5B3A', fillOpacity: 0.12 }}
              />
            </>
          )}
          {pending && <Marker position={pending} icon={markerIcon} opacity={0.55} />}
        </MapContainer>

        {pending && (
          <div role="alertdialog" aria-label="Confirm the office location"
            className="absolute inset-x-3 bottom-3 z-[1000] flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white/95 px-3.5 py-2.5 text-sm shadow-lg">
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
