import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { AssistantPanel } from '../assistant/AssistantPanel'
import { useProjectStore } from '../../store/projectStore'

export const Layout: React.FC = () => {
  const { language, theme } = useProjectStore()

  // Sync dir + lang on every change
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  // Sync dark/light class on change
  useEffect(() => {
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [theme])

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans"
    >
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
          {/* Floating assistant available on all pages */}
          <AssistantPanel />
        </main>
      </div>
    </div>
  )
}
