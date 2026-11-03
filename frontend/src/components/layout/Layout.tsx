import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { useProjectStore } from '../../store/projectStore'
import { BackendHealth } from './BackendHealth'

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
    <BackendHealth><div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="h-screen overflow-hidden bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans"
    >
      <Navbar />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div></BackendHealth>
  )
}
