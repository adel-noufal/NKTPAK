import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import { CheckTypeBadge } from '../components/common/StatusBadge'

export const Standards: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['standards-registry'],
    queryFn: async () => {
      const res = await apiClient.get('/standards')
      return res.data
    },
  })

  const standards = data?.standards || []
  const filtered = standards.filter((s: any) => {
    const matchesSearch =
      s.standard_identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.scope_summary.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'ALL' || s.check_type === selectedType
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          📜 Built-in ISO Standards Registry
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
          Complete registry of 16 international packaging standards. NxtPak AI evaluates
          programmatic metrics without hardcoding numeric test parameters from memory.
          Physical tests strictly require laboratory testing and never return PASS from software.
        </p>
      </div>

      {/* Mandatory Evaluation Scope Banner */}
      <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-4 text-xs text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <strong>Evaluation Framework:</strong> Evaluated against NxtPak ISO registry v1.
          No El Araby Group company-specific requirements loaded (proprietary specifications are not public).
        </div>
        <span className="font-mono text-[11px] text-blue-400 shrink-0">16 Verified Standards</span>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Search by ID, title, or keywords (e.g. drop, vibration, 18602)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-96 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
        />

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          {['ALL', 'PROGRAMMATIC', 'PHYSICAL_TEST', 'HUMAN_REVIEW'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                selectedType === t
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Standards List */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs">Loading ISO Registry...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((std: any) => (
            <div
              key={std.entry_id}
              className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-white text-base">
                    {std.standard_identifier}
                  </span>
                  <CheckTypeBadge type={std.check_type} />
                </div>
                {std.source_url && (
                  <a
                    href={std.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>ISO Catalogue Entry</span>
                    <span>↗</span>
                  </a>
                )}
              </div>

              <h3 className="text-sm font-semibold text-slate-200">{std.title}</h3>

              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                {std.scope_summary}
              </p>

              <div className="text-xs text-slate-300">
                <strong className="text-blue-400">Relevance to NxtPak:</strong> {std.relevance_to_nxtpak}
              </div>

              {std.notes_and_limitations && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  ⚠️ Note: {std.notes_and_limitations}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mandatory Bottom Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300/90 leading-relaxed">
        <strong>Mandatory Compliance Disclaimer:</strong>
        <p className="mt-1">
          A software PASS is never proof of ISO certification. Physical tests (drop, vibration,
          stacking, environmental conditioning) must be executed in an accredited testing laboratory.
          NxtPak AI generates preliminary geometric prototypes for engineering review.
        </p>
      </div>
    </div>
  )
}
