import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listProjects, listExamples, loadExample } from '../api/projects'
import { DataBadge } from '../components/common/DataBadge'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [searchFilter, setSearchFilter] = useState('')

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  const { data: examples = [] } = useQuery({
    queryKey: ['examples'],
    queryFn: listExamples,
  })

  const [loadingExampleId, setLoadingExampleId] = React.useState<string | null>(null)

  const handleLoadExample = async (exampleId: string) => {
    try {
      setLoadingExampleId(exampleId)
      const res = await loadExample(exampleId)
      navigate(`/projects/${res.project_id}`)
    } catch (err: any) {
      alert(`Could not load example: ${err.message}`)
    } finally {
      setLoadingExampleId(null)
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (p.product_name && p.product_name.toLowerCase().includes(searchFilter.toLowerCase()))
  )

  return (
    <div className="space-y-8 pb-10">
      {/* Friendly Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 p-6 sm:p-8 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="absolute top-0 end-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs font-semibold border border-blue-500/30">
            <span>✨</span>
            <span>NXTPAK Hackathon — El Araby Group Challenge</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Right-Sized Packaging with Deterministic 3D Optimization
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            Save cardboard, foam cushioning, and shipping volume without compromising product safety.
            Compute material & cost savings against your current baseline packaging, inspect 3D interior/exterior
            fits, and evaluate against the 16 ISO packaging standards registry.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/projects/new')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>➕</span>
              <span>Create New Project</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadExample('stand_fan_toshiba_type')}
              disabled={loadingExampleId !== null}
              className="px-4 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 font-semibold text-xs sm:text-sm border border-indigo-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>⚡</span>
              <span>{loadingExampleId === 'stand_fan_toshiba_type' ? 'Loading Demo...' : 'Instant Toshiba Demo'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/standards')}
              className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 transition-all flex items-center gap-2"
            >
              <span>📜</span>
              <span>ISO Standards Registry</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Step Simple Workflow Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 font-black text-sm flex items-center justify-center border border-blue-500/20 mb-3">
            1
          </div>
          <h3 className="font-bold text-slate-100 text-sm mb-1 flex items-center gap-1.5">
            <span>📏</span> Enter Product & Baseline
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Specify product dimensions, weight, and existing box baseline. Or choose one of the preloaded factory examples.
          </p>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 font-black text-sm flex items-center justify-center border border-indigo-500/20 mb-3">
            2
          </div>
          <h3 className="font-bold text-slate-100 text-sm mb-1 flex items-center gap-1.5">
            <span>📦</span> 3D Exterior & Interior Review
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Inspect the right-sized packaging alternatives in 3D. Toggle between outer box view and translucent interior cushioning fit.
          </p>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/20 mb-3">
            3
          </div>
          <h3 className="font-bold text-slate-100 text-sm mb-1 flex items-center gap-1.5">
            <span>📑</span> Savings & ISO Standards Audit
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Verify ISO 18602 volume reduction and required physical tests. Export printable PDF, HTML, or JSON specifications.
          </p>
        </div>
      </div>

      {/* Quick Start Reference Examples */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>⚡</span> 1-Click Reference Examples
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Instantly test packaging generation, 3D visualization, and standards checks with verified hackathon data.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {examples.map((ex) => (
            <div
              key={ex.example_id}
              className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-blue-500/50 hover:bg-slate-900/80 transition-all shadow-md group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-2xl">
                    {ex.example_id.includes('fan') ? '💨' : '🥤'}
                  </span>
                  <DataBadge label={ex.data_label} />
                </div>
                <h3 className="font-bold text-slate-100 text-sm group-hover:text-blue-400 transition-colors">
                  {ex.example_name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ex.description}</p>
                {ex.data_warning && (
                  <p className="text-[11px] text-amber-400/90 mt-2 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex items-start gap-1">
                    <span>⚠️</span>
                    <span>{ex.data_warning}</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleLoadExample(ex.example_id)}
                disabled={loadingExampleId !== null}
                className="mt-4 w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingExampleId === ex.example_id ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Computing 3D Optimization...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Load & View in 3D</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Projects List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>📁</span> Saved Optimization Projects ({projects.length})
            </h2>
            <p className="text-xs text-slate-400">
              Access previously generated packaging calculations and engineering models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
            />
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1"
            >
              All →
            </button>
          </div>
        </div>

        {loadingProjects ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading saved projects...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
            <p className="font-semibold text-slate-300">
              {searchFilter ? 'No matching projects found.' : 'No projects saved yet.'}
            </p>
            <p className="text-slate-500">
              Create your first packaging optimization above or click any reference example to get started in 1 click!
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 divide-y divide-slate-800 shadow-md">
            {filteredProjects.slice(0, 6).map((p) => (
              <div
                key={p.project_id}
                onClick={() => navigate(`/projects/${p.project_id}`)}
                className="p-4 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <span>{p.name}</span>
                    <span className="text-[10px] text-blue-400 font-mono">
                      {p.product_name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Created: {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-400 font-semibold px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors">
                    Open 3D Results →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
