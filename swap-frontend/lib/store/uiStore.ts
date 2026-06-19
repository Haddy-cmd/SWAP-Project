import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UIStore {
  /** Desktop: whether the sidebar column is expanded (persisted preference). */
  desktopSidebarOpen: boolean
  /** Mobile: whether the sidebar drawer overlay is showing (ephemeral). */
  mobileSidebarOpen: boolean
  /** Desktop auto-hide: temporary hover-reveal of the sidebar (ephemeral). */
  sidebarRevealed: boolean
  /** Floating chatbot widget open/closed (ephemeral). */
  chatOpen: boolean
  toggleDesktopSidebar: () => void
  toggleMobileSidebar: () => void
  setMobileSidebarOpen: (open: boolean) => void
  revealSidebar: () => void
  scheduleHideSidebar: () => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
}

// Module-level timer for the auto-hide delay (kept out of persisted state).
let hideTimer: ReturnType<typeof setTimeout> | null = null

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      desktopSidebarOpen: true,
      mobileSidebarOpen: false,
      sidebarRevealed: false,
      chatOpen: false,
      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      toggleDesktopSidebar: () => set((s) => ({ desktopSidebarOpen: !s.desktopSidebarOpen })),
      toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      revealSidebar: () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
        set({ sidebarRevealed: true })
      },
      scheduleHideSidebar: () => {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
          set({ sidebarRevealed: false })
          hideTimer = null
        }, 250)
      },
    }),
    {
      name: 'swap-ui',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : window.localStorage,
      ),
      // Only the desktop preference is remembered across sessions.
      partialize: (state) => ({ desktopSidebarOpen: state.desktopSidebarOpen }),
    },
  ),
)
