import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAdminSettings,
  updateAdminSettings,
  fetchLLMModels,
  testLLMConnection,
} from '../api/projects'
import type { AdminSettingsResponse } from '../types'
import type { LLMTestResult } from '../api/projects'

const DEFAULT_MODELS: Record<string, string[]> = {
  anthropic: [
    'claude-opus-4-5',
    'claude-sonnet-4-5',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
  ],
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
}

export const Settings: React.FC = () => {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<LLMTestResult | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const [provider, setProvider] = useState<'anthropic' | 'gemini' | 'openai'>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-2.5-flash')
  const [availableModels, setAvailableModels] = useState<string[]>(DEFAULT_MODELS.gemini)
  const [clearanceMm, setClearanceMm] = useState(15.0)
  const [costPerM2, setCostPerM2] = useState(18.5)
  const [currency, setCurrency] = useState('EGP')
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data: AdminSettingsResponse = await getAdminSettings()
      const prov = (data.llm_provider ?? 'gemini') as 'anthropic' | 'gemini' | 'openai'
      setProvider(prov)

      let savedModel = data.llm_model || DEFAULT_MODELS[prov][0]
      // Automatically replace retired gemini-1.5-pro with gemini-2.5-flash
      if (prov === 'gemini' && (savedModel.includes('1.5-pro') || !savedModel)) {
        savedModel = 'gemini-2.5-flash'
        setMessage({
          type: 'info',
          text: 'The saved model gemini-1.5-pro is retired. Model updated to gemini-2.5-flash.',
        })
      }

      setModel(savedModel)
      setIsConfigured(data.llm_configured)
      setClearanceMm(data.default_clearance_mm ?? 15.0)
      setCostPerM2(data.default_board_cost_per_m2 ?? 18.5)
      setCurrency(data.currency || 'EGP')

      // Load model list for the saved provider
      await loadModels(prov, '', savedModel)
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load system settings' })
    } finally {
      setLoading(false)
    }
  }

  const loadModels = useCallback(async (prov: string, key: string, currentModel?: string) => {
    setLoadingModels(true)
    try {
      const models = await fetchLLMModels(prov, key || undefined)
      const list = models.length ? models : DEFAULT_MODELS[prov] ?? []
      setAvailableModels(list)

      const active = currentModel || model
      if (!list.includes(active) && list.length > 0) {
        setModel(list[0])
      }
    } catch {
      setAvailableModels(DEFAULT_MODELS[prov] ?? [])
    } finally {
      setLoadingModels(false)
    }
  }, [model])

  const handleProviderChange = (newProvider: 'anthropic' | 'gemini' | 'openai') => {
    setProvider(newProvider)
    const defaults = DEFAULT_MODELS[newProvider] ?? []
    setAvailableModels(defaults)
    const nextModel = defaults[0] ?? ''
    setModel(nextModel)
    setTestResult(null)
    loadModels(newProvider, apiKey, nextModel)
  }

  const handleApiKeyBlur = () => {
    if (apiKey.trim()) {
      loadModels(provider, apiKey.trim(), model)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setMessage(null)
      const res = await updateAdminSettings({
        llm_provider: provider,
        llm_api_key: apiKey ? apiKey.trim() : undefined,
        llm_model: model.trim(),
        default_clearance_mm: Number(clearanceMm),
        default_board_cost_per_m2: Number(costPerM2),
        currency: currency.trim(),
      })
      setIsConfigured(res.llm_configured)
      setMessage({ type: 'success', text: t('settings.saveSuccess', 'Settings successfully updated!') })
      setApiKey('') // Clear raw key from memory after saving
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || err?.message || 'Failed to update settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      const result = await testLLMConnection(provider, apiKey.trim(), model.trim())
      setTestResult(result)
      if (result.success) {
        setIsConfigured(true)
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.response?.data?.detail || err?.message || 'Connection test failed',
      })
    } finally {
      setTesting(false)
    }
  }

  // Determine configuration state for badge
  const renderStatusBadge = () => {
    if (testResult?.success) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Connected ({testResult.model_used || model}, {testResult.latency_ms ?? 0} ms)
        </span>
      )
    }
    if (testResult && !testResult.success) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Connection Failed
        </span>
      )
    }
    if (isConfigured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Key Saved (Not Tested)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Not Configured (Offline)
      </span>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
      </div>
    )
  }

  const modelNotInList = model && availableModels.length > 0 && !availableModels.includes(model)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          {t('settings.title', 'System Settings & Engineering Defaults')}
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          {t('settings.subtitle', 'Configure AI Assistant providers, default engineering clearances, and material costs.')}
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : message.type === 'info'
              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* AI Assistant Configuration Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('settings.aiSection', 'AI Assistant & LLM Provider')}
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {t('settings.aiSectionDesc', 'Enables AI reasoning and explanations. All core geometry & calculations work without an API key.')}
              </p>
            </div>
            <div>{renderStatusBadge()}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Provider */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('settings.provider', 'LLM Provider')}
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as any)}
                className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500"
              >
                <option value="gemini">Google Gemini (Free tier available — Recommended)</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI GPT-4o</option>
              </select>
            </div>

            {/* Model — live dropdown */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('settings.model', 'Model')}
                {loadingModels && (
                  <span className="ms-1.5 text-[10px] text-stone-400">Loading models…</span>
                )}
              </label>
              {availableModels.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500 font-mono"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gemini-2.5-flash"
                  className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500 font-mono"
                />
              )}
              {modelNotInList && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  ⚠ Saved model "{model}" is not in the live list. It may be retired — pick another.
                </p>
              )}
            </div>

            {/* API Key */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('settings.apiKey', 'API Key')}
                <span className="ms-1.5 text-[10px] text-stone-400 font-normal">
                  ({t('settings.apiKeyNote', 'Stored on local backend only. Never sent to browser.')})
                </span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={handleApiKeyBlur}
                  placeholder={isConfigured ? '•••••••••••••••••••••••• (leave blank to keep existing key)' : 'sk-ant-... or AIza...'}
                  className="w-full text-xs px-3 py-2 pe-16 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute end-2 top-2 text-[10px] font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 px-2 py-0.5 rounded"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                Enter your API key and click "Test AI Connection" to verify real-time response.
              </p>
            </div>
          </div>

          {/* Test connection */}
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="text-xs px-3 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? (
                <>
                  <div className="w-3 h-3 border-2 border-stone-400 border-t-stone-700 rounded-full animate-spin" />
                  <span>Testing connection…</span>
                </>
              ) : (
                <span>Test AI Connection</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => loadModels(provider, apiKey, model)}
              disabled={loadingModels}
              className="text-xs px-3 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium transition-colors disabled:opacity-50"
            >
              {loadingModels ? 'Loading models…' : 'Refresh Models List'}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded text-[11px] border font-mono whitespace-pre-wrap ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}
            >
              {testResult.success ? (
                <>
                  ✓ Connection successful — {testResult.provider} / {testResult.model_used}
                  {testResult.latency_ms != null ? ` (${testResult.latency_ms} ms)` : ''}
                </>
              ) : (
                <>✗ {testResult.error}</>
              )}
            </div>
          )}
        </div>

        {/* Engineering Defaults Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-stone-100 dark:border-stone-800 pb-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('settings.engineeringSection', 'Packaging Engineering Defaults')}
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {t('settings.engineeringSectionDesc', 'Default assumptions for clearances and corrugated board sheet costs. Label: ENGINEERING_ASSUMPTION.')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('settings.defaultClearance', 'Default Clearance (mm)')}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={clearanceMm}
                onChange={(e) => setClearanceMm(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500 font-mono"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">ENGINEERING_ASSUMPTION</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('settings.defaultBoardCost', 'Default Board Cost per m²')}
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={costPerM2}
                onChange={(e) => setCostPerM2(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500 font-mono"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">Corrugated sheet cost</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('settings.currency', 'Currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500"
              >
                <option value="EGP">EGP (Egyptian Pound)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Status Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-3">
            System Status
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            Geometry engine: <span className="font-semibold text-stone-700 dark:text-stone-300">trimesh (active)</span>
            {' '}· Standards: <span className="font-semibold text-stone-700 dark:text-stone-300">NxtPak ISO Registry v1 (16 standards)</span>
          </p>
          <p className="text-[10px] text-stone-400 mt-1">
            Evaluated against: NxtPak ISO registry v1 (see source list). No company-specific requirements loaded.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors disabled:opacity-50"
          >
            {saving ? t('actions.saving', 'Saving…') : t('actions.saveSettings', 'Save Settings')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Settings
