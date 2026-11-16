'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, X } from 'lucide-react'
import { ChatWindow } from './ChatWindow'
import { useUIStore } from '@/lib/store/uiStore'

const FAB = 56 // robot button size (px)
const PANEL_W = 580
const PANEL_H = 860
const POS_KEY = 'swap-chat-pos'
const INTRO_KEY = 'swap-chat-intro' // sessionStorage: the hello was shown this visit
const INTRO_W = 230
const DRAG_THRESHOLD = 5 // px moved before a press counts as a drag (vs a click)
const HIDDEN_ON = ['/privacy'] // pages read on their own, without the assistant

type Pos = { x: number; y: number }

const clampToViewport = (x: number, y: number): Pos => ({
  x: Math.min(Math.max(x, 8), window.innerWidth - FAB - 8),
  y: Math.min(Math.max(y, 8), window.innerHeight - FAB - 8),
})

/** Draggable floating robot that opens the SWAP Assistant chat from anywhere in the app. */
export function ChatbotWidget() {
  const { chatOpen, setChatOpen, toggleChat } = useUIStore()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 })
  const [intro, setIntro] = useState(false)
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
    // The landing page starts it higher, clear of the slideshow's buttons.
    setPos({ x: window.innerWidth - FAB - 24, y: window.innerHeight - FAB - (window.location.pathname === '/' ? 96 : 24) })
  }, [])

  // Turning the phone (or resizing the window) keeps the robot on screen and re-lays the panel out.
  const [, setViewport] = useState(0)
  useEffect(() => {
    const onResize = () => { setPos((p) => clampToViewport(p.x, p.y)); setViewport((n) => n + 1) }
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize) }
  }, [])

  // A short hello beside the robot, once per visit (this tab's session), then it fades on its own.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch {
      return
    }
    const show = setTimeout(() => setIntro(true), 1200)
    const hide = setTimeout(() => setIntro(false), 1200 + 7000)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])
  useEffect(() => { if (chatOpen) setIntro(false) }, [chatOpen])

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
    if (d.moved) { setIntro(false); setPos(clampToViewport(e.clientX - d.offX, e.clientY - d.offY)) }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    d.active = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (!d.moved) toggleChat() // a tap (not a drag) toggles the chat
  }

  // The browser took the gesture over (e.g. a system swipe): end the drag without toggling the chat.
  const onPointerCancel = () => { drag.current.active = false }

  if (!mounted || HIDDEN_ON.includes(pathname)) return null

  // Phones: the chat is a full-screen sheet and the robot steps aside (it sat on the Send button).
  const phone = window.innerWidth < 640

  // Anchor the panel near the robot, clamped to stay on screen.
  const panelW = Math.min(PANEL_W, window.innerWidth - 16)
  const panelH = Math.min(PANEL_H, window.innerHeight - 16)
  const panelLeft = Math.min(Math.max(pos.x + FAB - panelW, 8), window.innerWidth - panelW - 8)
  const panelTop = Math.min(Math.max(pos.y - panelH - 12, 8), window.innerHeight - panelH - 8)

  // The hello sits left of the robot when there's room, else above it; always on screen.
  const introBeside = pos.x > INTRO_W + 24
  const introLeft = introBeside ? pos.x - INTRO_W - 12 : Math.min(Math.max(pos.x + FAB - INTRO_W, 8), window.innerWidth - INTRO_W - 8)
  const introTop = introBeside ? pos.y + FAB / 2 - 24 : Math.max(pos.y - 60, 8)

  return (
    <>
      {intro && !chatOpen && (
        <div role="status" style={{ left: introLeft, top: introTop, width: INTRO_W }}
          className="animate-panel-in fixed z-[60] flex items-center gap-2 rounded-2xl border border-ink-900/[.08] bg-surface py-2.5 pl-3.5 pr-2 shadow-[0_10px_30px_rgba(10,30,20,.18)]">
          <button type="button" onClick={() => { setIntro(false); setChatOpen(true) }}
            className="min-w-0 flex-1 text-left text-[13.5px] font-semibold leading-snug text-ink-950">
            Hi! I&apos;m your AI SWAP assistant!
          </button>
          <button type="button" onClick={() => setIntro(false)} aria-label="Dismiss"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
          {/* Tail pointing at the robot */}
          <span aria-hidden className={`absolute h-3 w-3 rotate-45 border-ink-900/[.08] bg-surface ${introBeside
            ? '-right-[7px] top-[18px] border-r border-t'
            : '-bottom-[7px] border-b border-r'}`}
            style={introBeside ? undefined : { left: Math.min(Math.max(pos.x + FAB / 2 - introLeft - 6, 16), INTRO_W - 24) }} />
        </div>
      )}

      {chatOpen && (
        <div
          className={phone ? 'fixed inset-x-0 top-0 z-[60] h-app pb-safe' : 'fixed z-[60] animate-in fade-in'}
          style={phone ? undefined : { left: panelLeft, top: panelTop, width: panelW, height: panelH }}
        >
          <ChatWindow onClose={() => setChatOpen(false)} />
        </div>
      )}

      {!(phone && chatOpen) && <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ left: pos.x, top: pos.y, width: FAB, height: FAB }}
        className="chat-fab fixed z-[60] flex touch-none select-none items-center justify-center rounded-full text-white shadow-lg ring-4 ring-brand-700/15 transition-transform hover:scale-105 active:scale-95"
        aria-label={chatOpen ? 'Close SWAP Assistant' : 'Open SWAP Assistant'}
        title="SWAP Assistant — ask me about the system"
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(135deg, #16452B 0%, #0B2716 100%)' }}
        >
          <Bot className="h-7 w-7" />
          {!chatOpen && (
            <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-success-600" />
          )}
        </span>
      </button>}
    </>
  )
}
