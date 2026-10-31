import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectDetail, PackagingAlternative } from '../types'

export type ViewMode = 'exterior' | 'interior'
export type Language = 'en' | 'ar'

interface ProjectState {
  currentProject: ProjectDetail | null
  setCurrentProject: (project: ProjectDetail | null) => void

  currentAlternative: PackagingAlternative | null
  setCurrentAlternative: (alt: PackagingAlternative | null) => void

  selectedView: ViewMode
  setSelectedView: (view: ViewMode) => void
  toggleView: () => void

  language: Language
  setLanguage: (lang: Language) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      setCurrentProject: (project) => {
        set({
          currentProject: project,
          currentAlternative: project?.optimization_result?.recommended || project?.optimization_result?.alternatives?.[0] || null,
        })
      },

      currentAlternative: null,
      setCurrentAlternative: (alt) => set({ currentAlternative: alt }),

      selectedView: 'exterior',
      setSelectedView: (view) => set({ selectedView: view }),
      toggleView: () =>
        set({ selectedView: get().selectedView === 'exterior' ? 'interior' : 'exterior' }),

      language: 'en',
      setLanguage: (lang) => {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = lang
        set({ language: lang })
      },
    }),
    {
      name: 'nxtpak-store',
      partialize: (state) => ({ language: state.language }),
    }
  )
)
