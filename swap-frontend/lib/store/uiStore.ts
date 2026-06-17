import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UIStore {
  /** Desktop: whether the sidebar column is expanded (persisted preference). */
  desktopSidebarOpen: boolean
  /** Mobile: whether the sidebar drawer overlay is showing (ephemeral). */
  mobileSidebarOpen: boolean
  toggleDesktopSidebar: () => void
  toggleMobileSidebar: () => void
  setMobileSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      desktopSidebarOpen: true,
      mobileSidebarOpen: false,
      toggleDesktopSidebar: () => set((s) => ({ desktopSidebarOpen: !s.desktopSidebarOpen })),
      toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
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
