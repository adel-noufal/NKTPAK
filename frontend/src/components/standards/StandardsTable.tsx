import React, { useState } from 'react'
import type { StandardsEvaluationResult, StandardsCheckResult } from '../../types'
import { StatusBadge, CheckTypeBadge } from '../common/StatusBadge'

interface StandardsTableProps {
  evaluationResult?: StandardsEvaluationResult | null
}

export const StandardsTable: React.FC<StandardsTableProps> = ({ evaluationResult }) => {
  const [filterType, setFilterType] = useState<string>('ALL')

  if (!evaluationResult) {
    return (
      <div className="bg-slate-900/60 p-8 rounded-xl border border-slate-800 text-center text-slate-400">
        No standards evaluation data available yet. Generate or load a packaging alternative first.
      </div>
    )
  }

  const results = evaluationResult.results || []
  const filtered = filterType === 'ALL'
    ? results
    : results.filter((r) => r.check_type === filterType)

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Programmatic Pass</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {evaluationResult.programmatic_pass_count}
          </div>
        </div>
        <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Physical Tests</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">
            {evaluationResult.not_verifiable_count}
          </div>
        </div>
        <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Needs Review</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {evaluationResult.needs_review_count}
          </div>
        </div>
        <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Not Configured</div>
          <div className="text-2xl font-bold text-slate-400 mt-1">
            {evaluationResult.not_configured_count}
          </div>
        </div>
        <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Failed</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {evaluationResult.programmatic_fail_count}
          </div>
        </div>
      </div>

      {/* Mandatory Scope Banner */}
      <div className="bg-blue-950/30 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-200 flex items-center justify-between">
        <div>
          <strong>Registry Scope:</strong> {evaluationResult.evaluation_statement}
        </div>
        <span className="text-[11px] text-blue-400 font-mono">v{evaluationResult.registry_version}</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs">
        {['ALL', 'PROGRAMMATIC', 'PHYSICAL_TEST', 'HUMAN_REVIEW'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              filterType === type
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Standards List */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800">
          {filtered.map((item: StandardsCheckResult) => (
            <div key={item.entry_id} className="p-4 hover:bg-slate-850/40 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-slate-200 text-sm">
                    {item.standard_identifier}
                  </span>
                  <CheckTypeBadge type={item.check_type} />
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="text-xs font-medium text-slate-300 mb-2">{item.title}</div>
              <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60 font-mono">
                {item.details}
              </p>

              {item.what_is_still_required && item.what_is_still_required.length > 0 && (
                <div className="mt-2.5 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Remaining Steps:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                    {item.what_is_still_required.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300/90 leading-relaxed">
        <strong>⚠️ Mandatory Engineering Compliance Notice:</strong>
        <p className="mt-1">{evaluationResult.disclaimer}</p>
      </div>
    </div>
  )
}
