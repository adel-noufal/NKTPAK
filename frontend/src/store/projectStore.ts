import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectDetail, PackagingAlternative } from '../types'

export type ViewMode = 'box' | 'inside' | 'product' | 'exploded'
export type Language = 'en' | 'ar'
export type Theme = 'light' | 'dark' | 'system'

interface ProjectState {
  currentProject: ProjectDetail | null
  setCurrentProject: (project: ProjectDetail | null) => void

  currentAlternative: PackagingAlternative | null
  setCurrentAlternative: (alt: PackagingAlternative | null) => void

  selectedView: ViewMode
  setSelectedView: (view: ViewMode) => void

  language: Language
  setLanguage: (lang: Language) => void

  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      setCurrentProject: (project) => {
        set({
          currentProject: project,
          currentAlternative:
            project?.optimization_result?.recommended ||
            project?.optimization_result?.alternatives?.[0] ||
            null,
        })
      },

      currentAlternative: null,
      setCurrentAlternative: (alt) => set({ currentAlternative: alt }),

      selectedView: 'box',
      setSelectedView: (view) => set({ selectedView: view }),

      language: 'en',
      setLanguage: (lang) => {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = lang
        set({ language: lang })
      },

      theme: 'dark',
      setTheme: (theme) => {
        const resolved =
          theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : theme
        document.documentElement.classList.toggle('dark', resolved === 'dark')
        set({ theme })
      },
    }),
    {
      name: 'nxtpak-store',
      partialize: (state) => ({ language: state.language, theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Re-apply theme on reload
          const resolved =
            state.theme === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : state.theme
          document.documentElement.classList.toggle('dark', resolved === 'dark')
          document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr'
          document.documentElement.lang = state.language
        }
      },
    }
  )
)
