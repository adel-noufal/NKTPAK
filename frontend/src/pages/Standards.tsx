import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'

type Organization = 'ISO' | 'ISTA'
type CatalogEntry = { entry_id: string; organization: Organization; standard_identifier: string; title: string; title_ar?: string; scope_summary: string; scope_summary_ar?: string; what_it_tests: string; when_it_applies: string; source_url: string; version?: string; last_verified_date?: string; check_type: string; is_user_editable: boolean }
type EntryForm = Omit<CatalogEntry, 'entry_id' | 'is_user_editable'> & { applicability_rules: Record<string, unknown> }
const emptyForm: EntryForm = { organization: 'ISTA', standard_identifier: '', title: '', title_ar: '', scope_summary: '', scope_summary_ar: '', what_it_tests: '', when_it_applies: '', source_url: '', version: '', last_verified_date: new Date().toISOString().slice(0, 10), check_type: 'PHYSICAL_TEST', applicability_rules: {} }

export const Standards: React.FC = () => {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [organization, setOrganization] = useState<'ALL' | Organization>('ALL')
  const [form, setForm] = useState<EntryForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['standards-registry'], queryFn: async () => (await apiClient.get('/standards')).data })
  const standards: CatalogEntry[] = data?.standards || []
  const filtered = useMemo(() => standards.filter((entry) => {
    const matchesOrganization = organization === 'ALL' || entry.organization === organization
    const haystack = `${entry.standard_identifier} ${entry.title} ${entry.scope_summary}`.toLowerCase()
    return matchesOrganization && haystack.includes(search.toLowerCase())
  }), [standards, organization, search])
  const arabic = i18n.language.startsWith('ar')
  const beginEdit = (entry?: CatalogEntry) => {
    setEditingId(entry?.entry_id || null)
    setSaveError('')
    setForm(entry ? { ...emptyForm, ...entry, applicability_rules: {} } : { ...emptyForm })
  }
  const saveEntry = async () => {
    if (!form) return
    try {
      if (editingId) await apiClient.put(`/standards/${editingId}`, form)
      else await apiClient.post('/standards', form)
      await queryClient.invalidateQueries({ queryKey: ['standards-registry'] })
      setForm(null)
      setEditingId(null)
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save entry.') }
  }
  const updateForm = (key: keyof EntryForm, value: string) => setForm((current) => current ? { ...current, [key]: value } : current)

  return <div className="space-y-6">
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="standard-editor-title" className="max-h-[92vh] w-full max-w-3xl space-y-3 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5 text-white"><h2 id="standard-editor-title" className="font-bold">{editingId ? 'Edit standard entry' : 'Add standard entry'}</h2><div className="grid grid-cols-2 gap-3">
      <label className="text-xs">Organisation<select value={form.organization} onChange={(e) => updateForm('organization', e.target.value)} className="mt-1 w-full rounded border bg-slate-900 p-2"><option>ISO</option><option>ISTA</option></select></label>
      {(['standard_identifier','title','title_ar','scope_summary','scope_summary_ar','what_it_tests','when_it_applies','source_url','version','last_verified_date'] as const).map((key) => <label key={key} className="text-xs">{key.replace(/_/g, ' ')}<input aria-label={key.replace(/_/g, ' ')} value={form[key] || ''} onChange={(e) => updateForm(key, e.target.value)} className="mt-1 w-full rounded border bg-slate-900 p-2" /></label>)}
      </div>{saveError && <p role="alert" className="text-xs text-rose-400">{saveError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} className="rounded border px-3 py-2 text-xs">Cancel</button><button type="button" onClick={() => void saveEntry()} className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold">Save entry</button></div></section></div>}
    <header className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold text-white">Standards registry</h1><p className="mt-1 max-w-3xl text-xs text-slate-400">ISO and ISTA metadata catalog. Summaries are for guidance. Use the current official ISTA procedure for testing.</p></div><button type="button" onClick={() => beginEdit()} className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Add standard</button></header>
    <div data-testid="standards-evaluation-banner" className="rounded-xl border border-blue-500/30 bg-blue-950/30 p-4 text-xs text-blue-200">{data?.evaluation_statement || 'Loading registry metadata…'}<div className="mt-1">ISO {data?.counts?.ISO ?? '…'} · ISTA {data?.counts?.ISTA ?? '…'}</div></div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <input aria-label="Search standards" placeholder="Search identifier, title, or scope" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-52 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
      {(['ALL', 'ISO', 'ISTA'] as const).map((filter) => <button key={filter} type="button" onClick={() => setOrganization(filter)} className="rounded-lg px-3 py-1.5 text-xs">{filter === 'ALL' ? `All (${standards.length})` : `${filter} (${data?.counts?.[filter] ?? 0})`}</button>)}
    </div>
    {isLoading ? <p className="py-12 text-center text-xs text-slate-400">Loading standards…</p> : <div className="grid gap-3">{filtered.map((entry) => <article key={entry.entry_id} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div><span className="me-2 rounded bg-blue-950 px-2 py-1 text-[10px] font-bold text-blue-300">{entry.organization}</span><strong className="font-mono text-sm text-white">{entry.standard_identifier}</strong><h2 dir={arabic ? 'rtl' : 'ltr'} className="mt-2 text-sm font-semibold text-slate-200">{arabic ? entry.title_ar || entry.title : entry.title}</h2>{entry.is_user_editable && <button type="button" onClick={() => beginEdit(entry)} className="mt-2 text-xs text-blue-400 hover:underline">Edit entry</button>}</div>
      <p dir={arabic ? 'rtl' : 'ltr'} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">{arabic ? entry.scope_summary_ar || entry.scope_summary : entry.scope_summary}</p>
      <div className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2"><p><strong className="text-slate-300">What it tests:</strong> {entry.what_it_tests}</p><p><strong className="text-slate-300">When it applies:</strong> {entry.when_it_applies}</p><p><strong className="text-slate-300">Version:</strong> {entry.version || 'Not specified'} · <strong>Last verified:</strong> {entry.last_verified_date || 'Not recorded'}</p><a href={entry.source_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Official source ↗</a></div>
    </article>)}</div>}
    <aside className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">Summaries are for guidance. Use the current official ISTA procedure for testing. Physical-test standards require laboratory execution; this app does not certify compliance.</aside>
  </div>
}
