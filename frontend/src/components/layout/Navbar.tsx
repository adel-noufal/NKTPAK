import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import apiClient from '../../api/client'
import { useProjectStore, type Theme } from '../../store/projectStore'
import { AssistantPanel } from '../assistant/AssistantPanel'

const ThemeIcon: React.FC<{ theme: Theme }> = ({ theme }) => {
  if (theme === 'light') return <span title="Light mode" aria-hidden>☀</span>
  if (theme === 'dark') return <span title="Dark mode" aria-hidden>☾</span>
  return <span title="System theme" aria-hidden>⊙</span>
}

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']
type NotificationItem = { notification_id: string; title: string; message: string; details: { verification?: { sources?: Array<{ title: string; url: string }>; mismatches?: Array<{ field: string; entered: string; found: string }> } }; is_read: boolean; created_at: string }
type NotificationResponse = { unread_count: number; notifications: NotificationItem[] }

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { language, setLanguage, theme, setTheme } = useProjectStore()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: notificationData } = useQuery<NotificationResponse>({ queryKey: ['notifications'], queryFn: async () => (await apiClient.get('/notifications')).data, refetchInterval: 30000 })
  const markRead = useMutation({ mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) })

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

          <div className="relative">
            <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800" aria-label={`Notifications${notificationData?.unread_count ? ` (${notificationData.unread_count} unread)` : ''}`} aria-expanded={notificationsOpen}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4.5-5.8V4a1.5 1.5 0 00-3 0v1.2A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0" /></svg>
              {!!notificationData?.unread_count && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-4 text-white">{notificationData.unread_count}</span>}
            </button>
            {notificationsOpen && <section aria-label="Notifications" className="absolute end-0 top-10 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-3 shadow-xl dark:border-stone-700 dark:bg-stone-900">
              <h2 className="mb-2 text-xs font-bold text-stone-800 dark:text-stone-100">Notifications</h2>
              {!notificationData?.notifications.length ? <p className="py-4 text-xs text-stone-500">No notifications.</p> : notificationData.notifications.map((item) => <article key={item.notification_id} className={`border-t border-stone-200 py-3 text-xs dark:border-stone-800 ${item.is_read ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2"><strong className="text-stone-800 dark:text-stone-100">{item.title}</strong>{!item.is_read && <button type="button" onClick={() => markRead.mutate(item.notification_id)} className="shrink-0 text-[10px] text-stone-600 underline dark:text-stone-400">Mark read</button>}</div>
                <p className="mt-1 whitespace-pre-wrap text-stone-600 dark:text-stone-300">{item.message}</p>
                {!!item.details.verification?.mismatches?.length && <ul className="mt-2 list-disc space-y-1 ps-4 text-[10px] text-stone-500">{item.details.verification.mismatches.map((mismatch, index) => <li key={`${mismatch.field}-${index}`}>{mismatch.field}: entered “{mismatch.entered}”; found “{mismatch.found}”</li>)}</ul>}
                {!!item.details.verification?.sources?.length && <div className="mt-2 space-y-1">{item.details.verification.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block truncate text-[10px] text-stone-700 underline dark:text-stone-300">{source.title}</a>)}</div>}
              </article>)}
            </section>}
          </div>

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
