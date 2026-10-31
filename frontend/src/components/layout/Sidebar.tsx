import React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Simple line-icon SVG components (no emoji)
const IconDashboard = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
  </svg>
)

const IconFolder = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
)

const IconStandards = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const IconUpload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)

const IconAssistant = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
)

export const Sidebar: React.FC = () => {
  const { t } = useTranslation()

  const navItems = [
    { to: '/', label: t('nav.dashboard', 'Dashboard'), icon: <IconDashboard />, end: true },
    { to: '/projects/new', label: t('nav.newProject', 'New Project'), icon: <IconPlus />, end: false },
    { to: '/projects', label: t('nav.projects', 'Projects'), icon: <IconFolder />, end: true },
    { to: '/standards', label: t('nav.standards', 'ISO Standards'), icon: <IconStandards />, end: false },
  ]

  const activeClass = 'bg-blue-600 text-white shadow-sm'
  const inactiveClass = 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'

  return (
    <aside className="w-56 border-e border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between py-4 px-3 hidden md:flex shrink-0">
      <div className="space-y-6">
        {/* Main nav */}
        <nav className="space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2 mb-2">
            Workspace
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                  isActive ? activeClass : inactiveClass
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Tools — working features */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2 mb-2">
            Tools
          </div>
          {/* Upload 3D/CAD — available in New Project flow */}
          <NavLink
            to="/projects/new?start=upload"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                isActive ? activeClass : inactiveClass
              }`
            }
          >
            <IconUpload />
            <span>Upload 3D / CAD</span>
          </NavLink>

          {/* AI Assistant — available within any project */}
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                isActive ? activeClass : inactiveClass
              }`
            }
            title="Open a project to use the assistant"
          >
            <IconAssistant />
            <span>AI Assistant</span>
          </NavLink>
        </div>
      </div>

      {/* Engine status */}
      <div className="bg-white dark:bg-slate-950/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Geometry</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">trimesh</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Standards</span>
          <span className="text-blue-600 dark:text-blue-400">ISO Registry v1</span>
        </div>
        <div className="flex items-center justify-between">
          <span>LLM</span>
          <span className="text-slate-400">offline</span>
        </div>
      </div>
    </aside>
  )
}
