import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProjectStore, type Theme } from '../../store/projectStore'

const ThemeIcon: React.FC<{ theme: Theme }> = ({ theme }) => {
  if (theme === 'light') return <span title="Light mode" aria-hidden>☀</span>
  if (theme === 'dark') return <span title="Dark mode" aria-hidden>☾</span>
  return <span title="System theme" aria-hidden>⊙</span>
}

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { language, setLanguage, theme, setTheme } = useProjectStore()

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
    <header className="h-14 border-b border-slate-800 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-sm">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow group-hover:bg-blue-500 transition-colors">
          N
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-sm">NxtPak AI</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
              v1
            </span>
          </div>
          <p className="text-[10px] text-slate-500 hidden sm:block leading-none">
            El Araby Group · Packaging Optimization
          </p>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          to="/projects/new"
          className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">{t('actions.newProject', 'New Project')}</span>
          <span className="sm:hidden">New</span>
        </Link>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={handleCycleTheme}
          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors text-sm"
          title={`Theme: ${theme}. Click to cycle.`}
          aria-label={`Current theme: ${theme}. Click to cycle theme.`}
        >
          <ThemeIcon theme={theme} />
        </button>

        {/* Language toggle */}
        <button
          type="button"
          onClick={handleToggleLanguage}
          className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
          title="Switch language"
          aria-label="Switch language"
        >
          {language === 'en' ? 'ع' : 'EN'}
        </button>
      </div>
    </header>
  )
}
