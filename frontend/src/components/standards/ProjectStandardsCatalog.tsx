import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import type { StandardsEvaluationResult } from '../../types'

type Organization = 'ISO' | 'ISTA'
type Filter = 'ALL' | Organization

export const ProjectStandardsCatalog: React.FC<{ projectId: string; evaluationResult?: StandardsEvaluationResult | null }> = ({ projectId, evaluationResult }) => {
  const [filter, setFilter] = useState<Filter>('ALL')
  const { data: catalog } = useQuery({ queryKey: ['standards-registry'], queryFn: async () => (await apiClient.get('/standards')).data })
  const { data: plan } = useQuery({ queryKey: ['project-test-plan', projectId], queryFn: async () => (await apiClient.get(`/projects/${projectId}/test-plan`)).data, enabled: Boolean(projectId) })
  const entries = catalog?.standards || []
  const suggested = new Set<string>((plan?.suggested_tests || []).map((item: any) => item.standard_identifier))
  const visible = useMemo(() => filter === 'ALL' ? entries : entries.filter((entry: any) => entry.organization === filter), [entries, filter])
  const statusFor = (entry: any) => {
    if (entry.organization === 'ISTA') return suggested.has(entry.standard_identifier)
      ? { status: 'Recommended', reason: (plan?.suggested_tests || []).find((item: any) => item.standard_identifier === entry.standard_identifier)?.reason }
      : { status: 'Not applicable', reason: plan?.distribution_channel ? 'No recommendation rule matched this shipping mode and weight.' : 'Enter a shipping mode to determine whether this procedure applies.' }
    const result = evaluationResult?.results?.find((item) => item.standard_identifier === entry.standard_identifier)
    return result
      ? { status: 'Applicable', reason: `${result.status}: ${result.details}` }
      : { status: 'Not applicable', reason: 'This entry is not part of the saved evaluation result.' }
  }
  return <div className="space-y-4">
    <div className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-3 text-xs text-blue-200">{catalog?.evaluation_statement || 'Loading registry metadata…'}</div>
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
      <h3 className="text-sm font-bold text-emerald-200">Suggested validation tests (to be performed in an accredited lab)</h3>
      {plan?.suggested_tests?.length ? <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-emerald-100">{plan.suggested_tests.map((item: any) => <li key={item.standard_identifier}><strong>{item.standard_identifier}</strong> — {item.reason}</li>)}</ul> : <p className="mt-2 text-xs text-stone-300">Enter a shipping mode and product weight to get procedure suggestions.</p>}
      <p className="mt-2 text-[11px] text-stone-400">{plan?.guidance_note || 'Summaries are for guidance. Use the current official ISTA procedure for testing.'}</p>
    </div>
    <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs">{(['ALL','ISO','ISTA'] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded px-3 py-1.5 ${filter === item ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{item === 'ALL' ? `All (${entries.length})` : `${item} (${catalog?.counts?.[item] ?? 0})`}</button>)}</div>
    <div className="space-y-3">{visible.map((entry: any) => {
      const applicability = statusFor(entry)
      return <article key={entry.entry_id} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-blue-950 px-2 py-1 text-[10px] font-bold text-blue-300">{entry.organization}</span><strong className="font-mono text-sm text-white">{entry.standard_identifier}</strong><span className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-200">{applicability.status}</span></div>
        <h4 className="text-sm font-semibold text-slate-200">{entry.title}</h4>
        <p className="text-xs text-slate-400">{entry.scope_summary}</p>
        <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><p><strong className="text-slate-300">What it tests:</strong> {entry.what_it_tests}</p><p><strong className="text-slate-300">When it applies:</strong> {entry.when_it_applies}</p></div>
        <p className="text-xs text-slate-300"><strong>Project result:</strong> {applicability.reason}</p>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500"><span>Version: {entry.version || 'Not specified'}</span><span>Last verified: {entry.last_verified_date || 'Not recorded'}</span><a href={entry.source_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Official source ↗</a></div>
      </article>
    })}</div>
  </div>
}
