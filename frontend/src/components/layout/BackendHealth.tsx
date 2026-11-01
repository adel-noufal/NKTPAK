import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { API_BASE_URL } from '../../api/client'
import { checkBackendHealth } from '../../api/health'

interface BackendHealthState { reachable: boolean; retry: () => Promise<void> }
const BackendHealthContext = createContext<BackendHealthState>({ reachable: false, retry: async () => {} })

export const useBackendHealth = () => useContext(BackendHealthContext)

export const BackendHealth: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [reachable, setReachable] = useState(false)
  const retry = useCallback(async () => setReachable(await checkBackendHealth()), [])
  useEffect(() => {
    void retry()
    const timer = window.setInterval(() => void retry(), 10_000)
    return () => window.clearInterval(timer)
  }, [retry])

  return <BackendHealthContext.Provider value={{ reachable, retry }}>
    {!reachable && <div role="alert" className="flex items-center justify-center gap-3 bg-rose-100 px-4 py-2 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-100">
      <span>Backend not reachable at {API_BASE_URL}. Start the backend and retry</span>
      <button type="button" onClick={() => void retry()} className="rounded border border-current px-3 py-1 font-semibold">Retry</button>
    </div>}
    {children}
  </BackendHealthContext.Provider>
}
