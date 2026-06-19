'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { ChatWindow } from './ChatWindow'
import { useUIStore } from '@/lib/store/uiStore'

const FAB = 56 // robot button size (px)
const PANEL_W = 380
const PANEL_H = 560
const POS_KEY = 'swap-chat-pos'
const DRAG_THRESHOLD = 5 // px moved before a press counts as a drag (vs a click)

type Pos = { x: number; y: number }

const clampToViewport = (x: number, y: number): Pos => ({
  x: Math.min(Math.max(x, 8), window.innerWidth - FAB - 8),
  y: Math.min(Math.max(y, 8), window.innerHeight - FAB - 8),
})

/** Draggable floating robot that opens the SWAP Assistant chat from anywhere in the app. */
export function ChatbotWidget() {
  const { chatOpen, setChatOpen, toggleChat } = useUIStore()
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 })
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, offX: 0, offY: 0 })

  // Initialise position (saved, or bottom-right) once on the client.
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(POS_KEY)
    if (saved) {
      try {
        setPos(clampToViewport(...(Object.values(JSON.parse(saved)) as [number, number])))
        return
      } catch {
        /* fall through to default */
      }
    }
    setPos({ x: window.innerWidth - FAB - 24, y: window.innerHeight - FAB - 24 })
  }, [])

  // Persist position whenever it settles.
  useEffect(() => {
    if (mounted) localStorage.setItem(POS_KEY, JSON.stringify(pos))
  }, [pos, mounted])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - pos.x,
      offY: e.clientY - pos.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active) return
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
      d.moved = true
    }
    if (d.moved) setPos(clampToViewport(e.clientX - d.offX, e.clientY - d.offY))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    d.active = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (!d.moved) toggleChat() // a tap (not a drag) toggles the chat
  }

  if (!mounted) return null

  // Anchor the panel near the robot, clamped to stay on screen.
  const panelW = Math.min(PANEL_W, window.innerWidth - 16)
  const panelH = Math.min(PANEL_H, window.innerHeight - 16)
  const panelLeft = Math.min(Math.max(pos.x + FAB - panelW, 8), window.innerWidth - panelW - 8)
  const panelTop = Math.min(Math.max(pos.y - panelH - 12, 8), window.innerHeight - panelH - 8)

  return (
    <>
      {chatOpen && (
        <div
          className="fixed z-[60] animate-in fade-in"
          style={{ left: panelLeft, top: panelTop, width: panelW, height: panelH }}
        >
          <ChatWindow onClose={() => setChatOpen(false)} />
        </div>
      )}

      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ left: pos.x, top: pos.y, width: FAB, height: FAB }}
        className="fixed z-[60] flex touch-none select-none items-center justify-center rounded-full text-white shadow-lg ring-4 ring-[#7D1A1A]/15 transition-transform hover:scale-105 active:scale-95"
        aria-label={chatOpen ? 'Close SWAP Assistant' : 'Open SWAP Assistant'}
        title="SWAP Assistant — ask me about the system"
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(135deg, #8E1B1B 0%, #531010 100%)' }}
        >
          <Bot className="h-7 w-7" />
          {!chatOpen && (
            <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#27AE60]" />
          )}
        </span>
      </button>
    </>
  )
}
