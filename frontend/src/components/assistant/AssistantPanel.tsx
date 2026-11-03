import React, { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sendAssistantMessage } from '../../api/projects'
import { useProjectStore } from '../../store/projectStore'
import type { AssistantMessage } from '../../types'
import { useLocation } from 'react-router-dom'

const QUICK_ACTIONS = [
  { label: 'Analyse packaging data', action: 'Analyse the packaging data and highlight anything that looks off.' },
  { label: 'Explain comparison', action: 'Explain the difference between the optimization alternatives.' },
  { label: 'How to reduce material?', action: 'How can we reduce the material used without lowering protection?' },
  { label: 'What is missing?', action: 'What required information is still missing from this project?' },
]

function renderAssistantMarkdown(content: string): React.ReactNode {
  const inline = (value: string, key: string) => value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${key}-${index}`}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${key}-${index}`}>{part}</React.Fragment>,
  )
  return content.split('\n').map((line, index) => {
    const match = line.match(/^\s*[-*]\s+(.+)$/)
    return match
      ? <div key={index} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{inline(match[1], String(index))}</span></div>
      : <React.Fragment key={index}>{inline(line, String(index))}{index < content.split('\n').length - 1 && <br />}</React.Fragment>
  })
}

interface AssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [mode, setMode] = useState<'ai' | 'offline'>('offline')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const { currentProject } = useProjectStore()
  const [pageLabel, setPageLabel] = useState(location.pathname)

  const mutation = useMutation({
    mutationFn: sendAssistantMessage,
    onSuccess: (res) => {
      setMode(res.mode)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.reply, timestamp: new Date().toISOString() },
      ])
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message ?? 'Could not reach assistant'}`,
          timestamp: new Date().toISOString(),
        },
      ])
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      try {
        const snapshot = JSON.parse(sessionStorage.getItem('nxtpak:assistant-page-context') || '{}')
        setPageLabel(`${snapshot.page_title || location.pathname}${snapshot.active_view ? ` · ${snapshot.active_view}` : ''}`)
      } catch { setPageLabel(location.pathname) }
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, location.pathname])

  const send = (text: string) => {
    if (!text.trim()) return
    const userMsg: AssistantMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    let pageSnapshot: Record<string, unknown> = {}
    try {
      pageSnapshot = JSON.parse(sessionStorage.getItem('nxtpak:assistant-page-context') || '{}')
    } catch { /* Continue with route-only context if the snapshot is unavailable. */ }
    mutation.mutate({
      project_id: currentProject?.project_id ?? null,
      message: text.trim(),
      page_context: { ...pageSnapshot, route: location.pathname, page_title: document.title },
      history: messages.slice(-10),
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in drawer from right */}
      <aside
        className="fixed top-0 end-0 z-50 h-full w-80 sm:w-96 bg-white dark:bg-stone-900 border-s border-stone-200 dark:border-stone-700 shadow-2xl flex flex-col"
        role="dialog"
        aria-label="AI Packaging Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-700 shrink-0 h-14">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${mode === 'ai' ? 'bg-emerald-500' : 'bg-amber-400'}`}
              title={mode === 'ai' ? 'AI mode — connected' : 'Offline mode — deterministic only'}
            />
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
              Packaging Assistant
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              mode === 'ai'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
            }`}>
              {mode}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1 rounded"
            aria-label="Close assistant"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="px-4 py-1.5 border-b border-stone-100 dark:border-stone-800 text-[10px] text-stone-500">Looking at: {pageLabel}</p>

        {/* AI disclaimer */}
        {mode === 'ai' && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400 shrink-0">
            AI mode: your question and project data summary are sent to the configured LLM provider.
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-xs text-stone-400 pt-4 space-y-4">
              <p className="text-stone-500 dark:text-stone-400">
                Ask about packaging data, ISO results, or optimization alternatives.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.action}
                    type="button"
                    onClick={() => send(qa.action)}
                    className="text-start px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-stone-800 dark:bg-stone-700 text-white rounded-br-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-bl-sm'
                }`}
              >
                {renderAssistantMarkdown(msg.content)}
              </div>
            </div>
          ))}

          {mutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-stone-100 dark:bg-stone-800 px-3 py-2 rounded-lg rounded-bl-sm text-xs text-stone-400">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-stone-200 dark:border-stone-700 shrink-0 flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 text-xs px-3 py-2 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-500"
            disabled={mutation.isPending}
            aria-label="Ask the assistant"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !input.trim()}
            className="px-3 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </aside>
    </>
  )
}
