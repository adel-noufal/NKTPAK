import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProjectStore, type Theme } from '../../store/projectStore'
import { AssistantPanel } from '../assistant/AssistantPanel'

const ThemeIcon: React.FC<{ theme: Theme }> = ({ theme }) => {
  if (theme === 'light') return <span title="Light mode" aria-hidden>☀</span>
  if (theme === 'dark') return <span title="Dark mode" aria-hidden>☾</span>
  return <span title="System theme" aria-hidden>⊙</span>
}

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { language, setLanguage, theme, setTheme } = useProjectStore()
  const [assistantOpen, setAssistantOpen] = useState(false)

  const handleToggleLanguage = () => {
    const nextLang = language === 'en' ? 'ar' : 'en'
    setLanguage(nextLang)
    i18n.changeLanguage(nextLang)
  }

  const handleCycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

  return (
    <>
      <header className="h-14 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-sm">
        {/* Brand — no version badge */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-stone-800 dark:bg-stone-200 flex items-center justify-center font-black text-white dark:text-stone-900 text-sm shadow group-hover:bg-stone-700 dark:group-hover:bg-stone-100 transition-colors">
            N
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-stone-900 dark:text-stone-100 tracking-tight text-sm">NxtPak AI</span>
            </div>
            <p className="text-[10px] text-stone-500 hidden sm:block leading-none">
              El Araby Group · Packaging Optimization
            </p>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/projects/new"
            className="px-3 py-1.5 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t('actions.newProject', 'New Project')}</span>
            <span className="sm:hidden">New</span>
          </Link>

          {/* AI Assistant button */}
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors"
            title="AI Packaging Assistant"
            aria-label="Open AI Packaging Assistant"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>

          {/* Settings */}
          <Link
            to="/settings"
            className="w-8 h-8 rounded-md flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={handleCycleTheme}
            className="w-8 h-8 rounded-md flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors text-sm"
            title={`Theme: ${theme}. Click to cycle.`}
            aria-label={`Current theme: ${theme}. Click to cycle theme.`}
          >
            <ThemeIcon theme={theme} />
          </button>

          {/* Language toggle */}
          <button
            type="button"
            onClick={handleToggleLanguage}
            className="px-2.5 py-1.5 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors"
            title="Switch language"
            aria-label="Switch language"
          >
            {language === 'en' ? 'ع' : 'EN'}
          </button>
        </div>
      </header>

      {/* Assistant Drawer (rendered at Navbar level, outside main content flow) */}
      <AssistantPanel isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </>
  )
}
