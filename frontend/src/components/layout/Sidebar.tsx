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

const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconUpload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)

export const Sidebar: React.FC = () => {
  const { t } = useTranslation()

  const navItems = [
    { to: '/', label: t('nav.dashboard', 'Dashboard'), icon: <IconDashboard />, end: true },
    { to: '/projects/new', label: t('nav.newProject', 'New Project'), icon: <IconPlus />, end: false },
    { to: '/projects', label: t('nav.projects', 'Projects'), icon: <IconFolder />, end: true },
    { to: '/standards', label: t('nav.standards', 'ISO Standards'), icon: <IconStandards />, end: false },
    { to: '/settings', label: t('nav.settings', 'Settings'), icon: <IconSettings />, end: false },
  ]

  const activeClass = 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 shadow-sm'
  const inactiveClass = 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'

  return (
    <aside className="w-56 border-e border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 flex flex-col justify-between py-4 px-3 hidden md:flex shrink-0">
      <div className="space-y-6">
        {/* Main nav */}
        <nav className="space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 px-2 mb-2">
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

        {/* Tools */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 px-2 mb-2">
            Tools
          </div>
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
        </div>
      </div>
    </aside>
  )
}
export default Sidebar
