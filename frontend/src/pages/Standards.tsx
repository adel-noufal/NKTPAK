import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'

type Filter = 'ALL' | 'ISO' | 'ISTA' | 'ADDED_BY_ME'
type Organization = 'ISO' | 'ISTA' | 'ASTM' | 'TAPPI' | 'FEFCO' | 'EN' | 'BS' | 'DIN' | 'OTHER'
type CatalogEntry = { entry_id: string; organization: string; standard_identifier: string; title: string; title_ar?: string; scope_summary: string; scope_summary_ar?: string; what_it_tests: string; when_it_applies: string; source_url: string; version?: string; last_verified_date?: string; check_type: string; is_user_editable: boolean; added_by_me?: boolean; verification_status?: string }
type EntryForm = Omit<CatalogEntry, 'entry_id' | 'is_user_editable' | 'added_by_me' | 'verification_status'> & { organization: Organization; organization_other: string; applicability_rules: Record<string, unknown> }
type RegistryResponse = { standards: CatalogEntry[]; evaluation_statement: string; counts?: Record<string, number> }

const emptyForm: EntryForm = { organization: 'ISTA', organization_other: '', standard_identifier: '', title: '', title_ar: '', scope_summary: '', scope_summary_ar: '', what_it_tests: '', when_it_applies: '', source_url: '', version: '', last_verified_date: '', check_type: 'PHYSICAL_TEST', applicability_rules: {} }
const inputClass = 'mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500'
const labelClass = 'block text-xs font-medium text-stone-700 dark:text-stone-300'
const organizations: Organization[] = ['ISO', 'ISTA', 'ASTM', 'TAPPI', 'FEFCO', 'EN', 'BS', 'DIN', 'OTHER']

export const Standards: React.FC = () => {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [form, setForm] = useState<EntryForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const { data, isLoading } = useQuery<RegistryResponse>({ queryKey: ['standards-registry'], queryFn: async () => (await apiClient.get('/standards')).data })
  const standards = data?.standards || []
  const counts = useMemo(() => ({
    ALL: standards.length,
    ISO: standards.filter((entry) => entry.organization.toUpperCase() === 'ISO').length,
    ISTA: standards.filter((entry) => entry.organization.toUpperCase() === 'ISTA').length,
    ADDED_BY_ME: standards.filter((entry) => entry.added_by_me || entry.is_user_editable).length,
  }), [standards])
  const filtered = useMemo(() => standards.filter((entry) => {
    const matches = filter === 'ALL' || filter === 'ADDED_BY_ME'
      ? filter === 'ALL' || Boolean(entry.added_by_me || entry.is_user_editable)
      : entry.organization.toUpperCase() === filter
    const haystack = `${entry.standard_identifier} ${entry.title} ${entry.scope_summary} ${entry.organization}`.toLowerCase()
    return matches && haystack.includes(search.toLowerCase())
  }), [standards, filter, search])
  const arabic = i18n.language.startsWith('ar')

  const beginEdit = (entry?: CatalogEntry) => {
    setEditingId(entry?.entry_id || null)
    setSaveError('')
    setForm(entry ? { ...emptyForm, ...entry, organization: organizations.includes(entry.organization as Organization) ? entry.organization as Organization : 'OTHER', organization_other: organizations.includes(entry.organization as Organization) ? '' : entry.organization, applicability_rules: {} } : { ...emptyForm })
  }
  const updateForm = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current)

  const saveEntry = async () => {
    if (!form) return
    const issues: string[] = []
    if (form.standard_identifier.trim().length < 3) issues.push('Identifier must contain at least 3 characters.')
    if (form.title.trim().length < 6) issues.push('Title must contain at least 6 characters.')
    if (form.scope_summary.trim().length < 20) issues.push('Scope summary must contain at least 20 characters.')
    if (form.organization === 'OTHER' && form.organization_other.trim().length < 2) issues.push('Enter the other organization name.')
    if (issues.length) { setSaveError(issues.join(' ')); return }
    setSaving(true)
    setSaveError('')
    setToast('')
    try {
      const payload = { ...form, standard_identifier: form.standard_identifier.trim(), title: form.title.trim(), scope_summary: form.scope_summary.trim() }
      if (editingId) await apiClient.put(`/standards/${editingId}`, payload)
      else await apiClient.post('/standards', payload)
      await queryClient.invalidateQueries({ queryKey: ['standards-registry'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setToast('Standard verified and added.')
      setForm(null)
      setEditingId(null)
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : detail?.message || error?.message || 'Could not verify this standard.'
      setSaveError(message)
      setToast(typeof detail === 'object' && detail?.notification_id ? `Standard refused: ${form.standard_identifier}.` : message)
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } finally { setSaving(false) }
  }

  return <div className="space-y-6">
    {toast && <div role="status" className="rounded-lg border border-stone-300 bg-stone-100 px-4 py-3 text-xs text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">{toast}<button type="button" className="ms-3 underline" onClick={() => setToast('')}>Dismiss</button></div>}
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="standard-editor-title" className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 text-stone-900 shadow-2xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
        <div><h2 id="standard-editor-title" className="text-base font-bold">{editingId ? 'Edit standard entry' : 'Add standard entry'}</h2><p className="mt-1 text-xs text-stone-500 dark:text-stone-400">New entries are checked against grounded web sources before they are saved.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Organisation<select value={form.organization} onChange={(e) => updateForm('organization', e.target.value as Organization)} className={inputClass}>{organizations.map((organization) => <option key={organization} value={organization}>{organization === 'OTHER' ? 'Other' : organization}</option>)}</select></label>
          {form.organization === 'OTHER' && <label className={labelClass}>Organisation name<input aria-label="Other organization name" value={form.organization_other} onChange={(e) => updateForm('organization_other', e.target.value)} className={inputClass} /></label>}
          <label className={labelClass}>Identifier <span className="text-rose-600">*</span><input aria-label="standard identifier" value={form.standard_identifier} onChange={(e) => updateForm('standard_identifier', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Title <span className="text-rose-600">*</span><input aria-label="title" value={form.title} onChange={(e) => updateForm('title', e.target.value)} className={inputClass} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Scope summary <span className="text-rose-600">*</span><textarea aria-label="scope summary" rows={3} value={form.scope_summary} onChange={(e) => updateForm('scope_summary', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Version / edition<input aria-label="version" value={form.version || ''} onChange={(e) => updateForm('version', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Source URL<input aria-label="source url" type="url" value={form.source_url || ''} onChange={(e) => updateForm('source_url', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>What it tests<input aria-label="what it tests" value={form.what_it_tests} onChange={(e) => updateForm('what_it_tests', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>When it applies<input aria-label="when it applies" value={form.when_it_applies} onChange={(e) => updateForm('when_it_applies', e.target.value)} className={inputClass} /></label>
        </div>
        {saveError && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{saveError}</p>}
        <div className="flex justify-end gap-2 border-t border-stone-200 pt-3 dark:border-stone-700"><button type="button" onClick={() => setForm(null)} className="rounded-md border border-stone-300 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">Cancel</button><button type="button" disabled={saving} onClick={() => void saveEntry()} className="rounded-md bg-stone-800 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-700 disabled:opacity-50 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100">{saving ? 'Checking sources…' : 'Save entry'}</button></div>
      </section>
    </div>}

    <header className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Standards registry</h1><p className="mt-1 max-w-3xl text-xs text-stone-500 dark:text-stone-400">Standards metadata and source links. Summaries are guidance; physical tests require laboratory execution.</p></div><button type="button" onClick={() => beginEdit()} className="rounded-md bg-stone-800 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100">Add standard</button></header>
    <div data-testid="standards-evaluation-banner" className="rounded-xl border border-stone-200 bg-stone-100 p-4 text-xs text-stone-700 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300"><p>{data?.evaluation_statement || 'Loading registry metadata…'}</p><p className="mt-1">ISO {counts.ISO} · ISTA {counts.ISTA} = {counts.ISO + counts.ISTA}</p></div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <input aria-label="Search standards" placeholder="Search identifier, title, or scope" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} mt-0 min-w-52 flex-1`} />
      {(['ALL', 'ISO', 'ISTA', 'ADDED_BY_ME'] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${filter === item ? 'border-stone-700 bg-stone-800 text-white dark:border-stone-300 dark:bg-stone-200 dark:text-stone-900' : 'border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800'}`}>{item === 'ALL' ? 'All' : item === 'ADDED_BY_ME' ? 'Added by me' : `${item} standards`} ({counts[item]})</button>)}
    </div>
    {isLoading ? <p className="py-12 text-center text-xs text-stone-500">Loading standards…</p> : filtered.length === 0 ? <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-900/60">No standards match this filter.</p> : <div className="grid gap-3">{filtered.map((entry) => <article key={entry.entry_id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-md border border-stone-300 bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">{entry.organization}</span><strong className="font-mono text-sm text-stone-900 dark:text-stone-100">{entry.standard_identifier}</strong>{entry.verification_status === 'Verified' && <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Verified</span>}{(entry.added_by_me || entry.is_user_editable) && <span className="rounded-md border border-stone-300 px-2 py-1 text-[10px] text-stone-600 dark:border-stone-700 dark:text-stone-400">Added by me</span>}<h2 dir={arabic ? 'rtl' : 'ltr'} className="w-full text-sm font-semibold text-stone-800 dark:text-stone-200">{arabic ? entry.title_ar || entry.title : entry.title}</h2></div>
      <p dir={arabic ? 'rtl' : 'ltr'} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-950/50 dark:text-stone-300">{arabic ? entry.scope_summary_ar || entry.scope_summary : entry.scope_summary}</p>
      <div className="grid gap-1 text-xs text-stone-500 sm:grid-cols-2"><p><strong className="text-stone-700 dark:text-stone-300">What it tests:</strong> {entry.what_it_tests}</p><p><strong className="text-stone-700 dark:text-stone-300">When it applies:</strong> {entry.when_it_applies}</p><p><strong className="text-stone-700 dark:text-stone-300">Version:</strong> {entry.version || 'Not specified'} · <strong>Last verified:</strong> {entry.last_verified_date || 'Not recorded'}</p><a href={entry.source_url} target="_blank" rel="noreferrer" className="text-stone-700 underline hover:text-stone-900 dark:text-stone-300 dark:hover:text-white">Official source ↗</a></div>
      {entry.is_user_editable && <button type="button" onClick={() => beginEdit(entry)} className="text-xs text-stone-600 underline hover:text-stone-900 dark:text-stone-400 dark:hover:text-white">Edit entry</button>}
    </article>)}</div>}
    <aside className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">Summaries are for guidance. Physical-test standards require laboratory execution; this app does not certify compliance.</aside>
  </div>
}
