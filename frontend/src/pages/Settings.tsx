import React from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '../store/projectStore'

export const Settings: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { language, setLanguage } = useProjectStore()

  const handleLanguageChange = (lang: 'en' | 'ar') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          ⚙️ Application Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure interface language, units, and review packaging optimization engine parameters.
        </p>
      </div>

      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-6 shadow-xl">
        {/* Language Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            User Interface Language / لغة الواجهة
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                language === 'en'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>English (LTR)</span>
              {language === 'en' && <span>✓</span>}
            </button>

            <button
              type="button"
              onClick={() => handleLanguageChange('ar')}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                language === 'ar'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>العربية (RTL)</span>
              {language === 'ar' && <span>✓</span>}
            </button>
          </div>
        </div>

        {/* Engine Information */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            System & Engine Architecture
          </label>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Active 3D Engine:</span>
              <span className="text-emerald-400 font-bold">trimesh 5.x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ISO Standards Registry:</span>
              <span className="text-blue-400 font-bold">Version 1.0 (16 Standards)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Backend Database:</span>
              <span className="text-slate-200">SQLite (Zero External Infrastructure)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LLM Mode:</span>
              <span className="text-slate-400">Deterministic Engine (No API key needed)</span>
            </div>
          </div>
        </div>

        {/* Project Attribution */}
        <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-200">NxtPak AI Platform</p>
          <p>NXTPAK Hackathon (Egypt) — El Araby Group Packaging Optimization Challenge.</p>
          <p className="text-slate-500 text-[11px] pt-1">
            Free-tier open-source engineering tool developed for industrial packaging engineers.
          </p>
        </div>
      </div>
    </div>
  )
}
