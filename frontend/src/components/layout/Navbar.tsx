import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '../../store/projectStore'

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { language, setLanguage } = useProjectStore()

  const handleToggleLanguage = () => {
    const nextLang = language === 'en' ? 'ar' : 'en'
    setLanguage(nextLang)
    i18n.changeLanguage(nextLang)
  }

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-lg shadow-md group-hover:scale-105 transition-transform">
          N
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 tracking-tight text-base">NxtPak AI</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
              v1.0
            </span>
          </div>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            El Araby Group Packaging Optimization Challenge
          </p>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          to="/projects/new"
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{t('actions.newProject', 'New Project')}</span>
        </Link>

        {/* Language Switcher */}
        <button
          type="button"
          onClick={handleToggleLanguage}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
          title="Switch Language"
        >
          <span>🌐</span>
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>
    </header>
  )
}
