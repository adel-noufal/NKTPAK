import React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const Sidebar: React.FC = () => {
  const { t } = useTranslation()

  const navItems = [
    { to: '/', label: t('nav.dashboard', 'Dashboard'), icon: '📊' },
    { to: '/projects/new', label: t('nav.newProject', 'New Project'), icon: '➕' },
    { to: '/projects', label: t('nav.projects', 'Projects'), icon: '📁' },
    { to: '/standards', label: t('nav.standards', 'ISO Standards'), icon: '📜' },
    { to: '/settings', label: t('nav.settings', 'Settings'), icon: '⚙️' },
  ]

  const plannedItems = [
    { label: t('nav.aiAssistant', 'AI Assistant'), icon: '🤖' },
    { label: 'Upload 3D/CAD', icon: '📤' },
  ]

  return (
    <aside className="w-64 border-e border-slate-800 bg-slate-900/50 flex flex-col justify-between p-4 hidden md:flex shrink-0">
      <div className="space-y-6">
        {/* Navigation */}
        <nav className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
            Workspace
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Future Roadmap / Planned */}
        <div className="space-y-1 pt-4 border-t border-slate-800/80">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
            Roadmap
          </div>
          {plannedItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-500 cursor-not-allowed"
              title="Planned for upcoming milestone"
            >
              <div className="flex items-center gap-3">
                <span className="text-base opacity-60">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                Planned
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Engine Status pill */}
      <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between font-mono">
          <span>Engine:</span>
          <span className="text-emerald-400 font-semibold">trimesh</span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span>Standards:</span>
          <span className="text-blue-400">ISO Registry v1</span>
        </div>
      </div>
    </aside>
  )
}
